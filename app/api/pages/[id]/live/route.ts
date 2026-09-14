import { db } from "@/lib/db";
import {
  ForbiddenError,
  UnauthorizedError,
  requirePageAccess,
} from "@/lib/dal";

/** Flux permanent : aucun cache ni pré-rendu possible. */
export const dynamic = "force-dynamic";

/** Cadence d'interrogation de la version. La requête coûte ~0,04 ms en base
 * (lecture d'un seul entier, sans le document), donc on peut être réactif
 * sans peser : c'est le document qu'on évite de transférer, pas ce compteur. */
const POLL_MS = 1500;

/** Sans trafic, un proxy peut fermer une connexion inactive. Un commentaire
 * SSE (ligne débutant par `:`) la maintient sans rien signifier pour le
 * client. */
const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events : annonce la version du contenu d'une page dès qu'elle
 * change.
 *
 * Choix de SSE plutôt que WebSocket : le besoin est **unidirectionnel** — le
 * serveur prévient, le client va chercher. SSE tient dans un Route Handler
 * Next (`ReadableStream`), ne demande aucun service supplémentaire à héberger,
 * et se reconnecte tout seul côté navigateur (`EventSource`).
 *
 * Le flux ne transporte QUE le numéro de version, jamais le document : c'est
 * au client de décider s'il veut récupérer le contenu, et comment l'intégrer
 * sans perturber la frappe en cours.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/pages/[id]/live">
) {
  const { id: pageId } = await params;

  try {
    await requirePageAccess(pageId, "read");
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return new Response("Non authentifié", { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return new Response("Page introuvable", { status: 404 });
    }
    throw error;
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Flux déjà fermé par le client : on arrête la boucle proprement.
          closed = true;
        }
      }

      // L'abandon de la requête (onglet fermé, navigation) doit arrêter la
      // boucle, sinon on interrogerait la base indéfiniment pour personne.
      request.signal.addEventListener("abort", () => {
        closed = true;
      });

      let lastVersion: number | null = null;
      let lastHeartbeat = Date.now();

      while (!closed) {
        const page = await db.page
          .findUnique({
            where: { id: pageId },
            select: { contentVersion: true },
          })
          .catch(() => null);

        if (!page) {
          // Page supprimée : on le dit et on ferme.
          send(`event: gone\ndata: {}\n\n`);
          break;
        }

        if (page.contentVersion !== lastVersion) {
          lastVersion = page.contentVersion;
          send(`event: version\ndata: ${JSON.stringify({ version: lastVersion })}\n\n`);
          lastHeartbeat = Date.now();
        } else if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
          send(`: ping\n\n`);
          lastHeartbeat = Date.now();
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }

      try {
        controller.close();
      } catch {
        // Déjà fermé.
      }
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
