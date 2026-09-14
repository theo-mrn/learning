"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_POMODORO_SETTINGS,
  durationFor,
  nextKind,
  readSettings,
  type PomodoroKind,
  type PomodoroSettings,
} from "@/lib/pomodoro";
import { recordPomodoroSession } from "@/lib/pomodoro-actions";

const TIMER_KEY = "pomodoro:timer";
const SETTINGS_KEY = "pomodoro:settings";

/**
 * État persistant du minuteur.
 *
 * Le temps restant n'est PAS stocké : on garde une **échéance absolue**
 * (`endsAt`). Un compteur décrémenté à chaque tick dériverait dès que l'onglet
 * passe en arrière-plan — les navigateurs y brident `setInterval` à une fois
 * par minute — et se figerait pendant un rechargement. Avec une échéance, le
 * temps restant se recalcule depuis l'horloge et reste juste quoi qu'il arrive.
 */
type StoredTimer = {
  kind: PomodoroKind;
  /** Horodatage de fin, en ms. `null` quand le minuteur est en pause. */
  endsAt: number | null;
  /** Restant figé pendant la pause, en secondes. */
  pausedRemaining: number | null;
  startedAt: number;
  /** Sessions de travail terminées, pour savoir quand placer la grande pause. */
  completedWork: number;
};

function readTimer(): StoredTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTimer>;
    if (
      parsed.kind !== "work" &&
      parsed.kind !== "shortBreak" &&
      parsed.kind !== "longBreak"
    ) {
      return null;
    }
    return {
      kind: parsed.kind,
      endsAt: typeof parsed.endsAt === "number" ? parsed.endsAt : null,
      pausedRemaining:
        typeof parsed.pausedRemaining === "number"
          ? parsed.pausedRemaining
          : null,
      startedAt:
        typeof parsed.startedAt === "number" ? parsed.startedAt : Date.now(),
      completedWork:
        typeof parsed.completedWork === "number" ? parsed.completedWork : 0,
    };
  } catch {
    // `localStorage` peut lever (mode privé, quota, stockage bloqué) et son
    // contenu peut avoir été édité à la main. Un minuteur illisible n'est pas
    // une raison de casser la barre latérale.
    return null;
  }
}

function writeTimer(timer: StoredTimer | null) {
  try {
    if (timer === null) localStorage.removeItem(TIMER_KEY);
    else localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  } catch {
    // Sans persistance le minuteur fonctionne quand même, il ne survit
    // simplement pas à un rechargement.
  }
}

export type PomodoroState = {
  kind: PomodoroKind;
  remaining: number;
  total: number;
  running: boolean;
  /** `true` tant que `localStorage` n'a pas été lu (rendu serveur inclus). */
  hydrating: boolean;
  completedWork: number;
  settings: PomodoroSettings;
};

export function usePomodoro() {
  // Initialisation **paresseuse** plutôt que valeur par défaut corrigée dans un
  // effet : lire `localStorage` puis appeler `setState` depuis un effet
  // provoque un rendu en cascade (et un affichage qui saute des valeurs par
  // défaut aux valeurs réelles). L'initialiseur ne s'exécute qu'au premier
  // rendu client, là où `localStorage` existe.
  const [settings, setSettings] = useState<PomodoroSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_POMODORO_SETTINGS;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? readSettings(JSON.parse(raw)) : DEFAULT_POMODORO_SETTINGS;
    } catch {
      return DEFAULT_POMODORO_SETTINGS;
    }
  });
  const [timer, setTimer] = useState<StoredTimer | null>(() =>
    typeof window === "undefined" ? null : readTimer()
  );

  /**
   * Horloge courante, tenue en état.
   *
   * Appeler `Date.now()` dans le corps du hook rendrait le rendu impur : deux
   * rendus successifs pour la même entrée donneraient deux résultats. On
   * échantillonne donc l'heure dans le tick, et le rendu n'est plus qu'une
   * fonction de cet état.
   */
  const [now, setNow] = useState(() => Date.now());

  /**
   * `true` pendant le rendu serveur et la première passe d'hydratation.
   *
   * `useSyncExternalStore` est fait pour ça : il renvoie l'instantané serveur
   * au rendu serveur et l'instantané client ensuite, sans jamais passer par un
   * `setState` dans un effet (qui provoquerait un rendu en cascade). Le
   * « magasin » ne change jamais, d'où un abonnement vide.
   *
   * Sans cette distinction, l'affichage du minuteur divergerait entre le HTML
   * serveur (qui ignore `localStorage`) et le premier rendu client.
   */
  const hydrating = useSyncExternalStore(
    () => () => {},
    () => false,
    () => true
  );

  const settingsRef = useRef(settings);
  const timerRef = useRef(timer);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  // Aucun effet de relecture ici : les initialiseurs paresseux de `settings`,
  // `timer` et `now` s'exécutent déjà au premier rendu client, là où
  // `localStorage` existe. Un effet qui relirait le stockage après coup ne
  // ferait que dupliquer ce travail au prix d'un rendu supplémentaire.

  const updateSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      setSettings((current) => {
        const next = readSettings({ ...current, ...patch });
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        } catch {
          // Non persisté, mais appliqué pour la session en cours.
        }
        return next;
      });
    },
    []
  );

  const persist = useCallback((next: StoredTimer | null) => {
    timerRef.current = next;
    writeTimer(next);
    setTimer(next);
  }, []);

  /** Temps restant, dérivé de l'échéance et de l'horloge échantillonnée. */
  const remaining = (() => {
    if (!timer) return durationFor("work", settings);
    if (timer.endsAt === null) {
      return timer.pausedRemaining ?? durationFor(timer.kind, settings);
    }
    return Math.max(0, Math.round((timer.endsAt - now) / 1000));
  })();

  const kind = timer?.kind ?? "work";
  const running = timer?.endsAt !== null && timer !== null;
  const total = durationFor(kind, settings);

  const start = useCallback(
    (nextKindOverride?: PomodoroKind) => {
      const current = timerRef.current;
      const targetKind = nextKindOverride ?? current?.kind ?? "work";
      const seconds =
        !nextKindOverride && current?.pausedRemaining
          ? current.pausedRemaining
          : durationFor(targetKind, settingsRef.current);

      persist({
        kind: targetKind,
        endsAt: Date.now() + seconds * 1000,
        pausedRemaining: null,
        // Une reprise après pause conserve l'heure de départ initiale, pour
        // que l'historique reflète le moment où la session a réellement commencé.
        startedAt:
          !nextKindOverride && current ? current.startedAt : Date.now(),
        completedWork: current?.completedWork ?? 0,
      });
    },
    [persist]
  );

  const pause = useCallback(() => {
    const current = timerRef.current;
    if (!current || current.endsAt === null) return;
    persist({
      ...current,
      endsAt: null,
      pausedRemaining: Math.max(
        0,
        Math.round((current.endsAt - Date.now()) / 1000)
      ),
    });
  }, [persist]);

  /**
   * Arrête le cycle en cours.
   *
   * Une session de travail interrompue est tout de même enregistrée si elle a
   * duré au moins une minute : l'historique doit montrer le temps réellement
   * passé, pas seulement les cycles parfaits.
   */
  const reset = useCallback(() => {
    const current = timerRef.current;
    if (current && current.kind === "work") {
      const elapsed = Math.round((Date.now() - current.startedAt) / 1000);
      if (elapsed >= 60) {
        void recordPomodoroSession({
          kind: "work",
          durationSeconds: elapsed,
          completed: false,
          startedAt: current.startedAt,
        }).catch(() => {
          // L'historique est secondaire : une écriture perdue ne doit pas
          // interrompre le minuteur.
        });
      }
    }
    persist(null);
  }, [persist]);

  /** Passe au cycle suivant sans attendre la fin du courant. */
  const skip = useCallback(() => {
    const current = timerRef.current;
    const completedWork = current?.completedWork ?? 0;
    const following = nextKind(
      current?.kind ?? "work",
      completedWork,
      settingsRef.current
    );
    persist({
      kind: following,
      endsAt: null,
      pausedRemaining: durationFor(following, settingsRef.current),
      startedAt: Date.now(),
      completedWork,
    });
  }, [persist]);

  // Un rendu par seconde tant que le minuteur tourne, et rien du tout sinon :
  // en pause, l'affichage est figé, un intervalle n'aurait rien à rafraîchir.
  //
  // Le `setState` est bien ici dans un *callback* d'abonnement à une source
  // externe (l'horloge), pas dans le corps de l'effet : c'est précisément
  // l'usage prévu.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    // Un onglet remis au premier plan doit se remettre à l'heure sans attendre
    // le prochain tick, que le navigateur a pu brider à une fois par minute.
    const resync = () => setNow(Date.now());
    document.addEventListener("visibilitychange", resync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [running]);

  /**
   * Détection de la fin d'un cycle.
   *
   * Elle vit dans un effet plutôt que dans le `setInterval` parce qu'un onglet
   * en arrière-plan voit ses intervalles bridés : au retour, l'échéance est
   * dépassée depuis longtemps et il faut conclure le cycle immédiatement, à la
   * première évaluation du rendu — pas au prochain tick.
   */
  const onCycleEndRef = useRef<((ended: PomodoroKind) => void) | null>(null);
  const endingRef = useRef(false);

  useEffect(() => {
    const current = timerRef.current;
    if (!current || current.endsAt === null) return;
    if (remaining > 0) {
      endingRef.current = false;
      return;
    }
    // Garde de réentrance : `remaining` reste à 0 pendant les rendus qui
    // suivent, cet effet ne doit conclure le cycle qu'une fois.
    if (endingRef.current) return;
    endingRef.current = true;

    const ended = current.kind;
    const completedWork =
      ended === "work" ? current.completedWork + 1 : current.completedWork;

    if (ended === "work") {
      void recordPomodoroSession({
        kind: "work",
        durationSeconds: durationFor("work", settingsRef.current),
        completed: true,
        startedAt: current.startedAt,
      }).catch(() => {
        // Historique secondaire : l'enchaînement des cycles prime.
      });
    }

    const following = nextKind(ended, completedWork, settingsRef.current);
    // Le cycle suivant est armé mais NON démarré : enchaîner automatiquement
    // ferait courir une pause pendant qu'on est parti du bureau. L'utilisateur
    // décide quand elle commence.
    persist({
      kind: following,
      endsAt: null,
      pausedRemaining: durationFor(following, settingsRef.current),
      startedAt: Date.now(),
      completedWork,
    });

    onCycleEndRef.current?.(ended);
  }, [remaining, persist]);

  /** Enregistre la réaction à la fin d'un cycle (son, notification). */
  const onCycleEnd = useCallback((handler: (ended: PomodoroKind) => void) => {
    onCycleEndRef.current = handler;
  }, []);

  return {
    state: {
      kind,
      remaining,
      total,
      running,
      hydrating,
      completedWork: timer?.completedWork ?? 0,
      settings,
    } satisfies PomodoroState,
    actions: { start, pause, reset, skip, updateSettings },
    onCycleEnd,
  };
}
