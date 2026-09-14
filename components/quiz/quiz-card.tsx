"use client";

import { Play, Plus, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QuizData } from "./quiz-types";

export function QuizCard({
  quiz,
  onStart,
  onInsert,
}: {
  quiz: QuizData;
  onStart: (quiz: QuizData) => void;
  onInsert?: (quiz: QuizData) => void;
}) {
  const difficultyBadge = () => {
    switch (quiz.difficulty) {
      case "easy":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium px-1.5 py-0.5"
          >
            Facile
          </Badge>
        );
      case "hard":
        return (
          <Badge
            variant="outline"
            className="border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-medium px-1.5 py-0.5"
          >
            Avancé
          </Badge>
        );
      case "medium":
      default:
        return (
          <Badge
            variant="outline"
            className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[10px] font-medium px-1.5 py-0.5"
          >
            Intermédiaire
          </Badge>
        );
    }
  };

  // Assainissement du titre : suppression des préfixes redondants "Quiz : "
  let cleanTitle = (quiz.title || "").trim();
  cleanTitle = cleanTitle.replace(/^(?:quiz\s*[:—–-]\s*)+/i, "");
  if (!cleanTitle || /sans titre/i.test(cleanTitle) || cleanTitle.toLowerCase() === "quiz") {
    cleanTitle = quiz.topic ? quiz.topic : "Quiz d'entraînement";
  }

  const questionCount = quiz.questions?.length || 0;

  return (
    <div className="my-2 rounded-xl border border-primary/30 bg-card p-3 shadow-xs transition-all hover:border-primary/60">
      {/* Ligne principale : Icône + Titre & Métadonnées bien aérées */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary border border-primary/25 shadow-2xs">
          <GraduationCap className="size-4.5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold px-2 py-0.5 rounded-md"
            >
              {questionCount} {questionCount > 1 ? "questions" : "question"}
            </Badge>

            {difficultyBadge()}

            {quiz.topic && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                {quiz.topic}
              </span>
            )}
          </div>

          <h4
            className="font-sans text-xs sm:text-sm font-semibold text-foreground leading-snug tracking-tight truncate"
            title={cleanTitle}
          >
            {cleanTitle}
          </h4>
        </div>
      </div>

      {/* Barre d'actions en bas : boutons séparés en grille 50/50 sans chevauchement */}
      <div
        className={`mt-3 pt-2.5 border-t border-border/50 ${
          onInsert ? "grid grid-cols-2 gap-2" : "flex justify-end"
        }`}
      >
        {onInsert && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onInsert(quiz)}
            title="Insérer ce quiz sous forme de bloc interactif dans votre cours"
            className="gap-1.5 text-xs font-medium h-8 rounded-lg border-border/80 hover:bg-muted/70 text-muted-foreground hover:text-foreground shadow-2xs justify-center cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Insérer</span>
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={() => onStart(quiz)}
          className="gap-1.5 text-xs font-semibold h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs justify-center cursor-pointer"
        >
          <Play className="size-3.5 fill-current" />
          <span>Lancer le Quiz</span>
        </Button>
      </div>
    </div>
  );
}
