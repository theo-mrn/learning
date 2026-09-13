type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/** Converts a Tiptap/ProseMirror JSON document into GitHub-flavored Markdown. */
export function docToMarkdown(doc: { content?: unknown[] }): string {
  const nodes = (doc.content ?? []) as Node[];
  return nodes.map((n) => blockToMarkdown(n)).join("\n\n").trim() + "\n";
}

function blockToMarkdown(node: Node, listDepth = 0): string {
  switch (node.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return `${"#".repeat(level)} ${inlineToMarkdown(node.content)}`;
    }
    case "paragraph":
      return inlineToMarkdown(node.content);
    case "blockquote":
      return (node.content ?? [])
        .map((child) => blockToMarkdown(child, listDepth))
        .join("\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "codeBlock": {
      const lang = (node.attrs?.language as string) || "";
      const code = (node.content ?? []).map((c) => c.text ?? "").join("");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    case "bulletList":
      return (node.content ?? [])
        .map((item) => listItemToMarkdown(item, listDepth, "-"))
        .join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start) || 1;
      return (node.content ?? [])
        .map((item, i) => listItemToMarkdown(item, listDepth, `${start + i}.`))
        .join("\n");
    }
    case "taskList":
      return (node.content ?? [])
        .map((item) => taskItemToMarkdown(item, listDepth))
        .join("\n");
    case "kanban": {
      const title = (node.attrs?.title as string) || "Tableau Kanban";
      const columns = Array.isArray(node.attrs?.columns)
        ? (node.attrs.columns as Array<{
            title: string;
            cards?: Array<{
              title: string;
              description?: string;
              checklists?: Array<{ text: string; completed: boolean }>;
            }>;
          }>)
        : [];
      const lines = [`## ${title}`];
      for (const col of columns) {
        lines.push(`\n### ${col.title}`);
        for (const card of col.cards ?? []) {
          lines.push(`- **${card.title}**`);
          if (card.description) {
            lines.push(`  ${card.description}`);
          }
          for (const chk of card.checklists ?? []) {
            lines.push(`  - [${chk.completed ? "x" : " "}] ${chk.text}`);
          }
        }
      }
      return lines.join("\n");
    }
    case "todoBlock": {
      const title = (node.attrs?.title as string) || "Liste de tâches";
      const tasks = Array.isArray(node.attrs?.tasks)
        ? (node.attrs.tasks as Array<{
            text: string;
            completed: boolean;
            priority?: string;
            dueDate?: string | null;
            subtasks?: Array<{ text: string; completed: boolean }>;
          }>)
        : [];
      const lines = [`## ${title}`, ""];
      for (const task of tasks) {
        // Priorité et échéance sont du sens, pas de la décoration : elles
        // suivent le texte en clair plutôt que de disparaître à l'export.
        const meta: string[] = [];
        if (task.priority && task.priority !== "none") {
          meta.push(`priorité : ${task.priority}`);
        }
        if (task.dueDate) meta.push(`échéance : ${task.dueDate}`);
        const suffix = meta.length ? ` _(${meta.join(", ")})_` : "";
        lines.push(`- [${task.completed ? "x" : " "}] ${task.text}${suffix}`);
        for (const sub of task.subtasks ?? []) {
          lines.push(`  - [${sub.completed ? "x" : " "}] ${sub.text}`);
        }
      }
      return lines.join("\n");
    }
    case "imageBlock": {
      const images = Array.isArray(node.attrs?.images)
        ? (node.attrs.images as Array<{
            assetId: string | null;
            caption?: string;
            alt?: string;
          }>)
        : [];
      // Chemin absolu vers la Route Handler : l'export est lu hors de
      // l'application, un chemin relatif n'y résoudrait rien.
      return images
        .filter((image) => image.assetId)
        .map((image) => {
          const alt = image.alt || image.caption || "image";
          const line = `![${alt}](/api/assets/${image.assetId})`;
          return image.caption ? `${line}\n\n_${image.caption}_` : line;
        })
        .join("\n\n");
    }
    case "whiteboard": {
      // Un dessin vectoriel n'a pas d'équivalent Markdown : on exporte un
      // repère nommé plutôt que de faire disparaître le bloc de l'export.
      const title = (node.attrs?.title as string) || "Tableau blanc";
      return `## ${title}\n\n_(tableau blanc — contenu graphique non exportable en Markdown)_`;
    }
    default:
      return inlineToMarkdown(node.content);
  }
}

function listItemToMarkdown(
  item: Node,
  depth: number,
  marker: string
): string {
  const indent = "  ".repeat(depth);
  const children = item.content ?? [];
  const [first, ...rest] = children;
  const firstLine = first ? blockToMarkdown(first, depth) : "";
  const nested = rest
    .map((child) => blockToMarkdown(child, depth + 1))
    .join("\n");
  return [`${indent}${marker} ${firstLine}`, nested].filter(Boolean).join("\n");
}

function taskItemToMarkdown(item: Node, depth: number): string {
  const indent = "  ".repeat(depth);
  const checked = item.attrs?.checked ? "x" : " ";
  const children = item.content ?? [];
  const [first, ...rest] = children;
  const firstLine = first ? blockToMarkdown(first, depth) : "";
  const nested = rest
    .map((child) => blockToMarkdown(child, depth + 1))
    .join("\n");
  return [`${indent}- [${checked}] ${firstLine}`, nested]
    .filter(Boolean)
    .join("\n");
}

function inlineToMarkdown(content?: Node[]): string {
  if (!content) return "";
  return content.map((n) => textNodeToMarkdown(n)).join("");
}

function textNodeToMarkdown(node: Node): string {
  if (node.type === "hardBreak") return "  \n";
  let text = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        text = `**${text}**`;
        break;
      case "italic":
        text = `*${text}*`;
        break;
      case "strike":
        text = `~~${text}~~`;
        break;
      case "code":
        text = `\`${text}\``;
        break;
      case "link":
        text = `[${text}](${mark.attrs?.href ?? ""})`;
        break;
    }
  }
  return text;
}
