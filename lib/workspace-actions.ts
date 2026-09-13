"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { WORKSPACE_COOKIE, requireWorkspaceAccess } from "@/lib/workspace";

/** Durée de validité d'un lien d'invitation. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const WorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60, "60 caractères maximum"),
  icon: z.string().trim().max(8).nullish(),
});

export type WorkspaceFormState =
  | { errors?: { name?: string[]; icon?: string[] }; message?: string }
  | undefined;

function setActiveWorkspaceCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, id: string) {
  cookieStore.set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Un an : ce cookie n'est qu'une préférence d'affichage, sa validité
    // réelle est recalculée contre les appartenances à chaque requête.
    maxAge: 365 * 24 * 60 * 60,
  });
}

export async function createWorkspace(
  _state: WorkspaceFormState,
  formData: FormData
): Promise<WorkspaceFormState> {
  const parsed = WorkspaceSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const user = await requireUser();

  const workspace = await db.workspace.create({
    data: {
      name: parsed.data.name,
      icon: parsed.data.icon || null,
      members: { create: { role: "owner", userId: user.id } },
    },
    select: { id: true },
  });

  // On bascule dessus : créer un espace pour rester dans l'ancien serait
  // déroutant.
  setActiveWorkspaceCookie(await cookies(), workspace.id);

  revalidatePath("/", "layout");
  redirect("/home");
}

export async function switchWorkspace(workspaceId: string): Promise<void> {
  // Contrôle avant d'écrire le cookie : sans lui, n'importe quel id posé
  // depuis le client serait mémorisé (même si `getActiveWorkspace` le
  // rejetterait ensuite, autant ne pas l'enregistrer du tout).
  await requireWorkspaceAccess(workspaceId);

  setActiveWorkspaceCookie(await cookies(), workspaceId);

  revalidatePath("/", "layout");
}

export async function renameWorkspace(
  workspaceId: string,
  _state: WorkspaceFormState,
  formData: FormData
): Promise<WorkspaceFormState> {
  const parsed = WorkspaceSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  // Renommer engage tout l'espace : réservé au propriétaire.
  await requireWorkspaceAccess(workspaceId, { roles: ["owner"] });

  await db.workspace.update({
    where: { id: workspaceId },
    data: { name: parsed.data.name, icon: parsed.data.icon || null },
  });

  revalidatePath("/", "layout");
  return { message: "Espace mis à jour" };
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const { userId } = await requireWorkspaceAccess(workspaceId, {
    roles: ["owner"],
  });

  // Le dernier espace ne peut pas partir : l'utilisateur se retrouverait
  // devant une application sans nulle part où écrire.
  const count = await db.workspaceMember.count({ where: { userId } });
  if (count <= 1) {
    throw new Error("Impossible de supprimer votre seul espace");
  }

  // Le cascade emporte pages, blocs, versions et images de cet espace.
  await db.workspace.delete({ where: { id: workspaceId } });

  const cookieStore = await cookies();
  cookieStore.delete(WORKSPACE_COOKIE);

  revalidatePath("/", "layout");
  redirect("/home");
}

export async function leaveWorkspace(workspaceId: string): Promise<void> {
  const { userId, role } = await requireWorkspaceAccess(workspaceId);

  if (role === "owner") {
    const owners = await db.workspaceMember.count({
      where: { workspaceId, role: "owner" },
    });
    // Un espace sans propriétaire ne serait plus administrable par personne.
    if (owners <= 1) {
      throw new Error(
        "Transférez la propriété ou supprimez l'espace avant de le quitter"
      );
    }
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  const cookieStore = await cookies();
  cookieStore.delete(WORKSPACE_COOKIE);

  revalidatePath("/", "layout");
  redirect("/home");
}

const InviteSchema = z.object({
  role: z.enum(["editor", "viewer"]),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Adresse email invalide"))
    .or(z.literal(""))
    .transform((value) => value || null),
});

export type InviteState =
  | { link?: string; errors?: { email?: string[] }; message?: string }
  | undefined;

/**
 * Crée un lien d'invitation. Pas d'envoi d'email : aucun service de mail
 * n'est configuré, donc le lien est renvoyé pour être copié et transmis.
 */
export async function createInvitation(
  workspaceId: string,
  _state: InviteState,
  formData: FormData
): Promise<InviteState> {
  const parsed = InviteSchema.safeParse({
    role: formData.get("role") ?? "editor",
    email: formData.get("email") ?? "",
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { userId } = await requireWorkspaceAccess(workspaceId, {
    roles: ["owner"],
  });

  const token = randomBytes(32).toString("base64url");

  await db.workspaceInvitation.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      workspaceId,
      role: parsed.data.role,
      email: parsed.data.email,
      invitedById: userId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  revalidatePath("/", "layout");

  // Le jeton en clair n'existe qu'ici : la base n'en a que l'empreinte, donc
  // ce lien ne pourra plus jamais être réaffiché.
  return { link: `/invitation/${token}` };
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const invitation = await db.workspaceInvitation.findUnique({
    where: { id: invitationId },
    select: { workspaceId: true },
  });

  if (!invitation) return;

  await requireWorkspaceAccess(invitation.workspaceId, { roles: ["owner"] });

  await db.workspaceInvitation.delete({ where: { id: invitationId } });

  revalidatePath("/", "layout");
}

/** Accepte une invitation à partir du jeton présent dans le lien. */
export async function acceptInvitation(token: string): Promise<void> {
  const user = await requireUser();

  const invitation = await db.workspaceInvitation.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: {
      id: true,
      workspaceId: true,
      role: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
    },
  });

  if (!invitation) throw new Error("Invitation introuvable");
  if (invitation.acceptedAt) throw new Error("Invitation déjà utilisée");
  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new Error("Invitation expirée");
  }
  // Invitation nominative : elle ne vaut que pour l'adresse visée, même si le
  // lien circule.
  if (invitation.email && invitation.email !== user.email.toLowerCase()) {
    throw new Error("Cette invitation vise une autre adresse");
  }

  const existing = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id },
    },
    select: { id: true },
  });

  if (!existing) {
    await db.$transaction([
      db.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
        },
      }),
      db.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
  }

  setActiveWorkspaceCookie(await cookies(), invitation.workspaceId);

  revalidatePath("/", "layout");
  redirect("/home");
}

export async function updateMemberRole(
  workspaceId: string,
  memberUserId: string,
  role: string
): Promise<void> {
  const { userId } = await requireWorkspaceAccess(workspaceId, {
    roles: ["owner"],
  });

  if (memberUserId === userId) {
    // Se retirer soi-même la propriété pourrait laisser l'espace sans
    // administrateur : ça passe par « quitter l'espace », qui vérifie.
    throw new Error("Utilisez « Quitter l'espace » pour changer votre rôle");
  }

  if (!["owner", "editor", "viewer"].includes(role)) {
    throw new Error("Rôle inconnu");
  }

  await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
    data: { role },
  });

  revalidatePath("/", "layout");
}

export async function removeMember(
  workspaceId: string,
  memberUserId: string
): Promise<void> {
  const { userId } = await requireWorkspaceAccess(workspaceId, {
    roles: ["owner"],
  });

  if (memberUserId === userId) {
    throw new Error("Utilisez « Quitter l'espace » pour vous retirer");
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
  });

  revalidatePath("/", "layout");
}
