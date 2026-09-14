import type { QuizDifficulty, QuizQuestion } from "@/components/quiz/quiz-types";

export const QUIZ_DEFAULT_TITLE = "Quiz d'évaluation";

export type QuizBlockAttributes = {
  title: string;
  difficulty: QuizDifficulty;
  questions: QuizQuestion[];
};
