/**
 * Retire du document les valeurs qui n'ont de sens que dans l'onglet courant,
 * avant écriture en base.
 *
 * `editor.getJSON()` ne passe ni par `renderHTML` ni par `parseHTML` : le
 * nettoyage fait dans le schéma du bloc image ne couvre que la sérialisation
 * HTML, pas la sauvegarde. Sans ce passage, deux valeurs mortes partaient en
 * Postgres et dans chaque snapshot de version :
 *
 * - `previewUrl` : une URL `blob:` n'est valable que pour l'onglet qui l'a
 *   créée. Relue ailleurs (ou après rechargement), elle donne une image
 *   cassée.
 * - `pendingFiles` : des objets `File`, qui se sérialisent en `{}` ou `null`
 *   et n'ont rien à faire dans un document stocké.
 *
 * Vérifié dans la base : les lignes contenaient bien des
 * `"previewUrl": "blob:http://localhost:3000/..."`.
 */

type UnknownNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: unknown;
};

/** Clés d'attributs purement locales, jamais persistées. */
const EPHEMERAL_ATTRS = ["previewUrl", "pendingFiles"];

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(source)) {
    if (EPHEMERAL_ATTRS.includes(key)) continue;
    result[key] = sanitizeValue(entry);
  }

  return result;
}

/**
 * Copie profonde du document, débarrassée des valeurs éphémères.
 *
 * Remplace aussi le `JSON.parse(JSON.stringify(...))` qui servait à aplatir
 * les valeurs non sérialisables avant la frontière de Server Action : le
 * parcours ci-dessus reconstruit déjà des objets simples.
 */
export function sanitizeDocument<T>(doc: T): T {
  return sanitizeValue(doc) as T;
}

/** Idem pour un nœud isolé (une ligne `Block`). */
export function sanitizeNode(node: UnknownNode): UnknownNode {
  return sanitizeValue(node) as UnknownNode;
}
