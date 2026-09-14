"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { usePomodoro } from "@/hooks/use-pomodoro";
import {
  AMBIENCES,
  POMODORO_LABELS,
  ambienceFile,
  formatRemaining,
  type PomodoroKind,
} from "@/lib/pomodoro";
import { getPomodoroStats, type PomodoroStats } from "@/lib/pomodoro-actions";

/**
 * Signal sonore de fin de cycle, synthétisé plutôt que chargé.
 *
 * Les MP3 fournis sont des ambiances de ~30 minutes (27 Mo pièce) : aucun ne
 * peut servir d'alerte brève. Deux notes en sinus suffisent, coûtent zéro
 * octet de réseau et ne dépendent d'aucun fichier.
 */
function playChime() {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();

    [880, 1174.7].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const start = context.currentTime + index * 0.18;
      // Enveloppe douce : une onde coupée net produit un clic audible.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.5);
    });

    setTimeout(() => void context.close(), 1500);
  } catch {
    // Audio indisponible ou bloqué : la notification visuelle reste.
  }
}

export function PomodoroWidget() {
  const { state, actions, onCycleEnd } = usePomodoro();
  const { kind, remaining, total, running, hydrating, settings } = state;

  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<PomodoroStats | null>(null);

  /**
   * L'élément audio est créé une seule fois et conservé.
   *
   * Le recréer à chaque changement de réglage relancerait le téléchargement
   * d'un fichier de 27 Mo. `preload="none"` est essentiel pour la même raison :
   * rien ne part sur le réseau tant qu'aucune ambiance n'est choisie.
   *
   * La construction a lieu dans un effet, pas pendant le rendu : instancier
   * un `Audio` en cours de rendu est un effet de bord, interdit par
   * `react-hooks/refs`, et n'aurait de toute façon aucun sens côté serveur.
   */
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /** Crée l'élément au premier besoin, jamais pendant le rendu. */
  const getAudio = useCallback(() => {
    if (audioRef.current === null) {
      const element = new Audio();
      element.loop = true;
      element.preload = "none";
      audioRef.current = element;
    }
    return audioRef.current;
  }, []);

  // Un seul effet pilote l'audio : source, volume et lecture. Les séparer
  // obligeait à gérer l'ordre dans lequel ils s'exécutent, pour un élément qui
  // n'a de toute façon qu'un seul état cohérent.
  useEffect(() => {
    const file = ambienceFile(settings.ambience);
    // Aucune ambiance choisie : ne rien instancier du tout, donc aucun octet
    // de réseau et aucun élément à nettoyer.
    if (!file) {
      audioRef.current?.pause();
      return;
    }

    const audio = getAudio();
    // Comparer à `audio.src` (absolu) via `endsWith` évite de réassigner la
    // même source, ce qui relancerait la lecture depuis le début.
    if (!audio.src.endsWith(file)) audio.src = file;
    audio.volume = settings.ambienceVolume;

    // L'ambiance accompagne le travail, pas les pauses — c'est tout l'intérêt
    // d'un fond sonore : marquer la phase de concentration.
    if (running && kind === "work") {
      void audio.play().catch(() => {
        // Lecture automatique refusée tant que l'utilisateur n'a pas interagi
        // avec la page. Le clic sur « démarrer » lèvera ce blocage.
      });
    } else {
      audio.pause();
    }
  }, [
    getAudio,
    running,
    kind,
    settings.ambience,
    settings.ambienceVolume,
  ]);

  // Arrêt au démontage : un élément audio orphelin continuerait de jouer.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleCycleEnd = useCallback(
    (ended: PomodoroKind) => {
      if (settings.chime) playChime();

      if (settings.notify && typeof Notification !== "undefined") {
        if (Notification.permission === "granted") {
          new Notification(
            ended === "work" ? "Session terminée" : "Pause terminée",
            {
              body:
                ended === "work"
                  ? "C'est le moment de faire une pause."
                  : "Prêt à repartir ?",
              // Une même étiquette remplace la notification précédente au lieu
              // d'empiler une pile de rappels identiques.
              tag: "pomodoro",
            }
          );
        }
      }

      // Les statistiques affichées deviennent fausses dès qu'un cycle se
      // termine : on les invalide plutôt que de les laisser mentir.
      setStats(null);
    },
    [settings.chime, settings.notify]
  );

  useEffect(() => {
    onCycleEnd(handleCycleEnd);
  }, [onCycleEnd, handleCycleEnd]);

  // Les statistiques ne sont chargées qu'à l'ouverture du panneau : les
  // demander à chaque montage de la barre latérale ferait une requête par
  // navigation, pour une information que personne ne regarde.
  useEffect(() => {
    if (!open || stats) return;
    let cancelled = false;
    void getPomodoroStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        // Statistiques indisponibles : le minuteur reste utilisable.
      });
    return () => {
      cancelled = true;
    };
  }, [open, stats]);

  const handleStart = useCallback(() => {
    // La permission se demande sur un geste de l'utilisateur : un appel
    // spontané au chargement est ignoré par les navigateurs, et hostile.
    if (
      settings.notify &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission().catch(() => {});
    }
    actions.start();
  }, [actions, settings.notify]);

  const progress = total > 0 ? 1 - remaining / total : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <SidebarMenuButton
            tooltip={`Pomodoro — ${POMODORO_LABELS[kind]} ${formatRemaining(remaining)}`}
            isActive={running}
          >
            <Timer />
            <span className="flex-1">{POMODORO_LABELS[kind]}</span>
            {/* `tabular-nums` fige la largeur des chiffres : sans ça, le
                libellé tressaute à chaque seconde. `suppressHydrationWarning`
                parce que la valeur vient de `localStorage`, donc absente au
                rendu serveur. */}
            <span
              data-numeric
              suppressHydrationWarning
              className="font-medium tabular-nums text-sidebar-foreground/70"
            >
              {hydrating ? "--:--" : formatRemaining(remaining)}
            </span>
          </SidebarMenuButton>
        }
      />

      <PopoverContent side="right" align="end" className="w-80 gap-0 p-0">
        <div className="flex flex-col items-center gap-3 border-b border-border/60 p-4">
          <div className="flex w-full items-center justify-between">
            <span className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {POMODORO_LABELS[kind]}
            </span>
            <span className="text-xs text-muted-foreground">
              {state.completedWork} session
              {state.completedWork > 1 ? "s" : ""} aujourd&apos;hui
            </span>
          </div>

          <span
            data-numeric
            suppressHydrationWarning
            className="text-4xl font-light tabular-nums"
          >
            {hydrating ? "--:--" : formatRemaining(remaining)}
          </span>

          {/* Barre de progression du cycle, en pur CSS : une jauge à une seule
              dimension ne justifie pas une dépendance de graphiques. */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>

          <div className="flex w-full items-center gap-2">
            <button
              type="button"
              onClick={running ? actions.pause : handleStart}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {running ? (
                <>
                  <Pause className="size-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="size-4" /> Démarrer
                </>
              )}
            </button>
            <button
              type="button"
              onClick={actions.skip}
              title="Passer au cycle suivant"
              aria-label="Passer au cycle suivant"
              className="rounded-lg border border-border/60 p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <SkipForward className="size-4" />
            </button>
            <button
              type="button"
              onClick={actions.reset}
              title="Réinitialiser"
              aria-label="Réinitialiser le minuteur"
              className="rounded-lg border border-border/60 p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-border/60 p-4">
          <span className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Ambiance
          </span>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => actions.updateSettings({ ambience: null })}
              aria-pressed={settings.ambience === null}
              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                settings.ambience === null
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-foreground/40"
              }`}
            >
              <VolumeX className="size-3.5" />
              Aucune
            </button>
            {AMBIENCES.map((ambience) => (
              <button
                key={ambience.id}
                type="button"
                onClick={() =>
                  actions.updateSettings({ ambience: ambience.id })
                }
                aria-pressed={settings.ambience === ambience.id}
                className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                  settings.ambience === ambience.id
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {ambience.label}
              </button>
            ))}
          </div>

          {settings.ambience && (
            <label className="flex items-center gap-2 pt-1">
              <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.ambienceVolume * 100)}
                onChange={(event) =>
                  actions.updateSettings({
                    ambienceVolume: Number(event.target.value) / 100,
                  })
                }
                aria-label="Volume de l'ambiance"
                className="w-full accent-primary"
              />
            </label>
          )}

          <p className="text-[0.7rem] text-muted-foreground">
            Jouée pendant le travail, en boucle. Elle s&apos;arrête aux pauses.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <span className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Cette semaine
          </span>

          {stats ? (
            <>
              <div className="flex items-baseline gap-4">
                <span className="text-sm">
                  <span data-numeric className="font-medium tabular-nums">
                    {stats.todayMinutes}
                  </span>{" "}
                  <span className="text-muted-foreground">min aujourd&apos;hui</span>
                </span>
                <span className="text-sm">
                  <span data-numeric className="font-medium tabular-nums">
                    {stats.weekCount}
                  </span>{" "}
                  <span className="text-muted-foreground">sessions</span>
                </span>
              </div>

              {/* Histogramme des 7 derniers jours. Hauteur relative au meilleur
                  jour : une échelle absolue écraserait les barres d'une semaine
                  calme jusqu'à l'invisible. */}
              <div className="flex h-12 items-end gap-1">
                {stats.daily.map((day) => {
                  const peak = Math.max(...stats.daily.map((d) => d.minutes), 1);
                  return (
                    <div
                      key={day.date}
                      title={`${day.date} — ${day.minutes} min`}
                      className="flex-1 rounded-sm bg-primary/25"
                      style={{
                        height: `${Math.max(4, (day.minutes / peak) * 100)}%`,
                      }}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Chargement…</p>
          )}

          <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={settings.notify}
              onChange={(event) =>
                actions.updateSettings({ notify: event.target.checked })
              }
              className="accent-primary"
            />
            Notification en fin de cycle
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={settings.chime}
              onChange={(event) =>
                actions.updateSettings({ chime: event.target.checked })
              }
              className="accent-primary"
            />
            Signal sonore
            {settings.chime && <Check className="size-3 text-primary" />}
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
