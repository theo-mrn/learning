"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";

const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse email invalide")),
  password: z.string().min(1, "Mot de passe requis"),
});

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères"),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse email invalide")),
  password: z
    .string()
    .min(10, "Au moins 10 caractères")
    .regex(/[a-zA-Z]/, "Au moins une lettre")
    .regex(/[0-9]/, "Au moins un chiffre"),
});

export type AuthFormState =
  | {
      errors?: { email?: string[]; password?: string[]; name?: string[] };
      message?: string;
    }
  | undefined;

/** Contexte de connexion, pour qu'une liste « mes appareils » soit possible. */
async function requestContext() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    // Derrière un proxy, l'IP réelle est dans `x-forwarded-for`.
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

export async function login(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  const valid = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? null
  );

  // Message volontairement identique dans les deux cas : distinguer
  // « compte inconnu » de « mot de passe faux » révélerait quelles adresses
  // sont enregistrées. `verifyPassword` est appelé même sans utilisateur pour
  // que la durée de réponse ne trahisse pas l'existence du compte.
  if (!user || !valid) {
    return { message: "Email ou mot de passe incorrect" };
  }

  await createSession(user.id, await requestContext());
  redirect("/");
}

export async function signup(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existing) {
    return { errors: { email: ["Cette adresse est déjà utilisée"] } };
  }

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      // Un compte sans espace de travail ne peut rien faire.
      workspaces: {
        create: { role: "owner", workspace: { create: { name: "Mon Espace" } } },
      },
    },
    select: { id: true },
  });

  await createSession(user.id, await requestContext());
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
