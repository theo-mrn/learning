import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "notes_session";

/** Durée de vie d'une session. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Au-delà de cette ancienneté d'usage, le cookie et l'échéance en base sont
 * repoussés. Ne pas renouveler à chaque requête : ça ferait une écriture par
 * navigation pour un gain nul. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Le cookie transporte un secret aléatoire ; la base n'en garde que
 * l'empreinte. Une fuite de la table `sessions` ne permet donc pas de forger
 * un cookie valide.
 *
 * SHA-256 nu (et non scrypt) est ici le bon choix : l'entrée fait déjà 256
 * bits d'aléa, elle n'est pas devinable par force brute — contrairement à un
 * mot de passe, qui lui exige une fonction coûteuse.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Compare deux empreintes à temps constant. */
function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Ouvre une session et pose le cookie. */
export async function createSession(
  userId: string,
  context?: { userAgent?: string | null; ipAddress?: string | null }
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: context?.userAgent ?? null,
      ipAddress: context?.ipAddress ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // `secure` seulement hors développement : en local on est en http, et un
    // cookie `secure` n'y serait jamais renvoyé — donc connexion impossible.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

/**
 * Lit la session courante, ou `null`. Vérifie l'échéance **en base**, jamais
 * seulement le cookie : c'est ce qui rend la déconnexion effective.
 */
export async function readSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tokenHash: true,
      expiresAt: true,
      lastUsedAt: true,
      user: {
        select: { id: true, email: true, name: true, avatarUrl: true },
      },
    },
  });

  if (!session) return null;

  // Ceinture et bretelles : `findUnique` a déjà filtré sur l'empreinte, mais
  // la comparaison explicite documente l'invariant et couvre une éventuelle
  // collision d'index.
  if (!hashesEqual(session.tokenHash, tokenHash)) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // Session périmée : on la retire au passage plutôt que de laisser la
    // table grossir indéfiniment.
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (Date.now() - session.lastUsedAt.getTime() > REFRESH_AFTER_MS) {
    await refreshSession(session.id, token);
  }

  return session.user;
}

/** Renouvellement glissant : prolonge la session en base et le cookie. */
async function refreshSession(sessionId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session
    .update({
      where: { id: sessionId },
      data: { expiresAt, lastUsedAt: new Date() },
    })
    .catch(() => {});

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  } catch {
    // Écrire un cookie depuis un Server Component est interdit : la lecture
    // reste valable, le renouvellement se fera à la prochaine action.
  }
}

/** Ferme la session courante (déconnexion). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Ferme toutes les sessions d'un utilisateur (« déconnecter partout »). */
export async function destroyAllSessions(userId: string): Promise<number> {
  const { count } = await db.session.deleteMany({ where: { userId } });
  return count;
}

/** Purge les sessions expirées. Appelable depuis une tâche planifiée. */
export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return count;
}
