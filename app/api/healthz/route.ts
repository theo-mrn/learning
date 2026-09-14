import { db } from "@/lib/db";

/** Sonde : jamais de cache, jamais de pré-rendu. */
export const dynamic = "force-dynamic";

/**
 * Point de santé pour les sondes Kubernetes.
 *
 * Deux comportements en un seul chemin, distingués par `?ready` :
 *
 * - **sans paramètre** (*liveness*) : ne teste que le processus Node. Une
 *   base injoignable ne doit PAS redémarrer le pod — le redémarrage ne
 *   répare rien et transforme une panne de base en boucle de crash.
 *
 * - **`?ready`** (*readiness*) : vérifie la base, car un pod incapable de
 *   lire Postgres ne peut servir aucune page utile. Le retirer du Service
 *   est la bonne réaction : il reviendra seul quand la base répondra.
 */
export async function GET(request: Request) {
  const wantsReadiness = new URL(request.url).searchParams.has("ready");

  if (!wantsReadiness) {
    return Response.json({ status: "ok" });
  }

  try {
    // Requête la moins chère possible : on valide l'aller-retour réseau et
    // l'authentification, sans toucher au schéma applicatif.
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "up" });
  } catch {
    // Le détail de l'erreur n'est pas renvoyé : cette route est publique et
    // un message de connexion Postgres expose hôte et identifiants.
    return Response.json(
      { status: "unavailable", database: "down" },
      { status: 503 }
    );
  }
}
