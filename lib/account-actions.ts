"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, destroySession } from "@/lib/session";
import { PreferencesSchema } from "@/lib/preferences";
import { cookies } from "next/headers";

export type AccountFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      ok?: boolean;
    }
  | undefined;

const ProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit faire au moins 2 caractères")
    .max(80, "80 caractères maximum"),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse email invalide")),
});

export async function updateProfile(
  _state: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const user = await requireUser();

  const parsed = ProfileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  // L'email est l'identifiant de connexion : un doublon rendrait un compte
  // inaccessible.
  if (parsed.data.email !== user.email.toLowerCase()) {
    const taken = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (taken) {
      return { errors: { email: ["Cette adresse est déjà utilisée"] } };
    }
  }

  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, email: parsed.data.email },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Profil mis à jour" };
}

const PasswordSchema = z
  .object({
    current: z.string().min(1, "Mot de passe actuel requis"),
    next: z
      .string()
      .min(10, "Au moins 10 caractères")
      .regex(/[a-zA-Z]/, "Au moins une lettre")
      .regex(/[0-9]/, "Au moins un chiffre"),
    confirm: z.string(),
  })
  .refine((data) => data.next === data.confirm, {
    path: ["confirm"],
    error: "Les deux mots de passe ne correspondent pas",
  });

export async function changePassword(
  _state: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const user = await requireUser();

  const parsed = PasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  const valid = await verifyPassword(parsed.data.current, record.passwordHash);
  if (!valid) {
    return { errors: { current: ["Mot de passe actuel incorrect"] } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next) },
  });

  // Changer son mot de passe doit fermer les autres sessions : c'est le geste
  // qu'on fait justement quand on soupçonne un accès indésirable. La session
  // courante est préservée pour ne pas éjecter la personne qui vient d'agir.
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value;
  await destroyOtherSessions(user.id, currentToken);

  return { ok: true, message: "Mot de passe modifié. Les autres appareils ont été déconnectés." };
}

/** Ferme toutes les sessions de l'utilisateur sauf celle du jeton fourni. */
async function destroyOtherSessions(userId: string, keepToken?: string) {
  const { createHash } = await import("node:crypto");
  const keepHash = keepToken
    ? createHash("sha256").update(keepToken).digest("hex")
    : null;

  await db.session.deleteMany({
    where: {
      userId,
      ...(keepHash ? { tokenHash: { not: keepHash } } : {}),
    },
  });
}

/** « Déconnecter partout ailleurs », depuis la liste des appareils. */
export async function signOutOtherDevices(): Promise<AccountFormState> {
  const user = await requireUser();
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value;

  await destroyOtherSessions(user.id, currentToken);

  revalidatePath("/parametres/compte");
  return { ok: true, message: "Les autres appareils ont été déconnectés" };
}

/**
 * Supprime définitivement le compte.
 *
 * Le cascade Prisma emporte pages, blocs, versions, images, sessions et
 * appartenances. Un espace dont l'utilisateur était le seul membre devient
 * orphelin : on le supprime aussi, sinon il resterait inaccessible à jamais.
 */
export async function deleteAccount(
  _state: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const user = await requireUser();

  // Confirmation par saisie de l'email : un bouton seul se clique par
  // accident, et l'action est irréversible.
  if (String(formData.get("confirmation") ?? "").trim() !== user.email) {
    return { errors: { confirmation: ["L'adresse saisie ne correspond pas"] } };
  }

  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  const valid = await verifyPassword(
    String(formData.get("password") ?? ""),
    record.passwordHash
  );
  if (!valid) {
    return { errors: { password: ["Mot de passe incorrect"] } };
  }

  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id },
    select: { workspaceId: true },
  });

  await db.$transaction(async (tx) => {
    for (const { workspaceId } of memberships) {
      const others = await tx.workspaceMember.count({
        where: { workspaceId, userId: { not: user.id } },
      });
      // Dernier membre : l'espace et tout son contenu partent avec le compte.
      if (others === 0) {
        await tx.workspace.delete({ where: { id: workspaceId } });
      }
    }
    await tx.user.delete({ where: { id: user.id } });
  });

  await destroySession();
  redirect("/login");
}

/** Déconnexion simple, depuis la page du compte. */
export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * Enregistre les préférences d'affichage et d'édition.
 *
 * Stockées sur le compte et non dans le navigateur : elles suivent
 * l'utilisateur d'un appareil à l'autre, contrairement au thème qui reste en
 * `localStorage` parce qu'il doit être appliqué avant le premier rendu.
 */
export async function updatePreferences(
  _state: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const user = await requireUser();

  const parsed = PreferencesSchema.safeParse({
    idleSaveSeconds: formData.get("idleSaveSeconds"),
    compactMode: formData.get("compactMode") === "on",
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  await db.user.update({
    where: { id: user.id },
    data: { preferences: parsed.data },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Préférences enregistrées" };
}
