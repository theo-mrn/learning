import type { Editor, Range } from "@tiptap/core";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  ListChecks,
  Quote,
  Code,
  Minus,
  Type,
  Table as TableIcon,
  Columns3,
  Presentation,
  Image as ImageIcon,
  HelpCircle,
  BookOpen,
} from "lucide-react";

export type SlashCommandItem = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
  /** Quand l'item a besoin d'un réglage avant d'agir (les dimensions d'un
   * tableau), le menu affiche ce panneau au lieu d'insérer directement.
   * `command` sert alors de repli si le panneau est indisponible. */
  panel?: "table";
};

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    title: "Texte",
    description: "Paragraphe simple",
    icon: Type,
    keywords: ["text", "paragraph", "texte"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Titre 1",
    description: "Grand titre de section",
    icon: Heading1,
    keywords: ["h1", "heading", "titre"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run(),
  },
  {
    title: "Titre 2",
    description: "Titre de sous-section",
    icon: Heading2,
    keywords: ["h2", "heading", "titre"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run(),
  },
  {
    title: "Titre 3",
    description: "Petit titre",
    icon: Heading3,
    keywords: ["h3", "heading", "titre"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run(),
  },
  {
    title: "Liste à puces",
    description: "Liste simple non ordonnée",
    icon: List,
    keywords: ["bullet", "liste", "puces"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Liste numérotée",
    description: "Liste avec des nombres",
    icon: ListOrdered,
    keywords: ["numbered", "liste", "ordered", "numero"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Liste de tâches",
    description: "Cases à cocher",
    icon: ListTodo,
    keywords: ["todo", "task", "checkbox", "tache"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Citation",
    description: "Bloc de citation",
    icon: Quote,
    keywords: ["quote", "citation"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Bloc de code",
    description: "Extrait de code",
    icon: Code,
    keywords: ["code"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Tableau",
    description: "Choisir lignes et colonnes",
    icon: TableIcon,
    keywords: ["table", "tableau", "grid", "grille", "colonne", "ligne"],
    panel: "table",
    // Repli si le panneau ne s'ouvre pas : un 3x3 avec en-tête.
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Tableau Kanban",
    description: "Tableau interactif de tâches et colonnes",
    icon: Columns3,
    keywords: ["kanban", "board", "colonnes", "taches", "projet", "cartes"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "kanban",
        })
        .run(),
  },
  {
    title: "Tableau blanc",
    description: "Dessins, formes et schémas à main levée",
    icon: Presentation,
    // Le menu « / » se ferme dès qu'on tape une espace (comportement de
    // l'extension Suggestion de Tiptap), donc chaque mot-clé doit pouvoir
    // être saisi seul : « tableau » et « blanc » en plus de l'expression.
    keywords: [
      "tableau",
      "blanc",
      "tableaublanc",
      "whiteboard",
      "dessin",
      "dessiner",
      "draw",
      "schema",
      "croquis",
      "formes",
      "tldraw",
    ],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "whiteboard" })
        .run(),
  },
  {
    title: "Liste de tâches (bloc)",
    description: "Bloc complet : progression, échéances, priorités, sous-tâches",
    icon: ListChecks,
    // Chaque mot-clé doit pouvoir être saisi seul : le menu « / » se ferme
    // dès l'espace.
    keywords: [
      "todo",
      "todolist",
      "taches",
      "tâches",
      "liste",
      "checklist",
      "progression",
      "echeance",
      "priorite",
      "sous-taches",
    ],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "todoBlock" })
        .run(),
  },
  {
    title: "Image",
    description: "Photos et captures : coller, déposer, galerie",
    icon: ImageIcon,
    keywords: [
      "image",
      "images",
      "photo",
      "photos",
      "capture",
      "picture",
      "galerie",
      "gallery",
      "illustration",
    ],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "imageBlock" })
        .run(),
  },
  {
    title: "Quiz / QCM (bloc interactif)",
    description: "Bloc d'évaluation interactif intégré à votre cours",
    icon: HelpCircle,
    keywords: [
      "quiz",
      "qcm",
      "test",
      "evaluation",
      "questions",
      "question",
      "revision",
    ],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "quizBlock" })
        .run(),
  },
  {
    title: "Flashcards (cartes de révision)",
    description: "Fiches de mémorisation interactives avec retournement 3D",
    icon: BookOpen,
    keywords: [
      "flashcard",
      "flashcards",
      "carte",
      "cartes",
      "memo",
      "memorisation",
      "revision",
      "fiches",
      "fiche",
      "anki",
    ],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "flashcardBlock" })
        .run(),
  },
  {
    title: "Séparateur",
    description: "Ligne de séparation horizontale",
    icon: Minus,
    keywords: ["divider", "separator", "ligne", "hr"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

export function filterSlashCommandItems(query: string): SlashCommandItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_COMMAND_ITEMS;
  return SLASH_COMMAND_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
  );
}
