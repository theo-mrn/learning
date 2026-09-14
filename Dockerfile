# syntax=docker/dockerfile:1

# Image Debian slim et non Alpine : `sharp` et `@prisma/adapter-pg` sont liés
# à glibc. Alpine (musl) demande des paquets supplémentaires et reste le cas
# le moins testé en amont — pour ~40 Mo de plus, on évite cette classe de
# pannes qui n'apparaissent qu'au runtime.
FROM node:24-bookworm-slim AS base


# --- Dépendances -------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# `openssl` est requis par le moteur Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# `npm ci` installe ici, sous Linux : c'est ce qui recompile `sharp` pour la
# plateforme d'exécution (le `node_modules` de l'hôte est exclu par
# .dockerignore — voir le commentaire en tête de ce fichier).
RUN npm ci


# --- Build -------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Le client Prisma est généré dans `app/generated/prisma`, qui est gitignoré :
# il n'existe donc pas dans le contexte de build et DOIT être généré ici,
# avant `next build` qui l'importe via `lib/db.ts`.
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

# Aucune variable d'exécution n'est passée au build : rien n'est préfixé
# NEXT_PUBLIC_, et `DATABASE_URL` n'est lue qu'à l'exécution. La même image
# vaut donc pour tous les environnements.
RUN npm run build


# --- Migrations --------------------------------------------------------------
# Étape dédiée, cible du Job Kubernetes `learning-migrate`.
#
# Elle existe parce que la CLI Prisma 7 tire 128 paquets transitifs (~211 Mo :
# Studio, pglite, d3…) dont l'application n'a AUCUN besoin à l'exécution.
# Les copier dans l'image finale la ferait grossir d'autant ; n'en copier
# qu'une partie casserait au démarrage, car `prisma7.config.ts` charge
# `dotenv/config` et `@prisma/config` via `c12`.
#
# Le `node_modules` complet de l'étape `deps` est donc conservé ICI, et
# seulement ici. L'image applicative, elle, reste sur le strict standalone.
FROM base AS migrator
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
# `migrate deploy` lit l'URL depuis le fichier de config, pas depuis le schéma :
# le bloc `datasource` de schema.prisma ne contient pas d'`url`.
COPY prisma7.config.ts ./
COPY prisma ./prisma

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
USER nextjs

# `migrate deploy` et jamais `migrate dev` : `dev` peut réinitialiser la base
# et pose des questions interactives, ce qui bloquerait le Job.
CMD ["npx", "prisma", "migrate", "deploy"]


# --- Exécution ---------------------------------------------------------------
FROM base AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Utilisateur non-root : exigé par la `securityContext` du Deployment.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# `server.js` et le `node_modules` élagué produits par `output: "standalone"`.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# `standalone` n'embarque NI `public` NI `.next/static` : la doc impose de les
# copier à la main, sinon l'appli sert du HTML sans CSS ni sons.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Pas de CLI Prisma ici : les migrations tournent depuis l'étage `migrator`
# (voir plus haut). L'application n'a besoin que du client généré, que
# `output: "standalone"` a déjà tracé dans le bundle.

USER nextjs

EXPOSE 3000
ENV PORT=3000
# Sans cela, le serveur n'écoute que sur localhost et les probes du kubelet,
# qui arrivent par l'IP du pod, échouent toutes.
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
