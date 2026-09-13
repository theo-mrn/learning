"use client";

import { motion, type Transition } from "motion/react";

/** Tracé du coup de stylo. Dessiné dans un repère de 340×32 puis étiré au
 * conteneur via `preserveAspectRatio="none"` : le texte d'une tâche est un
 * champ souple, pas un label de largeur fixe, donc un chemin figé dépasserait
 * sur les libellés courts et s'arrêterait au milieu des longs. */
const STRIKE_PATH =
  "M 10 16.91 s 79.8 -11.36 98.1 -11.34 c 22.2 0.02 -47.82 14.25 -33.39 22.02 c 12.61 6.77 124.18 -27.98 133.31 -17.28 c 7.52 8.38 -26.8 20.02 4.61 22.05 c 24.55 1.93 113.37 -20.36 113.37 -20.36";

function pathAnimate(checked: boolean) {
  return { pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 };
}

/** L'opacité bascule instantanément, mais seulement une fois le tracé fini :
 * sinon le trait disparaîtrait d'un coup au lieu de se retirer. */
function pathTransition(checked: boolean, duration: number): Transition {
  return {
    pathLength: { duration, ease: "easeInOut" },
    opacity: { duration: 0.01, delay: checked ? 0 : duration },
  };
}

export function StrikeThrough({
  checked,
  /** Les sous-tâches ont un texte plus petit : un trait d'épaisseur égale y
   * paraîtrait deux fois plus lourd. */
  strokeWidth = 2,
  duration = 0.7,
  className = "stroke-muted-foreground",
}: {
  checked: boolean;
  strokeWidth?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.svg
      viewBox="0 0 340 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      <motion.path
        d={STRIKE_PATH}
        vectorEffect="non-scaling-stroke"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeMiterlimit={10}
        fill="none"
        initial={false}
        animate={pathAnimate(checked)}
        transition={pathTransition(checked, duration)}
        className={className}
      />
    </motion.svg>
  );
}
