"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Square,
  BookOpen,
  Copy,
  Check,
  ArrowDownToLine,
  Lightbulb,
  FileQuestion,
  KeyRound,
  FileText,
  Loader2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAIAssistant } from "./ai-assistant-context";
import { AIMarkdown } from "./ai-markdown";
import { QuizCard } from "@/components/quiz/quiz-card";
import { QuizPlayer } from "@/components/quiz/quiz-player";
import type { QuizData, QuizDifficulty } from "@/components/quiz/quiz-types";
import { FlashcardCard } from "@/components/flashcard/flashcard-card";
import { FlashcardPlayer } from "@/components/flashcard/flashcard-player";
import type { FlashcardDeckData } from "@/components/flashcard/flashcard-types";
import { toast } from "sonner";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  quiz?: QuizData;
  flashcardDeck?: FlashcardDeckData;
};

type QuickAction = {
  icon: typeof BookOpen;
  label: string;
  prompt: string;
  isQuiz?: boolean;
  isFlashcards?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: FileQuestion,
    label: "Créer un quiz interactif (5 questions)",
    prompt: "Génère un quiz d'évaluation interactif pour tester ma compréhension de ce cours.",
    isQuiz: true,
  },
  {
    icon: BookOpen,
    label: "Générer des flashcards (5 cartes)",
    prompt: "Génère 5 flashcards de révision interactives sur ce cours.",
    isFlashcards: true,
  },
  {
    icon: BookOpen,
    label: "Résumer ce cours",
    prompt:
      "Peux-tu me faire un résumé clair, synthétique et structuré de ce cours avec les points capitaux à retenir ?",
  },
  {
    icon: Lightbulb,
    label: "Expliquer simplement",
    prompt:
      "Explique-moi les concepts essentiels de ce cours comme si j'étais débutant, avec des analogies concrètes et intuitives.",
  },
  {
    icon: KeyRound,
    label: "Points clés & définitions",
    prompt:
      "Extrais une fiche de révision contenant les définitions clés et le vocabulaire technique indispensable présent dans ce document.",
  },
];

/** Détecte les intentions de création ou de continuation de quiz dans les messages */
function parseQuizIntent(
  text: string,
  lastQuiz?: QuizData | null
): {
  isQuiz: boolean;
  count: number;
  difficulty: QuizDifficulty;
  topic?: string;
} {
  const t = text.toLowerCase().trim();

  // Exclusion des questions posées par l'utilisateur au tuteur ("j'ai une question...")
  const isConversationalQuestion =
    /(?:j'ai|j ai|une simple|j'aurais)\s+une\s+question/i.test(t);

  if (isConversationalQuestion) {
    return { isQuiz: false, count: 5, difficulty: "medium" };
  }

  // Détection du nombre de questions demandé (ex: "2 de plus", "encore 3", "5 questions")
  let count = 5;
  const countMatch =
    t.match(
      /(\d+)\s*(?:questions?|de plus|en plus|autres?|supplémentaires?|qcm|quiz)?/i
    ) ||
    t.match(/(?:quiz|qcm)\s*(?:de\s*)?(\d+)/i) ||
    t.match(
      /(?:ajoute|rajoute|donne|mets|génère|fais)[-\s]*(?:moi\s+)?(?:en\s+)?(\d+)/i
    ) ||
    t.match(/\b(une?)\s+question/i);

  if (countMatch) {
    if (/une?\s+question/i.test(countMatch[0])) {
      count = 1;
    } else if (countMatch[1]) {
      const parsed = parseInt(countMatch[1], 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) count = parsed;
    }
  }

  // Niveau de difficulté (tolérant aux fautes de frappe comme 'dificilles')
  let difficulty: QuizDifficulty = lastQuiz?.difficulty || "medium";
  if (
    /(di[f]+i[c]+i[l]+|dur|dure|avanc[eé]|compliqu[eé]|expert|pi[eèê]g|cors[eé]|pointu|complexe|hard)/i.test(
      t
    )
  ) {
    difficulty = "hard";
  } else if (/(facil|simple|d[eé]butant|base|basique|intro|easy)/i.test(t)) {
    difficulty = "easy";
  } else if (/(moyen|interm[eé]diaire|standard|normal|medium)/i.test(t)) {
    difficulty = "medium";
  }

  // Thème ou focus spécifique (hérite de lastQuiz si aucun nouveau thème n'est mentionné)
  let topic: string | undefined = lastQuiz?.topic || undefined;
  const topicMatch = t.match(
    /(?:sur|à propos de|contenant|focus|chapitre)\s+([^.?!,()]+)/i
  );
  if (topicMatch && topicMatch[1]) {
    const rawTopic = topicMatch[1].replace(/[«»"']/g, "").trim();
    if (rawTopic && !/sans titre/i.test(rawTopic) && !/^quiz/i.test(rawTopic)) {
      topic = rawTopic;
    }
  }

  // Si un quiz a déjà eu lieu dans la conversation et que l'utilisateur enchaîne
  if (lastQuiz) {
    const isContinuation =
      /\b\d+\b/.test(t) || // tout message avec un chiffre (ex: "2", "2 de plus", "encore 2")
      /(encore|autre|autres|suite|plus|rajoute|ajoute|recommence|difficile|facile|expert)/i.test(
        t
      );
    if (isContinuation) {
      return { isQuiz: true, count, difficulty, topic };
    }
  }

  // Est-ce une intention de quiz générale ?
  const isQuiz =
    t.includes("quiz") ||
    t.includes("qcm") ||
    /\b\d+\s+(?:de plus|en plus|autres?|questions?|supplémentaires?)/i.test(
      t
    ) ||
    /(?:pose|fais|génère|donne|crée|ajoute|rajoute|lance)[-\s]*(?:moi\s+)?(?:en\s+)?(?:une|\d+)?\s*questions?/i.test(
      t
    ) ||
    /\b(?:1|2|3|4|5|6|7|8|9|10|une|des)\s+questions?\b/i.test(t) ||
    /(?:encore|autre|suite|plus de questions)/i.test(t) ||
    /(teste-moi|test-moi|interroge-moi|auto-évaluation|auto-evaluation|évalue-moi|entraîne-moi|entraine-moi)/i.test(
      t
    ) ||
    /(?:question|questions)\s+(?:expert|di[f]+i[c]+i[l]+|dur|avanc[eé]|facil|simple|interm[eé]diaire)/i.test(
      t
    );

  return { isQuiz, count, difficulty, topic };
}

function parseFlashcardIntent(
  text: string,
  lastDeck?: FlashcardDeckData | null
): {
  isFlashcards: boolean;
  count: number;
  topic?: string;
} {
  const t = text.toLowerCase().trim();

  let count = 5;
  const countMatch =
    t.match(/(\d+)\s*(?:flashcards?|cartes?|fiches?|m[eé]mos?)?/i) ||
    t.match(/(?:flashcards?|cartes?|fiches?)\s*(?:de\s*)?(\d+)/i) ||
    t.match(
      /(?:ajoute|rajoute|donne|mets|génère|fais)[-\s]*(?:moi\s+)?(?:en\s+)?(\d+)/i
    );

  if (countMatch && countMatch[1]) {
    const parsed = parseInt(countMatch[1], 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 25) count = parsed;
  }

  let topic: string | undefined = lastDeck?.topic || undefined;
  const topicMatch = t.match(
    /(?:sur|à propos de|contenant|focus|chapitre)\s+([^.?!,()]+)/i
  );
  if (topicMatch && topicMatch[1]) {
    const rawTopic = topicMatch[1].replace(/[«»"']/g, "").trim();
    if (
      rawTopic &&
      !/sans titre/i.test(rawTopic) &&
      !/^flashcard/i.test(rawTopic) &&
      !/^carte/i.test(rawTopic)
    ) {
      topic = rawTopic;
    }
  }

  if (lastDeck) {
    const isContinuation =
      /\b\d+\b/.test(t) ||
      /(encore|autre|autres|suite|plus|rajoute|ajoute|recommence)/i.test(t);
    if (
      isContinuation &&
      (t.includes("carte") || t.includes("flashcard") || t.includes("fiche"))
    ) {
      return { isFlashcards: true, count, topic };
    }
  }

  const isFlashcards =
    t.includes("flashcard") ||
    t.includes("flash-card") ||
    t.includes("flash card") ||
    /\bcartes?\s+(?:de\s+)?(?:r[eé]vision|m[eé]mo|m[eé]morisation)/i.test(t) ||
    /\b(?:fiches?|cartes?)\s+(?:m[eé]mo|anki|leitner)/i.test(t) ||
    /(?:génère|crée|fais)[-\s]*(?:moi\s+)?(?:des|\d+)?\s*(?:flashcards?|cartes?)/i.test(
      t
    );

  return { isFlashcards, count, topic };
}

export function AIAssistantPanel() {
  const {
    isOpen,
    setIsOpen,
    pageContext,
    insertIntoEditor,
    insertQuizIntoEditor,
    insertFlashcardsIntoEditor,
  } = useAIAssistant();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // État du lecteur de quiz interactif
  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [isQuizPlayerOpen, setIsQuizPlayerOpen] = useState(false);

  // État du lecteur de flashcards interactif
  const [activeFlashcardDeck, setActiveFlashcardDeck] =
    useState<FlashcardDeckData | null>(null);
  const [isFlashcardPlayerOpen, setIsFlashcardPlayerOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus automatique du textarea à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    handleStop();
    setMessages([]);
    setInput("");
    toast.success("Conversation supprimée");
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Impossible de copier le texte.");
    }
  };

  const handleInsert = (text: string) => {
    if (insertIntoEditor) {
      insertIntoEditor(text);
      toast.success("Contenu inséré dans le cours !");
    } else {
      toast.info("L'éditeur de cours n'est pas actif pour l'insertion.");
    }
  };

  /** Génère un Quiz interactif stocké en base de données avec paramètres */
  const handleGenerateQuiz = async (options?: {
    count?: number;
    difficulty?: QuizDifficulty;
    topic?: string;
    customPromptText?: string;
  }) => {
    if (isGeneratingQuiz || isLoading) return;

    const count = options?.count ?? 5;
    const difficulty = options?.difficulty ?? "medium";
    const topic = options?.topic;
    const courseContent = pageContext?.content?.trim() || "";
    const courseTitle =
      pageContext?.title?.trim() || options?.topic || "Révision générale";

    // Récupération des questions de tous les quiz précédents pour éviter les doublons
    const previousQuestions = messages
      .filter((m) => m.quiz)
      .flatMap((m) => m.quiz?.questions.map((q) => q.question) || []);

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();

    const difficultyLabel =
      difficulty === "hard"
        ? "avancé"
        : difficulty === "easy"
        ? "facile"
        : "intermédiaire";

    const promptDescription =
      options?.customPromptText ||
      `Génère un quiz interactif de ${count} questions (${difficultyLabel})${
        topic ? ` sur "${topic}"` : ""
      }${previousQuestions.length > 0 ? " avec de nouvelles questions" : ""}.`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content: promptDescription,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: `🧠 Préparation de votre quiz (${count} question${
          count > 1 ? "s" : ""
        })...`,
      },
    ]);

    setIsGeneratingQuiz(true);

    try {
      const response = await fetch("/api/ai/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageContext?.id,
          pageTitle: courseTitle,
          pageContent: courseContent,
          count,
          difficulty,
          topic,
          previousQuestions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Impossible de générer le quiz.");
      }

      const data = await response.json();
      const quiz: QuizData = data.quiz;

      const questionCountLabel = `${quiz.questions.length} question${
        quiz.questions.length > 1 ? "s" : ""
      }`;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `Votre quiz est prêt (${questionCountLabel}) !`,
                quiz,
              }
            : m
        )
      );

      toast.success("Quiz prêt à être lancé !");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la création du quiz.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `⚠️ *Impossible de générer le quiz : ${message}*`,
              }
            : m
        )
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleGenerateFlashcards = async ({
    count = 5,
    topic,
    customPromptText,
  }: {
    count?: number;
    topic?: string;
    customPromptText?: string;
  }) => {
    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();

    const courseTitle = pageContext?.title || "Cours actif";
    const courseContent = pageContext?.content || "";

    const previousCards: string[] = messages
      .flatMap((m) => m.flashcardDeck?.cards || [])
      .map((c) => c.front);

    const promptDescription =
      customPromptText ||
      `Génère un paquet de ${count} flashcards${topic ? ` sur "${topic}"` : ""}.`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content: promptDescription,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: `🎴 Préparation de vos flashcards (${count} cartes)...`,
      },
    ]);

    setIsGeneratingFlashcards(true);

    try {
      const response = await fetch("/api/ai/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageContext?.id,
          pageTitle: courseTitle,
          pageContent: courseContent,
          count,
          topic,
          previousCards,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Impossible de générer les flashcards."
        );
      }

      const data = await response.json();
      const deck: FlashcardDeckData = data.deck;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `Vos flashcards sont prêtes (${deck.cards.length} cartes) !`,
                flashcardDeck: deck,
              }
            : m
        )
      );

      toast.success("Flashcards prêtes pour la révision !");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la création des flashcards.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `⚠️ *Impossible de générer les flashcards : ${message}*`,
              }
            : m
        )
      );
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const sendMessage = async (contentToSend: string) => {
    const trimmed = contentToSend.trim();
    if (!trimmed || isLoading || isGeneratingQuiz || isGeneratingFlashcards)
      return;

    // Dernières flashcards générées dans l'historique
    const lastDeck =
      [...messages].reverse().find((m) => m.flashcardDeck)?.flashcardDeck ||
      null;

    // Détection intelligente de demande de flashcards
    const flashcardIntent = parseFlashcardIntent(trimmed, lastDeck);
    if (flashcardIntent.isFlashcards) {
      setInput("");
      await handleGenerateFlashcards({
        count: flashcardIntent.count,
        topic: flashcardIntent.topic,
        customPromptText: trimmed,
      });
      return;
    }

    // Dernier quiz généré dans l'historique de la conversation
    const lastQuiz =
      [...messages].reverse().find((m) => m.quiz)?.quiz || null;

    // Détection intelligente : si l'utilisateur demande un quiz ou une suite de quiz
    const quizIntent = parseQuizIntent(trimmed, lastQuiz);
    if (quizIntent.isQuiz) {
      setInput("");
      await handleGenerateQuiz({
        count: quizIntent.count,
        difficulty: quizIntent.difficulty,
        topic: quizIntent.topic,
        customPromptText: trimmed,
      });
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    // Création du placeholder pour la réponse de l'assistant
    const assistantMessageId = crypto.randomUUID();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
    };

    setMessages([...newMessages, assistantPlaceholder]);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          pageContext: pageContext
            ? {
                title: pageContext.title,
                content: pageContext.content,
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Erreur serveur (${response.status})`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Flux de réponse indisponible.");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        // Interception automatique si l'IA émet une commande de quiz
        if (accumulated.includes("[ACTION:QUIZ:")) {
          const actionMatch = accumulated.match(/\[ACTION:QUIZ:(\{.*?\})\]/);
          if (actionMatch) {
            controller.abort();
            abortControllerRef.current = null;
            setIsLoading(false);

            try {
              const actionData = JSON.parse(actionMatch[1]);
              // Retrait immédiat du message temporaire de l'assistant
              setMessages((prev) =>
                prev.filter((m) => m.id !== assistantMessageId)
              );
              // Génération directe du vrai quiz interactif
              await handleGenerateQuiz({
                count: actionData.count || 5,
                difficulty:
                  actionData.difficulty || lastQuiz?.difficulty || "medium",
                topic: actionData.topic || lastQuiz?.topic || undefined,
                customPromptText: trimmed,
              });
              return;
            } catch (err) {
              console.error("Erreur parsing action quiz:", err);
            }
          }
          // Masquage du tag pendant la réception
          continue;
        }

        const currentText = accumulated;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: currentText } : m
          )
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message =
        err instanceof Error ? err.message : "Erreur de communication avec l'IA.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content:
                  m.content.length > 0
                    ? `${m.content}\n\n⚠️ *Génération interrompue : ${message}*`
                    : `⚠️ *Une erreur est survenue : ${message}*`,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 flex flex-col gap-0 border-l border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl"
        >
          {/* En-tête du volet */}
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 bg-muted/20">
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-xs">
                  <Sparkles className="size-4 animate-pulse" />
                </div>
                <div>
                  <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                    Assistant Tuteur IA
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase font-bold tracking-wider">
                      DeepSeek
                    </span>
                  </SheetTitle>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleClear}
                    title="Supprimer la conversation"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Supprimer la conversation</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Badge de contexte du cours */}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground overflow-hidden">
              {pageContext &&
              pageContext.title &&
              pageContext.title.trim().toLowerCase() !== "sans titre" ? (
                <Badge
                  variant="secondary"
                  className="max-w-full truncate flex items-center gap-1.5 font-normal py-1 px-2.5 text-[11px] bg-muted/80 text-foreground"
                >
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0 animate-ping" />
                  <FileText className="size-3 shrink-0 text-primary" />
                  <span className="truncate font-medium">
                    {pageContext.title}
                  </span>
                </Badge>
              ) : pageContext ? (
                <Badge
                  variant="secondary"
                  className="max-w-full truncate flex items-center gap-1.5 font-normal py-1 px-2.5 text-[11px] bg-muted/80 text-foreground"
                >
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <FileText className="size-3 shrink-0 text-primary" />
                  <span>Document actif</span>
                </Badge>
              ) : (
                <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                  Mode conversation libre
                </span>
              )}
            </div>
          </SheetHeader>

          {/* Corps de la conversation */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center space-y-4">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                  <Sparkles className="size-6" />
                </div>

                <div className="max-w-xs space-y-1.5">
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    Que souhaites-tu travailler ?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {pageContext ? (
                      <>
                        {pageContext.title &&
                        pageContext.title.trim().toLowerCase() !== "sans titre" ? (
                          <>
                            J&apos;ai analysé votre cours{" "}
                            <strong>« {pageContext.title} »</strong>.{" "}
                          </>
                        ) : (
                          <>J&apos;ai analysé votre document actif. </>
                        )}
                        Posez-moi des questions, demandez un résumé ou lancez un
                        quiz interactif !
                      </>
                    ) : (
                      "Ouvrez un cours ou posez-moi n'importe quelle question pour réviser et approfondir vos connaissances."
                    )}
                  </p>
                </div>

                {/* Suggestions rapides */}
                <div className="w-full space-y-2 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Actions suggérées
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-left">
                    {QUICK_ACTIONS.map((action, idx) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={
                            isGeneratingQuiz ||
                            isGeneratingFlashcards ||
                            isLoading
                          }
                          onClick={() => {
                            if (action.isQuiz) {
                              void handleGenerateQuiz();
                            } else if (action.isFlashcards) {
                              void handleGenerateFlashcards({ count: 5 });
                            } else {
                              void sendMessage(action.prompt);
                            }
                          }}
                          className={`group flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all duration-150 hover:border-primary/50 hover:bg-muted/50 hover:shadow-xs ${
                            action.isQuiz || action.isFlashcards
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/70 bg-card"
                          }`}
                        >
                          <div
                            className={`size-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              action.isQuiz || action.isFlashcards
                                ? "bg-primary/20 text-primary"
                                : "bg-muted group-hover:bg-primary/15 group-hover:text-primary"
                            }`}
                          >
                            <Icon className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                              {action.label}
                              {(action.isQuiz || action.isFlashcards) && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary font-bold uppercase"
                                >
                                  Interactif
                                </Badge>
                              )}
                            </span>
                            <span className="block text-[11px] text-muted-foreground line-clamp-1">
                              {action.prompt}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isUser ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          isUser
                            ? "bg-primary text-primary-foreground font-normal rounded-tr-xs shadow-xs"
                            : "bg-muted/70 text-foreground border border-border/60 rounded-tl-xs shadow-2xs"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        ) : msg.content ? (
                          <div className="space-y-1.5">
                            {msg.quiz || msg.flashcardDeck ? (
                              <p className="text-sm font-medium text-foreground py-0.5">
                                {msg.content}
                              </p>
                            ) : (
                              <AIMarkdown content={msg.content} />
                            )}

                            {/* Carte du Quiz interactif généré */}
                            {msg.quiz && (
                              <QuizCard
                                quiz={msg.quiz}
                                onStart={(q) => {
                                  setActiveQuiz(q);
                                  setIsQuizPlayerOpen(true);
                                }}
                                onInsert={
                                  insertQuizIntoEditor
                                    ? (q) => {
                                        insertQuizIntoEditor(q);
                                        toast.success(
                                          "Bloc Quiz inséré dans votre cours !"
                                        );
                                      }
                                    : undefined
                                }
                              />
                            )}

                            {/* Carte du paquet de Flashcards généré */}
                            {msg.flashcardDeck && (
                              <FlashcardCard
                                deck={msg.flashcardDeck}
                                onStart={(d) => {
                                  setActiveFlashcardDeck(d);
                                  setIsFlashcardPlayerOpen(true);
                                }}
                                onInsert={
                                  insertFlashcardsIntoEditor
                                    ? (d) => {
                                        insertFlashcardsIntoEditor(d);
                                        toast.success(
                                          "Bloc Flashcards inséré dans votre cours !"
                                        );
                                      }
                                    : undefined
                                }
                              />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                            <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                            <span className="size-1.5 rounded-full bg-primary animate-bounce" />
                          </div>
                        )}
                      </div>

                      {/* Actions sur les messages de l'assistant */}
                      {!isUser && msg.content && (
                        <div className="mt-1 flex items-center gap-1 text-muted-foreground px-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            title="Copier la réponse"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === msg.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>

                          {insertIntoEditor && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleInsert(msg.content)}
                              title="Insérer dans le document du cours"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            >
                              <ArrowDownToLine className="size-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Zone de saisie */}
          <div className="shrink-0 border-t border-border/60 p-3 bg-card/60">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(input);
              }}
              className="relative flex flex-col gap-2 rounded-xl border border-border/80 bg-background p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all shadow-2xs"
            >
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  pageContext
                    ? `Pose une question, écris "5 de plus", "quiz difficile"...`
                    : "Pose une question à ton tuteur..."
                }
                className="w-full resize-none bg-transparent px-1 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none leading-relaxed"
              />

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground/80 hidden sm:inline">
                  Entrée pour envoyer · &quot;5 de plus&quot;, &quot;quiz difficile&quot;...
                </span>

                <div className="flex items-center gap-1.5 ml-auto">

                  {isLoading || isGeneratingQuiz ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleStop}
                      className="h-7 px-2.5 text-xs gap-1"
                    >
                      {isGeneratingQuiz || isGeneratingFlashcards ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Square className="size-3 fill-current" />
                      )}
                      <span>
                        {isGeneratingQuiz
                          ? "Création du quiz..."
                          : isGeneratingFlashcards
                          ? "Création des cartes..."
                          : "Arrêter"}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!input.trim()}
                      className="h-7 px-3 text-xs gap-1 font-medium"
                    >
                      <span>Envoyer</span>
                      <Send className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lecteur de Quiz interactif */}
      <QuizPlayer
        quiz={activeQuiz}
        isOpen={isQuizPlayerOpen}
        onClose={() => setIsQuizPlayerOpen(false)}
      />

      {/* Lecteur de Flashcards interactif */}
      <FlashcardPlayer
        deck={activeFlashcardDeck}
        isOpen={isFlashcardPlayerOpen}
        onClose={() => setIsFlashcardPlayerOpen(false)}
      />
    </>
  );
}
