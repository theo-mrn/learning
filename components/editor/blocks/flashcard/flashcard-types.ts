import type { FlashcardItem } from "@/components/flashcard/flashcard-types";

export const FLASHCARD_DEFAULT_TITLE = "Cartes de révision";

export type FlashcardBlockAttributes = {
  title: string;
  topic?: string;
  cards: FlashcardItem[];
};
