"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Trophy,
  Sparkles,
  Award,
  HelpCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  shuffleQuizQuestions,
  type QuizData,
  type QuizQuestion,
} from "./quiz-types";

const OPTION_LABELS = ["A", "B", "C", "D"];

function QuizGameContent({
  quiz,
  onClose,
}: {
  quiz: QuizData;
  onClose: () => void;
}) {
  // Ordre aléatoire des questions et placement aléatoire des réponses à chaque partie
  const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>(() =>
    shuffleQuizQuestions(quiz.questions)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentQuestion = shuffledQuestions[currentIndex];
  const totalQuestions = shuffledQuestions.length;
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;

    setSelectedOption(index);
    setIsAnswered(true);
    const isCorrect = index === currentQuestion.correctAnswer;
    const nextScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(nextScore);
    }

    const nextAnswers = { ...userAnswers, [currentIndex]: index };
    setUserAnswers(nextAnswers);

    // Si c'est la dernière question, enregistrement immédiat en base de données
    if (currentIndex === totalQuestions - 1) {
      void fetch(`/api/ai/quiz/${quiz.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: nextScore,
          total: totalQuestions,
          answers: nextAnswers,
        }),
      }).catch((e) => console.error("Failed to save quiz attempt:", e));
    }
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    // Nouveau tirage aléatoire des questions et des options
    setShuffledQuestions(shuffleQuizQuestions(quiz.questions));
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setUserAnswers({});
    setScore(0);
    setIsCompleted(false);
  };

  const scorePercent = Math.round((score / totalQuestions) * 100);

  return (
    <>
      {/* En-tête du Quiz */}
      <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-2 pr-6">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold truncate max-w-sm">
                {quiz.title}
              </DialogTitle>
              {quiz.pageTitle && (
                <p className="text-[11px] text-muted-foreground truncate">
                  Cours : {quiz.pageTitle}
                </p>
              )}
            </div>
          </div>

          <Badge variant="outline" className="text-xs shrink-0 font-medium">
            {currentIndex + 1} / {totalQuestions}
          </Badge>
        </div>

        {/* Barre de progression fluide */}
        <div className="w-full bg-muted/80 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </DialogHeader>

      {/* Corps principal : Question ou Résultats */}
      <div className="flex-1 overflow-y-auto p-5">
        {!isCompleted ? (
          <div className="space-y-4">
            {/* Intitulé de la question */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                Question {currentIndex + 1}
              </span>
              <h3 className="text-base font-medium text-foreground leading-snug">
                {currentQuestion.question}
              </h3>
            </div>

            {/* 4 choix possibles */}
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === currentQuestion.correctAnswer;

                let buttonStyle =
                  "border-border/70 bg-card hover:bg-muted/60 hover:border-primary/40 text-foreground";
                let icon = null;

                if (isAnswered) {
                  if (isCorrect) {
                    buttonStyle =
                      "border-emerald-500/80 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-medium ring-1 ring-emerald-500/30";
                    icon = <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
                  } else if (isSelected) {
                    buttonStyle =
                      "border-rose-500/80 bg-rose-500/10 text-rose-950 dark:text-rose-200 ring-1 ring-rose-500/30";
                    icon = <XCircle className="size-4 text-rose-500 shrink-0" />;
                  } else {
                    buttonStyle = "border-border/40 bg-muted/20 text-muted-foreground opacity-50";
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border text-left text-xs sm:text-sm transition-all duration-150 ${buttonStyle}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                        {OPTION_LABELS[idx] || idx + 1}
                      </span>
                      <span className="leading-relaxed break-words">{option}</span>
                    </div>
                    {icon}
                  </button>
                );
              })}
            </div>

            {/* Explication pédagogique dévoilée après la réponse */}
            {isAnswered && (
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all duration-200 ${
                  selectedOption === currentQuestion.correctAnswer
                    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                    : "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <HelpCircle className="size-4 shrink-0 mt-0.5 text-primary" />
                  <div>
                    <span className="font-semibold block mb-0.5">
                      {selectedOption === currentQuestion.correctAnswer
                        ? "Bonne réponse !"
                        : "Explication :"}
                    </span>
                    <p>{currentQuestion.explanation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Écran de score final */
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-5">
            <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              {scorePercent >= 80 ? (
                <Trophy className="size-8 text-amber-500" />
              ) : scorePercent >= 50 ? (
                <Award className="size-8 text-primary" />
              ) : (
                <RotateCcw className="size-8 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">
                {scorePercent === 100
                  ? "Score Parfait ! 🎉"
                  : scorePercent >= 70
                  ? "Excellent travail ! 👏"
                  : scorePercent >= 50
                  ? "Bonne révision ! 👍"
                  : "À approfondir ! 💪"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Tu as obtenu{" "}
                <strong className="text-foreground font-semibold">
                  {score} / {totalQuestions}
                </strong>{" "}
                bonnes réponses ({scorePercent}%).
              </p>
            </div>

            {/* Récapitulatif question par question */}
            <div className="w-full max-h-52 overflow-y-auto space-y-2 text-left border border-border/60 rounded-xl p-3 bg-muted/20">
              {shuffledQuestions.map((q, i) => {
                const ans = userAnswers[i];
                const ok = ans === q.correctAnswer;
                return (
                  <div
                    key={q.id || i}
                    className="flex items-start justify-between gap-2 text-xs py-1 border-b border-border/40 last:border-b-0"
                  >
                    <span className="truncate flex-1 text-foreground/90">
                      {i + 1}. {q.question}
                    </span>
                    {ok ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium shrink-0">
                        <CheckCircle2 className="size-3.5" /> Correct
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-500 font-medium shrink-0">
                        <XCircle className="size-3.5" /> Erreur
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pied de page avec actions */}
      <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
        {!isCompleted ? (
          <>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Quitter
            </Button>

            <Button
              size="sm"
              disabled={!isAnswered}
              onClick={handleNext}
              className="gap-1.5 text-xs font-medium px-4"
            >
              <span>
                {currentIndex === totalQuestions - 1
                  ? "Terminer le Quiz"
                  : "Question suivante"}
              </span>
              <ArrowRight className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestart}
              className="gap-1 text-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>Rejouer</span>
            </Button>

            <Button size="sm" onClick={onClose} className="text-xs px-5">
              Terminer
            </Button>
          </>
        )}
      </div>
    </>
  );
}

export function QuizPlayer({
  quiz,
  isOpen,
  onClose,
}: {
  quiz: QuizData | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!quiz || !quiz.questions || quiz.questions.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-xl p-0 overflow-hidden border border-border/80 bg-background shadow-2xl rounded-2xl flex flex-col max-h-[90vh] z-[100]">
        {isOpen && (
          <QuizGameContent
            key={`${quiz.id}-${isOpen ? "open" : "closed"}`}
            quiz={quiz}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
