# Prérequis d'hébergement

État au 13/09/2026. À relire avant tout déploiement : certains choix faits en
développement ne tiennent pas en production, et ils sont signalés comme tels.

## 1. Ce qui tourne aujourd'hui en local

| Service | Détail | Port |
|---|---|---|
| Next.js 16.3.4 (Turbopack) | `npm run dev` | 3000 |
| PostgreSQL 16 | `docker-compose.yml`, conteneur `learning-db-1` | **5433** (5432 est pris par un autre projet) |

Aucun autre service. Pas de Redis, pas de stockage objet, pas de serveur
WebSocket — voir §5 si le temps réel est ajouté.

## 2. Variables d'environnement

| Variable | Rôle | Remarque |
|---|---|---|
| `DATABASE_URL` | Connexion Postgres | Prisma 7 exige un **driver adapter** (`@prisma/adapter-pg`), déjà câblé dans `lib/db.ts` |
| `SESSION_SECRET` | 32 octets aléatoires, base64 | **Le changer invalide toutes les sessions.** Générer avec `openssl rand -base64 32` |

`.env*` est ignoré par git (vérifié). Ne jamais committer ces valeurs.

## 3. Points bloquants avant une mise en ligne

### Cookies `secure`
`lib/session.ts` et `lib/workspace-actions.ts` posent `secure: process.env.NODE_ENV === "production"`.
En HTTP pur, un cookie `secure` n'est jamais renvoyé → **connexion impossible**.
Donc : **HTTPS obligatoire** en production, sans exception.

### Les images sont dans Postgres
Choix délibéré (`Asset.data` en `BYTEA`) : un `pg_dump` est une sauvegarde
complète, et la cohérence avec la corbeille et l'historique est garantie.
Conséquences à prévoir :
- La base grossit avec les images (~200–500 Ko par capture après compression WebP).
- Prévoir le disque en conséquence, et surveiller la taille des dumps.
- Migration vers disque ou S3 possible plus tard **sans toucher au document** :
  seule la Route Handler `app/api/assets/[id]/route.ts` changerait, puisque les
  blocs ne stockent qu'un identifiant.

### `sharp` est une dépendance native
Compilée pour la plateforme cible. Sur une image Docker de production, installer
les dépendances **sur la même architecture** que l'exécution (ou utiliser
`--platform`), sinon le traitement d'images échoue au démarrage.

### Sauvegarde
`pg_dump` suffit et couvre tout : pages, blocs, versions, images, sessions,
invitations. Rien n'est stocké hors de Postgres.

## 4. Migrations et build

```bash
npx prisma migrate deploy   # migrations en production (jamais `migrate dev`)
npx prisma generate         # OBLIGATOIRE après chaque migration
npm run build
```

**Piège vécu** : le client Prisma généré est en mémoire du processus. Après un
`prisma generate`, il faut **redémarrer le serveur**, sinon les nouveaux modèles
renvoient des erreurs 500 (ça a coûté une longue séance de débogage).

## 5. Si le temps réel est ajouté plus tard (décision reportée)

Pas encore décidé. Les prérequis selon la voie retenue :

### Voie A — Hocuspocus auto-hébergé
- Un **service supplémentaire** (Node) à côté de Next, dans `docker-compose.yml`.
- Un port WebSocket exposé, et un **reverse proxy qui autorise l'upgrade WS**
  (`proxy_set_header Upgrade`/`Connection` côté nginx).
- WSS obligatoire si le site est en HTTPS (un WS non chiffré depuis une page
  HTTPS est bloqué par le navigateur).
- Authentification du socket : réutiliser le cookie de session, sinon n'importe
  qui pourrait rejoindre un document en connaissant son identifiant.
- Persistance : décider qui écrit dans Postgres — Hocuspocus ou Next.
- `yjs` est déjà présent (dépendance transitive), `y-prosemirror` non.

### Voie B — Service géré (Liveblocks ou équivalent)
- Aucun serveur à maintenir, curseurs et présence fournis.
- Mais : **les documents transitent chez un tiers**, et le coût dépasse un
  quota gratuit. À arbitrer selon la sensibilité des notes de cours.

### Incompatibilité connue, quelle que soit la voie
Les blocs complexes (Kanban, todolist, tableau blanc, images) stockent leur état
dans des **attributs JSON**. Yjs fusionne finement le texte, mais un attribut
JSON reste en « dernier écrivain gagne ». Pour une fusion carte par carte dans
le Kanban, il faudrait le remodeler en nœuds ProseMirror — gros chantier, non
engagé.

## 6. Fichiers audio du pomodoro

`public/sounds/` contient six ambiances MP3 de **27 à 28 Mo chacune**, soit
**~166 Mo** ajoutés à l'image de déploiement. Conséquences concrètes :

- **Limite de taille du déploiement.** Vercel plafonne le déploiement (et
  l'offre gratuite de plusieurs hébergeurs se situe sous ce volume). À vérifier
  avant le premier `deploy`, sinon l'échec arrive sans message clair.
- **Servir par plages (`Range`) est indispensable.** Le lecteur audio doit
  pouvoir streamer au lieu de télécharger 28 Mo avant la première note.
  `next start` et les CDN le font ; un reverse proxy mal réglé peut le casser.
- **Mise en cache.** Ces fichiers ne changent jamais : un `Cache-Control`
  immuable et long évite de les retélécharger à chaque session.
- **Chargement différé, déjà en place.** L'élément `<audio>` est en
  `preload="none"` et n'est renseigné qu'à la sélection d'une ambiance : sans
  choix explicite, zéro octet ne part sur le réseau.

Alternative si le volume pose problème : héberger ces six fichiers sur un
stockage objet et ne garder dans `public/` que les URL. Cela réintroduirait la
dépendance externe que le projet évite pour les images — d'où le choix actuel
de les garder en statique.

## 7. Hors sujet hébergement mais à ne pas oublier

Le badge **« Get a license for production »** de tldraw apparaît sur le tableau
blanc. Une utilisation commerciale exige une `licenseKey`. Décision en attente.
