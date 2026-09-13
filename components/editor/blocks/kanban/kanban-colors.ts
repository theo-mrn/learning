import type { KanbanPriority } from "./kanban-types";

export interface ColumnColorConfig {
  id: string;
  name: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  headerBorder: string;
}

export const COLUMN_COLORS: ColumnColorConfig[] = [
  {
    id: "slate",
    name: "Ardoise",
    dot: "bg-stone-500 dark:bg-stone-400",
    badgeBg: "bg-stone-500/10 dark:bg-stone-400/15",
    badgeText: "text-stone-700 dark:text-stone-300",
    badgeBorder: "border-stone-500/20",
    headerBorder: "border-stone-500/30",
  },
  {
    id: "amber",
    name: "Ambre",
    dot: "bg-amber-600 dark:bg-amber-500",
    badgeBg: "bg-amber-500/10 dark:bg-amber-400/15",
    badgeText: "text-amber-800 dark:text-amber-300",
    badgeBorder: "border-amber-500/20",
    headerBorder: "border-amber-500/30",
  },
  {
    id: "emerald",
    name: "Sauge",
    dot: "bg-emerald-600 dark:bg-emerald-500",
    badgeBg: "bg-emerald-500/10 dark:bg-emerald-400/15",
    badgeText: "text-emerald-800 dark:text-emerald-300",
    badgeBorder: "border-emerald-500/20",
    headerBorder: "border-emerald-500/30",
  },
  {
    id: "blue",
    name: "Indigo",
    dot: "bg-sky-600 dark:bg-sky-500",
    badgeBg: "bg-sky-500/10 dark:bg-sky-400/15",
    badgeText: "text-sky-800 dark:text-sky-300",
    badgeBorder: "border-sky-500/20",
    headerBorder: "border-sky-500/30",
  },
  {
    id: "purple",
    name: "Prune",
    dot: "bg-purple-600 dark:bg-purple-400",
    badgeBg: "bg-purple-500/10 dark:bg-purple-400/15",
    badgeText: "text-purple-800 dark:text-purple-300",
    badgeBorder: "border-purple-500/20",
    headerBorder: "border-purple-500/30",
  },
  {
    id: "rose",
    name: "Terracotta",
    dot: "bg-rose-600 dark:bg-rose-500",
    badgeBg: "bg-rose-500/10 dark:bg-rose-400/15",
    badgeText: "text-rose-800 dark:text-rose-300",
    badgeBorder: "border-rose-500/20",
    headerBorder: "border-rose-500/30",
  },
];

export function getColumnColor(colorId: string): ColumnColorConfig {
  return (
    COLUMN_COLORS.find((c) => c.id === colorId) ??
    COLUMN_COLORS[0]
  );
}

export const TAG_COLORS = [
  { id: "slate", name: "Gris", bg: "bg-muted text-muted-foreground border-border" },
  { id: "amber", name: "Ambre", bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  { id: "emerald", name: "Vert", bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  { id: "blue", name: "Bleu", bg: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20" },
  { id: "purple", name: "Violet", bg: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20" },
  { id: "rose", name: "Rose", bg: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" },
];

export function getTagColorClass(colorId: string): string {
  const match = TAG_COLORS.find((c) => c.id === colorId);
  return match?.bg ?? "bg-muted text-muted-foreground border-border";
}

export const PRIORITY_CONFIG: Record<
  KanbanPriority,
  { label: string; dot: string; textClass: string; badgeClass: string }
> = {
  none: {
    label: "Sans priorité",
    dot: "bg-stone-300 dark:bg-stone-600",
    textClass: "text-muted-foreground",
    badgeClass: "text-muted-foreground bg-muted/60 border-border/50",
  },
  low: {
    label: "Basse",
    dot: "bg-blue-500",
    textClass: "text-blue-600 dark:text-blue-400",
    badgeClass: "text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/20",
  },
  medium: {
    label: "Moyenne",
    dot: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
    badgeClass: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20",
  },
  high: {
    label: "Haute",
    dot: "bg-orange-500",
    textClass: "text-orange-600 dark:text-orange-400",
    badgeClass: "text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/20",
  },
  urgent: {
    label: "Urgente",
    dot: "bg-red-500 animate-pulse",
    textClass: "text-red-600 dark:text-red-400",
    badgeClass: "text-red-700 dark:text-red-300 bg-red-500/15 border-red-500/30",
  },
};
