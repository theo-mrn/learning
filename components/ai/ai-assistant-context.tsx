"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type { QuizData } from "@/components/quiz/quiz-types";
import type { FlashcardDeckData } from "@/components/flashcard/flashcard-types";

export type PageContextData = {
  id?: string;
  title: string;
  content: string;
};

type AIAssistantContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  pageContext: PageContextData | null;
  setPageContext: (ctx: PageContextData | null) => void;
  insertIntoEditor: ((text: string) => void) | null;
  registerEditorInsert: (fn: ((text: string) => void) | null) => void;
  insertQuizIntoEditor: ((quiz: QuizData) => void) | null;
  registerEditorInsertQuiz: (fn: ((quiz: QuizData) => void) | null) => void;
  insertFlashcardsIntoEditor: ((deck: FlashcardDeckData) => void) | null;
  registerEditorInsertFlashcards: (
    fn: ((deck: FlashcardDeckData) => void) | null
  ) => void;
};

const AIAssistantContext = createContext<AIAssistantContextValue | null>(null);

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pageContext, setPageContext] = useState<PageContextData | null>(null);
  const [insertIntoEditor, setInsertIntoEditor] = useState<
    ((text: string) => void) | null
  >(null);
  const [insertQuizIntoEditor, setInsertQuizIntoEditor] = useState<
    ((quiz: QuizData) => void) | null
  >(null);
  const [insertFlashcardsIntoEditor, setInsertFlashcardsIntoEditor] = useState<
    ((deck: FlashcardDeckData) => void) | null
  >(null);

  const openAssistant = useCallback(() => setIsOpen(true), []);
  const closeAssistant = useCallback(() => setIsOpen(false), []);
  const toggleAssistant = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerEditorInsert = useCallback(
    (fn: ((text: string) => void) | null) => {
      setInsertIntoEditor(() => fn);
    },
    []
  );

  const registerEditorInsertQuiz = useCallback(
    (fn: ((quiz: QuizData) => void) | null) => {
      setInsertQuizIntoEditor(() => fn);
    },
    []
  );

  const registerEditorInsertFlashcards = useCallback(
    (fn: ((deck: FlashcardDeckData) => void) | null) => {
      setInsertFlashcardsIntoEditor(() => fn);
    },
    []
  );

  return (
    <AIAssistantContext.Provider
      value={{
        isOpen,
        setIsOpen,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        pageContext,
        setPageContext,
        insertIntoEditor,
        registerEditorInsert,
        insertQuizIntoEditor,
        registerEditorInsertQuiz,
        insertFlashcardsIntoEditor,
        registerEditorInsertFlashcards,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error(
      "useAIAssistant doit être utilisé au sein d'un AIAssistantProvider"
    );
  }
  return context;
}
