"use client";

import { Play, Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FlashcardDeckData } from "./flashcard-types";

export function FlashcardCard({
  deck,
  onStart,
  onInsert,
}: {
  deck: FlashcardDeckData;
  onStart: (deck: FlashcardDeckData) => void;
  onInsert?: (deck: FlashcardDeckData) => void;
}) {
  let cleanTitle = (deck.title || "").trim();
  cleanTitle = cleanTitle.replace(
    /^(?:flashcards?|cartes?\s*(?:de\s*r[ée]vision)?)\s*[:—–-]\s*/i,
    ""
  );
  if (
    !cleanTitle ||
    /sans titre/i.test(cleanTitle) ||
    cleanTitle.toLowerCase() === "flashcards"
  ) {
    cleanTitle = deck.topic ? deck.topic : "Cartes de révision";
  }

  const cardCount = deck.cards?.length || 0;

  return (
    <div className="my-2 rounded-xl border border-primary/30 bg-card p-3 shadow-xs transition-all hover:border-primary/60">
      {/* Ligne principale : Icône + Titre & Métadonnées alignés */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary border border-primary/25 shadow-2xs">
          <Layers className="size-4.5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold px-2 py-0.5 rounded-md"
            >
              {cardCount} {cardCount > 1 ? "cartes mémo" : "carte mémo"}
            </Badge>

            {deck.topic && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md truncate max-w-[140px]">
                {deck.topic}
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

      {/* Barre d'actions en bas : boutons équilibrés et alignés */}
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
            onClick={() => onInsert(deck)}
            title="Insérer ce paquet sous forme de bloc interactif dans votre cours"
            className="gap-1.5 text-xs font-medium h-8 rounded-lg border-border/80 hover:bg-muted/70 text-muted-foreground hover:text-foreground shadow-2xs justify-center cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Insérer</span>
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={() => onStart(deck)}
          className="gap-1.5 text-xs font-semibold h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs justify-center cursor-pointer"
        >
          <Play className="size-3.5 fill-current" />
          <span>S&apos;entraîner</span>
        </Button>
      </div>
    </div>
  );
}
