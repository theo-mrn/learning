"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import type { PomodoroKind } from "@/lib/pomodoro";

/**
 * Actions serveur du pomodoro.
 *
 * Ce fichier n'exporte QUE des fonctions asynchrones : un module `"use server"`
 * dont un export n'est pas une fonction async est invalidé en entier, et
 * l'erreur qui en résulte désigne un autre export que le fautif. Les types,
 * constantes et helpers vivent donc dans `lib/pomodoro.ts`.
 */

export type PomodoroStats = {
  /** Sessions de travail terminées aujourd'hui. */
  todayCount: number;
  /** Minutes de travail cumulées aujourd'hui. */
  todayMinutes: number;
  /** Sessions de travail terminées sur les 7 derniers jours. */
  weekCount: number;
  weekMinutes: number;
  /** Minutes de travail par jour, du plus ancien au plus récent (7 entrées). */
  daily: { date: string; minutes: number }[];
};

/**
 * Enregistre une session achevée ou interrompue.
 *
 * Appelée à la fin d'un cycle, donc au plus une fois toutes les quelques
 * minutes : aucun besoin de regrouper les écritures.
 */
export async function recordPomodoroSession(input: {
  kind: PomodoroKind;
  durationSeconds: number;
  completed: boolean;
  startedAt: number;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();

  // Les durées viennent du client : on les borne. Une valeur absurde
  // (horloge modifiée, onglet endormi très longtemps) fausserait les
  // statistiques sans qu'on puisse la distinguer après coup.
  const duration = Math.round(input.durationSeconds);
  if (!Number.isFinite(duration) || duration < 1 || duration > 6 * 3600) {
    return { ok: false };
  }

  const startedAt = new Date(input.startedAt);
  if (Number.isNaN(startedAt.getTime())) return { ok: false };

  await db.pomodoroSession.create({
    data: {
      userId: user.id,
      kind: input.kind,
      durationSeconds: duration,
      completed: input.completed,
      startedAt,
    },
  });

  // Pas de `revalidatePath` : les statistiques sont lues à l'ouverture du
  // panneau, pas rendues par une page serveur qu'il faudrait invalider.
  return { ok: true };
}

/**
 * Statistiques de travail des 7 derniers jours.
 *
 * Seules les sessions `work` comptent : additionner les pauses gonflerait le
 * total sans rien dire du travail accompli.
 */
export async function getPomodoroStats(): Promise<PomodoroStats> {
  const user = await requireUser();

  // Les bornes sont calculées sur l'heure du serveur. Un utilisateur dans un
  // autre fuseau verrait un découpage décalé ; l'application est mono-fuseau
  // pour l'instant, et corriger cela demanderait de faire remonter le fuseau
  // du client à chaque appel.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const weekStart = new Date(startOfToday);
  weekStart.setDate(weekStart.getDate() - 6);

  const sessions = await db.pomodoroSession.findMany({
    where: {
      userId: user.id,
      kind: "work",
      completed: true,
      endedAt: { gte: weekStart },
    },
    select: { durationSeconds: true, endedAt: true },
    orderBy: { endedAt: "asc" },
  });

  const daily = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return { date: day.toISOString().slice(0, 10), minutes: 0 };
  });
  const byDate = new Map(daily.map((entry) => [entry.date, entry]));

  let todayCount = 0;
  let todaySeconds = 0;
  let weekSeconds = 0;

  for (const session of sessions) {
    weekSeconds += session.durationSeconds;

    const key = new Date(
      session.endedAt.getFullYear(),
      session.endedAt.getMonth(),
      session.endedAt.getDate()
    )
      .toISOString()
      .slice(0, 10);
    const bucket = byDate.get(key);
    if (bucket) bucket.minutes += session.durationSeconds / 60;

    if (session.endedAt >= startOfToday) {
      todayCount += 1;
      todaySeconds += session.durationSeconds;
    }
  }

  return {
    todayCount,
    todayMinutes: Math.round(todaySeconds / 60),
    weekCount: sessions.length,
    weekMinutes: Math.round(weekSeconds / 60),
    daily: daily.map((entry) => ({
      date: entry.date,
      minutes: Math.round(entry.minutes),
    })),
  };
}
