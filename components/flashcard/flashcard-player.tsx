"use client";

import { useState, useCallback, useEffect } from "react";
import {
  RotateCcw,
  Trophy,
  Lightbulb,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Shuffle,
  Layers,
  Sparkles,
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
  shuffleFlashcards,
  type FlashcardDeckData,
  type FlashcardItem,
} from "./flashcard-types";

function FlashcardGameContent({
  deck,
  onClose,
}: {
  deck: FlashcardDeckData;
  onClose: () => void;
}) {
  const [cards, setCards] = useState<FlashcardItem[]>(() =>
    shuffleFlashcards(deck.cards)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Répétition active
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [toReviewIds, setToReviewIds] = useState<Set<string>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);

  const totalCards = cards.length;
  const currentCard = cards[currentIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    setShowHint(false);
  }, []);

  const handleRate = (status: "mastered" | "toReview") => {
    if (!currentCard) return;

    if (status === "mastered") {
      setMasteredIds((prev) => {
        const next = new Set(prev);
        next.add(currentCard.id);
        return next;
      });
      setToReviewIds((prev) => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
    } else {
      setToReviewIds((prev) => {
        const next = new Set(prev);
        next.add(currentCard.id);
        return next;
      });
      setMasteredIds((prev) => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
    }

    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setShowHint(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      setShowHint(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setShowHint(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setCards(shuffleFlashcards(deck.cards));
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setMasteredIds(new Set());
    setToReviewIds(new Set());
    setIsCompleted(false);
  };

  const handleReviewDifficultOnly = () => {
    const unmastered = deck.cards.filter((c) => toReviewIds.has(c.id));
    if (unmastered.length === 0) return;
    setCards(shuffleFlashcards(unmastered));
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setIsCompleted(false);
  };

  // Raccourci barre d'espace
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;
      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCompleted, handleFlip]);

  const masteredCount = masteredIds.size;
  const toReviewCount = toReviewIds.size;
  const progressPercent =
    totalCards > 0 ? Math.round(((currentIndex + 1) / totalCards) * 100) : 0;
  const masteryPercent =
    totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  const displayTitle = (() => {
    let t = (deck.title || "").trim();
    t = t.replace(
      /^(?:flashcards?|cartes?\s*(?:de\s*r[ée]vision)?)\s*[:—–-]\s*/i,
      ""
    );
    if (!t || /sans titre/i.test(t) || t.toLowerCase() === "flashcards") {
      return deck.topic ? deck.topic : "Cartes de révision";
    }
    return t;
  })();

  return (
    <>
      {/* En-tête moderne épuré */}
      <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-3 pr-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary border border-primary/25 shadow-2xs">
              <Layers className="size-4.5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-sans text-sm sm:text-base font-semibold text-foreground tracking-tight truncate">
                {displayTitle}
              </DialogTitle>
              {deck.pageTitle && (
                <p className="text-xs text-muted-foreground truncate">
                  Cours : {deck.pageTitle}
                </p>
              )}
            </div>
          </div>

          <Badge
            variant="secondary"
            className="text-xs font-semibold px-2.5 py-1 bg-muted/70 text-foreground border border-border/60 rounded-lg shrink-0"
          >
            {currentIndex + 1} / {totalCards}
          </Badge>
        </div>

        {/* Barre de progression fluide avec lueur */}
        <div className="w-full bg-muted/70 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-out rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </DialogHeader>

      {/* Corps principal : Carte ou Bilan */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!isCompleted ? (
          <div className="space-y-5 max-w-lg mx-auto">
            {/* EFFET DE PILE DE CARTES + CARTE PRINCIPALE 3D */}
            <div className="relative w-full [perspective:1000px] select-none py-1.5">
              {/* Carte superposée arrière 2 */}
              <div className="absolute inset-x-5 -bottom-2.5 h-full rounded-3xl bg-muted/30 border border-border/30 -z-20 pointer-events-none" />
              {/* Carte superposée arrière 1 */}
              <div className="absolute inset-x-2.5 -bottom-1 h-full rounded-3xl bg-muted/60 border border-border/50 -z-10 pointer-events-none" />

              {/* Carte principale */}
              <div
                onClick={handleFlip}
                className={`relative w-full min-h-[260px] sm:min-h-[300px] rounded-3xl border transition-all duration-500 cursor-pointer shadow-md [transform-style:preserve-3d] ${
                  isFlipped
                    ? "[transform:rotateY(180deg)] border-emerald-500/40 bg-gradient-to-b from-card via-card/95 to-emerald-500/5 shadow-emerald-500/5"
                    : "border-border/90 bg-gradient-to-b from-card via-card/95 to-muted/20 hover:border-primary/50 shadow-black/5 hover:shadow-lg"
                }`}
              >
                {/* Face Recto (Question / Notion) */}
                <div
                  className={`absolute inset-0 p-6 flex flex-col justify-between [backface-visibility:hidden] ${
                    isFlipped ? "pointer-events-none" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                      <span>Recto · Question</span>
                    </span>

                    {currentCard.hint && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHint((prev) => !prev);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                      >
                        <Lightbulb className="size-3.5" />
                        <span>{showHint ? "Masquer l'indice" : "Indice"}</span>
                      </button>
                    )}
                  </div>

                  <div className="my-auto py-4 text-center">
                    <h3 className="font-sans text-lg sm:text-xl font-semibold text-foreground leading-relaxed tracking-tight">
                      {currentCard.front}
                    </h3>

                    {showHint && currentCard.hint && (
                      <div className="mt-4 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs text-left animate-in fade-in-50 duration-200">
                        <span className="font-semibold block mb-0.5">💡 Indice :</span>
                        <p className="leading-relaxed">{currentCard.hint}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 text-muted-foreground text-xs font-medium hover:text-foreground transition-colors">
                      <RotateCcw className="size-3 text-primary animate-pulse" />
                      <span>Cliquer ou barre Espace pour retourner</span>
                    </span>
                  </div>
                </div>

                {/* Face Verso (Réponse / Définition) */}
                <div
                  className={`absolute inset-0 p-6 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    !isFlipped ? "pointer-events-none" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span>Verso · Réponse</span>
                    </span>

                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-md">
                      <Eye className="size-3 text-emerald-500" /> Dévoilée
                    </span>
                  </div>

                  <div className="my-auto py-4 text-center">
                    <p className="font-sans text-base sm:text-lg font-normal text-foreground leading-relaxed">
                      {currentCard.back}
                    </p>
                  </div>

                  <div className="flex items-center justify-center pt-1 text-xs text-muted-foreground">
                    <span>Évaluez votre mémorisation ci-dessous</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CONTRÔLES D'ÉVALUATION LORSQUE RETOURNÉE */}
            {isFlipped ? (
              <div className="grid grid-cols-2 gap-3 pt-2 animate-in fade-in-50 duration-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRate("toReview")}
                  className="gap-2 text-xs sm:text-sm font-semibold h-11 rounded-2xl border-2 border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50 shadow-xs cursor-pointer"
                >
                  <X className="size-4 text-rose-500" />
                  <span>À revoir (Pas su)</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRate("mastered")}
                  className="gap-2 text-xs sm:text-sm font-semibold h-11 rounded-2xl border-2 border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 shadow-xs cursor-pointer"
                >
                  <Check className="size-4 text-emerald-500" />
                  <span>Maîtrisé (Bien su)</span>
                </Button>
              </div>
            ) : (
              /* CONTRÔLES DE NAVIGATION */
              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="gap-1 text-xs h-9 px-3.5 rounded-xl"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Précédente</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleFlip}
                  className="gap-1.5 text-xs font-semibold h-9 px-4 rounded-xl shadow-xs"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Retourner la carte</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  className="gap-1 text-xs h-9 px-3.5 rounded-xl"
                >
                  <span>Suivante</span>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* ================= ÉCRAN DE BILAN MODERNE ================= */
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-6 max-w-lg mx-auto animate-in zoom-in-95 duration-200">
            {/* Indicateur de score circulaire / Squircle */}
            <div className="relative">
              <div className="size-18 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-lg">
                <Trophy className="size-9 animate-bounce [animation-iteration-count:2]" />
              </div>
              <div className="absolute -bottom-2 -right-2 size-7 rounded-full bg-background border border-emerald-500/40 flex items-center justify-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shadow-xs">
                {masteryPercent}%
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {masteredCount === totalCards
                  ? "Score Parfait ! 🎉"
                  : masteryPercent >= 70
                  ? "Excellente rétention ! 👏"
                  : "Session terminée ! 💪"}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Tu as assimilé{" "}
                <strong className="text-foreground font-semibold">
                  {masteredCount} sur {totalCards}
                </strong>{" "}
                notions clés ({masteryPercent}% de réussite).
              </p>
            </div>

            {/* Récapitulatif carte par carte stylisé */}
            <div className="w-full max-h-56 overflow-y-auto space-y-2 text-left border border-border/60 rounded-2xl p-3 bg-muted/20">
              {cards.map((c, i) => {
                const isOk = masteredIds.has(c.id);
                return (
                  <div
                    key={c.id || i}
                    className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl bg-card border border-border/40 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="size-5 rounded-md bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate text-foreground/90 font-medium">
                        {c.front}
                      </span>
                    </div>

                    {isOk ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="size-3" /> Maîtrisé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-rose-500 font-semibold shrink-0 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                        <X className="size-3" /> À revoir
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Boutons d'action harmonieux */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 w-full">
              {toReviewCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleReviewDifficultOnly}
                  className="gap-1.5 text-xs font-semibold h-9.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>
                    {toReviewCount === 1
                      ? "Revoir la carte à consolider"
                      : `Revoir les ${toReviewCount} cartes à consolider`}
                  </span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
                className="gap-1.5 text-xs font-medium h-9.5 px-4 rounded-xl border-border/80 hover:bg-muted/60"
              >
                <Shuffle className="size-3.5 text-primary" />
                <span>Recommencer tout</span>
              </Button>

              <Button
                size="sm"
                onClick={onClose}
                className="text-xs font-semibold h-9.5 px-5 rounded-xl shadow-xs"
              >
                Terminer
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pied de page */}
      <div className="p-3.5 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
          Fermer
        </Button>

        <div className="text-xs text-muted-foreground flex items-center gap-3">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {masteredCount} maîtrisée(s)
          </span>
          {toReviewCount > 0 && (
            <span className="text-rose-500 font-medium">
              {toReviewCount} à revoir
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export function FlashcardPlayer({
  deck,
  isOpen,
  onClose,
}: {
  deck: FlashcardDeckData | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!deck || !deck.cards || deck.cards.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-xl p-0 overflow-hidden border border-border/80 bg-background shadow-2xl rounded-3xl flex flex-col max-h-[90vh] z-[100]">
        {isOpen && (
          <FlashcardGameContent
            key={`${deck.id}-${isOpen ? "open" : "closed"}`}
            deck={deck}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
