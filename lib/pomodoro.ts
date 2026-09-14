/**
 * Réglages et vocabulaire du pomodoro.
 *
 * Module ordinaire (pas `"use server"`) : il expose des constantes et des
 * types, ce qu'un fichier de Server Actions n'a pas le droit d'exporter.
 */

export type PomodoroKind = "work" | "shortBreak" | "longBreak";

export const POMODORO_LABELS: Record<PomodoroKind, string> = {
  work: "Travail",
  shortBreak: "Pause",
  longBreak: "Grande pause",
};

export type PomodoroSettings = {
  /** Durées en minutes. */
  work: number;
  shortBreak: number;
  longBreak: number;
  /** Nombre de sessions de travail avant une grande pause. */
  cyclesBeforeLongBreak: number;
  /** Ambiance sonore jouée pendant le travail, ou `null` pour le silence. */
  ambience: string | null;
  /** Volume de l'ambiance, de 0 à 1. */
  ambienceVolume: number;
  /** Signal sonore en fin de cycle. */
  chime: boolean;
  /** Notification du navigateur en fin de cycle. */
  notify: boolean;
};

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
  cyclesBeforeLongBreak: 4,
  ambience: null,
  ambienceVolume: 0.4,
  chime: true,
  notify: true,
};

/**
 * Les ambiances disponibles, servies depuis `public/sounds/`.
 *
 * Déclarées ici plutôt que découvertes dynamiquement : le dossier `public`
 * n'est pas listable côté client, et un libellé lisible vaut mieux qu'un nom
 * de fichier dans l'interface.
 */
export const AMBIENCES = [
  { id: "rain", label: "Pluie", file: "/sounds/rain.mp3" },
  { id: "ocean", label: "Océan", file: "/sounds/ocean.mp3" },
  { id: "forest", label: "Forêt", file: "/sounds/forest.mp3" },
  { id: "nature", label: "Nature", file: "/sounds/nature.mp3" },
  { id: "baleines", label: "Baleines", file: "/sounds/baleines.mp3" },
  { id: "zen", label: "Zen", file: "/sounds/zen.mp3" },
] as const;

export function ambienceFile(id: string | null): string | null {
  if (!id) return null;
  return AMBIENCES.find((a) => a.id === id)?.file ?? null;
}

/** Durée d'un type de session, en secondes. */
export function durationFor(
  kind: PomodoroKind,
  settings: PomodoroSettings
): number {
  const minutes =
    kind === "work"
      ? settings.work
      : kind === "shortBreak"
        ? settings.shortBreak
        : settings.longBreak;
  return Math.max(1, Math.round(minutes)) * 60;
}

/** `1499` → `"24:59"`. */
export function formatRemaining(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Quel cycle suit celui qui vient de se terminer ? */
export function nextKind(
  current: PomodoroKind,
  completedWorkCount: number,
  settings: PomodoroSettings
): PomodoroKind {
  if (current !== "work") return "work";
  const isLongBreakDue =
    completedWorkCount > 0 &&
    completedWorkCount % Math.max(1, settings.cyclesBeforeLongBreak) === 0;
  return isLongBreakDue ? "longBreak" : "shortBreak";
}

/** Valide des réglages venus de `localStorage`, sans leur faire confiance. */
export function readSettings(stored: unknown): PomodoroSettings {
  const s = (stored ?? {}) as Partial<PomodoroSettings>;
  const minutes = (value: unknown, fallback: number) =>
    typeof value === "number" && value >= 1 && value <= 180
      ? Math.round(value)
      : fallback;

  return {
    work: minutes(s.work, DEFAULT_POMODORO_SETTINGS.work),
    shortBreak: minutes(s.shortBreak, DEFAULT_POMODORO_SETTINGS.shortBreak),
    longBreak: minutes(s.longBreak, DEFAULT_POMODORO_SETTINGS.longBreak),
    cyclesBeforeLongBreak: minutes(
      s.cyclesBeforeLongBreak,
      DEFAULT_POMODORO_SETTINGS.cyclesBeforeLongBreak
    ),
    ambience:
      typeof s.ambience === "string" && ambienceFile(s.ambience)
        ? s.ambience
        : null,
    ambienceVolume:
      typeof s.ambienceVolume === "number" &&
      s.ambienceVolume >= 0 &&
      s.ambienceVolume <= 1
        ? s.ambienceVolume
        : DEFAULT_POMODORO_SETTINGS.ambienceVolume,
    chime:
      typeof s.chime === "boolean" ? s.chime : DEFAULT_POMODORO_SETTINGS.chime,
    notify:
      typeof s.notify === "boolean"
        ? s.notify
        : DEFAULT_POMODORO_SETTINGS.notify,
  };
}
