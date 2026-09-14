export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export type QuizDifficulty = "easy" | "medium" | "hard";

export type QuizData = {
  id: string;
  title: string;
  description?: string | null;
  difficulty?: QuizDifficulty;
  topic?: string | null;
  pageId?: string | null;
  pageTitle?: string | null;
  questions: QuizQuestion[];
  createdAt?: string;
};

export type QuizAttemptData = {
  id: string;
  quizId: string;
  score: number;
  total: number;
  answers: Record<number, number>;
  createdAt: string;
};

/**
 * Mélange aléatoire (Fisher-Yates) d'un tableau générique
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Mélange l'ordre des questions ET l'ordre des options de chaque question
 * tout en recalculant précisément l'indice `correctAnswer`.
 */
export function shuffleQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  if (!questions || questions.length === 0) return [];

  // 1. Mélange des options pour chaque question
  const questionsWithOptionsShuffled = questions.map((q) => {
    if (!q.options || q.options.length <= 1) return q;

    const indexedOptions = q.options.map((opt, index) => ({
      opt,
      isCorrect: index === q.correctAnswer,
    }));

    const shuffledIndexed = shuffleArray(indexedOptions);
    const newOptions = shuffledIndexed.map((item) => item.opt);
    const newCorrectIndex = shuffledIndexed.findIndex((item) => item.isCorrect);

    return {
      ...q,
      options: newOptions,
      correctAnswer: newCorrectIndex >= 0 ? newCorrectIndex : 0,
    };
  });

  // 2. Mélange de l'ordre des questions
  return shuffleArray(questionsWithOptionsShuffled);
}
