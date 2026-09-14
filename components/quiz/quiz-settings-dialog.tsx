"use client";

import { useState } from "react";
import { Sparkles, SlidersHorizontal, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { QuizDifficulty } from "./quiz-types";

const QUESTION_COUNTS = [3, 5, 10, 15];

const DIFFICULTIES: {
  id: QuizDifficulty;
  label: string;
  desc: string;
  badgeColor: string;
}[] = [
  {
    id: "easy",
    label: "Facile",
    desc: "Définitions, termes clés et faits explicites du cours",
    badgeColor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "medium",
    label: "Intermédiaire",
    desc: "Compréhension, mise en relation et logique",
    badgeColor: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    id: "hard",
    label: "Avancé",
    desc: "Cas concrets, analyse approfondie et pièges fréquents",
    badgeColor: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
];

export function QuizSettingsDialog({
  isOpen,
  onClose,
  onGenerate,
  defaultTopic = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (options: {
    count: number;
    difficulty: QuizDifficulty;
    topic: string;
  }) => void;
  defaultTopic?: string;
}) {
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [topic, setTopic] = useState<string>(defaultTopic);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({ count, difficulty, topic: topic.trim() });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-md p-0 overflow-hidden border border-border/80 bg-background shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </div>
            <DialogTitle className="text-sm font-semibold">
              Personnaliser votre Quiz
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Nombre de questions */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground block">
              Nombre de questions
            </label>
            <div className="grid grid-cols-4 gap-2">
              {QUESTION_COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={`py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                    count === c
                      ? "border-primary bg-primary/10 text-primary shadow-2xs"
                      : "border-border/70 bg-card hover:bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Niveau de difficulté */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground block">
              Niveau de difficulté
            </label>
            <div className="grid grid-cols-1 gap-2">
              {DIFFICULTIES.map((diff) => {
                const isSelected = difficulty === diff.id;
                return (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => setDifficulty(diff.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-2xs"
                        : "border-border/70 bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-foreground">
                          {diff.label}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full border ${diff.badgeColor}`}
                        >
                          {diff.id.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {diff.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thème ou focus spécifique (optionnel) */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground block">
              Focus particulier (optionnel)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="ex: Les protocoles de transport, Chapitre 3..."
              className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" className="gap-1.5 text-xs">
              <Sparkles className="size-3.5" />
              <span>Générer le Quiz</span>
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
