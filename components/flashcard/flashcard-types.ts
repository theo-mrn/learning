export type FlashcardItem = {
  id: string;
  front: string;
  back: string;
  hint?: string;
};

export type FlashcardDeckData = {
  id: string;
  title: string;
  description?: string | null;
  topic?: string | null;
  pageId?: string | null;
  pageTitle?: string | null;
  cards: FlashcardItem[];
  createdAt?: string;
};

export const FLASHCARD_DEFAULT_TITLE = "Cartes de révision";

/**
 * Mélange aléatoire (Fisher-Yates) d'un tableau de flashcards
 */
export function shuffleFlashcards(cards: FlashcardItem[]): FlashcardItem[] {
  if (!cards || cards.length === 0) return [];
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
