import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Redirections optimistes uniquement.
 *
 * `middleware.ts` est déprécié en Next 16 et renommé `proxy.ts` — même
 * fonctionnement, nom différent.
 *
 * Ce fichier ne lit QUE la présence du cookie, jamais la base : le proxy
 * tourne sur chaque requête, préchargements de liens compris, et une requête
 * SQL par navigation serait un gâchis. Ce n'est donc pas une barrière de
 * sécurité — la vraie vérification vit dans `lib/dal.ts`, au contact des
 * données, comme la doc Next le recommande explicitement.
 *
 * Autrement dit : un cookie forgé passe ici, et se fait refuser au DAL.
 */

const PUBLIC_ROUTES = ["/login", "/signup"];

/** Accessibles avec ou sans session : la page gère elle-même les deux cas.
 * Une invitation doit rester ouvrable par quelqu'un qui n'a pas encore de
 * compte — le rediriger vers /login lui ferait perdre le lien. */
const OPEN_ROUTES = ["/invitation"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isOpenRoute = OPEN_ROUTES.some((route) => pathname.startsWith(route));

  if (isOpenRoute) return NextResponse.next();

  if (!hasSessionCookie && !isPublicRoute) {
    const url = new URL("/login", request.nextUrl);
    // Mémorise la destination pour y revenir après connexion.
    if (pathname !== "/") url.searchParams.set("suivant", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSessionCookie && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Sans `matcher`, le proxy s'exécute aussi sur les fichiers statiques et
  // bloquerait le CSS et les images. `/api` est exclu : ces routes font leur
  // propre contrôle et doivent répondre en JSON, pas par une redirection.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
