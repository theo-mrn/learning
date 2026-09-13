/** Recursively flattens a Tiptap/ProseMirror JSON node into plain text. */
export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as {
    type?: string;
    text?: string;
    content?: unknown[];
    attrs?: Record<string, unknown>;
  };

  // Traitement spécifique pour le bloc Kanban
  if (n.type === "kanban" && n.attrs) {
    const parts: string[] = [];
    if (typeof n.attrs.title === "string") parts.push(n.attrs.title);

    const columns = Array.isArray(n.attrs.columns) ? n.attrs.columns : [];
    for (const col of columns) {
      if (typeof col.title === "string") parts.push(col.title);
      const cards = Array.isArray(col.cards) ? col.cards : [];
      for (const card of cards) {
        if (typeof card.title === "string") parts.push(card.title);
        if (typeof card.description === "string") parts.push(card.description);
        if (Array.isArray(card.tags)) {
          parts.push(...card.tags.map((t: { name: string }) => t.name).filter(Boolean));
        }
        if (Array.isArray(card.checklists)) {
          parts.push(...card.checklists.map((c: { text: string }) => c.text).filter(Boolean));
        }
      }
    }
    return parts.join(" ");
  }

  // Tableau blanc : seul le titre est du texte indexable. L'instantané
  // tldraw est un format interne volumineux, hors de question de le verser
  // dans l'index de recherche.
  if (n.type === "whiteboard" && n.attrs) {
    return typeof n.attrs.title === "string" ? n.attrs.title : "";
  }

  // Liste de tâches : le contenu vit dans les attributs, pas dans des nœuds
  // enfants. Sans ce cas, les tâches seraient invisibles à la recherche.
  if (n.type === "todoBlock" && n.attrs) {
    const parts: string[] = [];
    if (typeof n.attrs.title === "string") parts.push(n.attrs.title);

    const tasks = Array.isArray(n.attrs.tasks) ? n.attrs.tasks : [];
    for (const task of tasks) {
      if (typeof task.text === "string") parts.push(task.text);
      const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
      for (const sub of subtasks) {
        if (typeof sub.text === "string") parts.push(sub.text);
      }
    }
    return parts.join(" ");
  }

  // Bloc image : seules les légendes et les descriptions sont du texte.
  // Les octets vivent dans la table `assets`, jamais dans le document.
  if (n.type === "imageBlock" && n.attrs) {
    const images = Array.isArray(n.attrs.images) ? n.attrs.images : [];
    const parts: string[] = [];
    for (const image of images) {
      if (typeof image.caption === "string" && image.caption) {
        parts.push(image.caption);
      }
      if (typeof image.alt === "string" && image.alt) parts.push(image.alt);
    }
    return parts.join(" ");
  }

  let text = n.text ?? "";
  if (Array.isArray(n.content)) {
    text += (text ? " " : "") + n.content.map(extractPlainText).join(" ");
  }
  return text;
}
