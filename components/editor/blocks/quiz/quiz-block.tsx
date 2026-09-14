"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Trophy,
  Trash2,
  MoreHorizontal,
  Loader2,
  Lightbulb,
  Plus,
  Play,
  SlidersHorizontal,
  Bookmark,
  Layers,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBlockEditable } from "../common/use-block-editable";
import { QUIZ_DEFAULT_TITLE } from "./quiz-types";
import {
  shuffleQuizQuestions,
  type QuizDifficulty,
  type QuizQuestion,
} from "@/components/quiz/quiz-types";
import { toast } from "sonner";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export function QuizBlockComponent({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: NodeViewProps) {
  const canEdit = useBlockEditable(editor);

  const title = (node.attrs.title as string) || QUIZ_DEFAULT_TITLE;
  const difficulty = (node.attrs.difficulty as QuizDifficulty) || "medium";
  const questions = (node.attrs.questions as QuizQuestion[]) || [];

  // Mode actif : "play" (jeu interactif) ou "settings" (configuration & ajout)
  const [activeTab, setActiveTab] = useState<"play" | "settings">(
    questions.length === 0 ? "settings" : "play"
  );

  // Sous-onglet de configuration : "ai-chapter" (génération IA) | "manual" (création) | "list" (liste)
  const [configSubTab, setConfigSubTab] = useState<"ai-chapter" | "manual" | "list">(
    "ai-chapter"
  );

  // État du formulaire de génération de chapitre
  const [chapterTopic, setChapterTopic] = useState("");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<QuizDifficulty>(difficulty);
  const [isGenerating, setIsGenerating] = useState(false);

  // Questions en jeu : ordre aléatoire des questions et placement aléatoire des options
  const [playQuestions, setPlayQuestions] = useState<QuizQuestion[]>(() =>
    shuffleQuizQuestions(questions)
  );

  // État du jeu
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Formulaire d'ajout manuel de question
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualOptions, setManualOptions] = useState<string[]>([
    "",
    "",
    "",
    "",
  ]);
  const [manualCorrectIndex, setManualCorrectIndex] = useState<number>(0);
  const [manualExplanation, setManualExplanation] = useState("");

  const activeQuestions =
    playQuestions.length > 0 ? playQuestions : questions;
  const totalQuestions = activeQuestions.length;
  const currentQuestion = activeQuestions[currentIndex];

  const handleSelectOption = (index: number) => {
    if (isAnswered || !currentQuestion) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === currentQuestion.correctAnswer) {
      setScore((prev) => prev + 1);
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

  // Lance ou relance une session de jeu avec un nouveau mélange aléatoire complet
  const handleStartPlay = (sourceQuestions?: QuizQuestion[]) => {
    const base = sourceQuestions ?? questions;
    setPlayQuestions(shuffleQuizQuestions(base));
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsCompleted(false);
    setActiveTab("play");
  };

  const handleRestart = () => {
    handleStartPlay();
  };

  // Ajout manuel d'une question
  const handleAddManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = manualQuestion.trim();
    if (!cleanQ) {
      toast.error("Veuillez saisir l'énoncé de la question.");
      return;
    }

    const filledOptions = manualOptions.map((opt) => opt.trim());
    if (filledOptions.some((opt) => !opt)) {
      toast.error("Veuillez renseigner les 4 options de réponse.");
      return;
    }

    const newQuestion: QuizQuestion = {
      id: crypto.randomUUID(),
      question: cleanQ,
      options: filledOptions,
      correctAnswer: manualCorrectIndex,
      explanation:
        manualExplanation.trim() || "Bonne réponse validée d'après le cours.",
    };

    const updated = [...questions, newQuestion];
    updateAttributes({
      questions: updated,
    });
    setPlayQuestions(shuffleQuizQuestions(updated));

    setManualQuestion("");
    setManualOptions(["", "", "", ""]);
    setManualCorrectIndex(0);
    setManualExplanation("");

    toast.success("Question ajoutée au quiz !");
  };

  // Suppression d'une question
  const handleDeleteQuestion = (id: string) => {
    const nextQuestions = questions.filter((q) => q.id !== id);
    updateAttributes({ questions: nextQuestions });
    setPlayQuestions((prev) => prev.filter((q) => q.id !== id));
    if (currentIndex >= nextQuestions.length) {
      setCurrentIndex(Math.max(0, nextQuestions.length - 1));
    }
    toast.info("Question supprimée");
  };

  // Génération du quiz de chapitre avec l'IA
  const handleGenerateChapterQuiz = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const pageText = editor.getText();
      const previousQuestions = questions.map((q) => q.question);

      const topicInstruction = chapterTopic.trim();
      const derivedTitle = topicInstruction
        ? topicInstruction.toLowerCase().startsWith("quiz")
          ? topicInstruction
          : `Quiz — ${topicInstruction}`
        : title !== QUIZ_DEFAULT_TITLE
        ? title
        : "Quiz de révision";

      const response = await fetch("/api/ai/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageTitle: derivedTitle,
          pageContent: pageText,
          count: questionCount,
          difficulty: selectedDifficulty,
          topic: topicInstruction || undefined,
          previousQuestions,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Échec de la génération.");
      }

      const data = await response.json();
      const generatedQuestions: QuizQuestion[] = data.quiz.questions || [];

      // Si le quiz contenait déjà des questions, on enrichit sans doublon
      const combined =
        questions.length > 0
          ? [...questions, ...generatedQuestions]
          : generatedQuestions;

      updateAttributes({
        questions: combined,
        title: derivedTitle,
        difficulty: selectedDifficulty,
      });

      handleStartPlay(combined);
      setChapterTopic("");
      toast.success(
        `Quiz généré avec succès (${generatedQuestions.length} questions) !`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur de génération";
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const difficultyBadge = (diff: QuizDifficulty) => {
    switch (diff) {
      case "easy":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium gap-1"
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Facile
          </Badge>
        );
      case "hard":
        return (
          <Badge
            variant="outline"
            className="border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-medium gap-1"
          >
            <span className="size-1.5 rounded-full bg-purple-500" />
            Avancé
          </Badge>
        );
      case "medium":
      default:
        return (
          <Badge
            variant="outline"
            className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[10px] font-medium gap-1"
          >
            <span className="size-1.5 rounded-full bg-sky-500" />
            Intermédiaire
          </Badge>
        );
    }
  };

  return (
    <NodeViewWrapper className="my-5 select-none">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-b from-card via-card/95 to-muted/20 shadow-sm overflow-hidden transition-all hover:border-primary/50">
        {/* ================= EN-TÊTE ULTRA-SOIGNÉ DU BLOC ================= */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-muted/25 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-2xs shrink-0">
              <GraduationCap className="size-4.5" />
            </div>

            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              {canEdit ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => updateAttributes({ title: e.target.value })}
                  placeholder="Titre du quiz (ex: Quiz — Chapitre 1)"
                  className="font-sans text-xs sm:text-sm font-semibold tracking-tight text-foreground bg-transparent border-none outline-none focus:underline truncate max-w-xs sm:max-w-md"
                />
              ) : (
                <h4 className="font-sans text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  {title}
                </h4>
              )}

              {totalQuestions > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold shrink-0"
                >
                  {totalQuestions} question{totalQuestions > 1 ? "s" : ""}
                </Badge>
              )}
              {difficultyBadge(difficulty)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Boutons d'alternance Mode Jeu vs Mode Réglages */}
            {canEdit && (
              <div className="flex items-center p-0.5 rounded-lg border border-border/80 bg-background/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleStartPlay()}
                  disabled={questions.length === 0}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "play"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground disabled:opacity-40"
                  }`}
                >
                  <Play className="size-3 fill-current" />
                  <span className="hidden sm:inline">Jouer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "settings"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <SlidersHorizontal className="size-3" />
                  <span className="hidden sm:inline">Configurer</span>
                </button>
              </div>
            )}

            {/* Menu d'actions rapides */}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Options du quiz"
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 text-xs">
                  {totalQuestions > 0 && (
                    <DropdownMenuItem onClick={handleRestart}>
                      <RotateCcw className="size-3.5 mr-2" />
                      <span>Recommencer le quiz</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      setActiveTab("settings");
                      setConfigSubTab("ai-chapter");
                    }}
                  >
                    <Sparkles className="size-3.5 mr-2 text-primary" />
                    <span>Générer un quiz de chapitre</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={deleteNode}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-2" />
                    <span>Supprimer ce bloc</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ================= CORPS DU BLOC ================= */}
        <div className="p-4 sm:p-5">
          {activeTab === "settings" ? (
            /* ================= MODE RÉGLAGES & AJOUT ================= */
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Onglets secondaires de configuration */}
              <div className="flex items-center gap-2 border-b border-border/60 pb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setConfigSubTab("ai-chapter")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    configSubTab === "ai-chapter"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  <span>Générer par chapitre (IA)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfigSubTab("manual")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    configSubTab === "manual"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Plus className="size-3.5" />
                  <span>Rédiger manuellement</span>
                </button>

                {totalQuestions > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfigSubTab("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      configSubTab === "list"
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Layers className="size-3.5" />
                    <span>Questions du quiz ({totalQuestions})</span>
                  </button>
                )}
              </div>

              {/* 1. GÉNÉRATION IA PAR CHAPITRE */}
              {configSubTab === "ai-chapter" && (
                <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Bookmark className="size-3.5 text-primary" />
                      Chapitre ou sujet du quiz :
                    </label>
                    <Input
                      value={chapterTopic}
                      onChange={(e) => setChapterTopic(e.target.value)}
                      placeholder="Ex: Chapitre 1 — Les origines, ou La papauté au Moyen Âge..."
                      className="text-xs bg-background h-8.5"
                      disabled={isGenerating}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      L&apos;IA concentrera les questions sur cette section spécifique de votre document.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Nombre de questions */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Nombre de questions :
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[3, 5, 10, 15].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setQuestionCount(num)}
                            className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold border transition-all ${
                              questionCount === num
                                ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                                : "border-border/80 bg-background text-foreground hover:border-primary/50"
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Niveau de difficulté */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Niveau de difficulté :
                      </label>
                      <div className="flex items-center gap-1.5">
                        {(
                          [
                            { id: "easy", label: "Facile", color: "emerald" },
                            { id: "medium", label: "Moyen", color: "sky" },
                            { id: "hard", label: "Expert", color: "purple" },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedDifficulty(item.id)}
                            className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold border transition-all ${
                              selectedDifficulty === item.id
                                ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                                : "border-border/80 bg-background text-foreground hover:border-primary/50"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/50">
                    <span className="text-[11px] text-muted-foreground">
                      {totalQuestions > 0
                        ? `Ce quiz contient déjà ${totalQuestions} questions. Les nouvelles s'ajouteront à la suite sans doublons.`
                        : "Le quiz sera prêt à être joué dès la fin de la génération."}
                    </span>

                    <Button
                      size="sm"
                      onClick={handleGenerateChapterQuiz}
                      disabled={isGenerating}
                      className="gap-2 font-medium text-xs shadow-xs px-4 h-8.5 shrink-0"
                    >
                      {isGenerating ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      <span>
                        {isGenerating
                          ? "Génération..."
                          : totalQuestions > 0
                          ? "Générer et ajouter"
                          : "Générer le Quiz"}
                      </span>
                    </Button>
                  </div>
                </div>
              )}

              {/* 2. CRÉATION MANUELLE */}
              {configSubTab === "manual" && (
                <form
                  onSubmit={handleAddManualQuestion}
                  className="space-y-3.5 rounded-xl border border-border/80 bg-card p-4"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Énoncé de la question :
                    </label>
                    <Input
                      value={manualQuestion}
                      onChange={(e) => setManualQuestion(e.target.value)}
                      placeholder="Ex: Quelle est la date de signature du traité... ?"
                      className="text-xs bg-background h-8.5"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>4 options de réponse :</span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        Cliquez sur la lettre pour désigner la bonne réponse (en vert)
                      </span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {manualOptions.map((opt, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 rounded-lg border p-1.5 px-2 text-xs transition-colors ${
                            manualCorrectIndex === idx
                              ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                              : "border-border/70 bg-background"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setManualCorrectIndex(idx)}
                            title={
                              manualCorrectIndex === idx
                                ? "Réponse correcte"
                                : "Définir comme bonne réponse"
                            }
                            className={`size-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 transition-colors cursor-pointer ${
                              manualCorrectIndex === idx
                                ? "bg-emerald-500 text-white"
                                : "bg-muted text-muted-foreground hover:bg-emerald-500/20"
                            }`}
                          >
                            {manualCorrectIndex === idx ? "✓" : OPTION_LETTERS[idx]}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const next = [...manualOptions];
                              next[idx] = e.target.value;
                              setManualOptions(next);
                            }}
                            placeholder={`Option ${OPTION_LETTERS[idx]}`}
                            className="w-full bg-transparent text-xs outline-none text-foreground"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Explication pédagogique (optionnel) :
                    </label>
                    <Input
                      value={manualExplanation}
                      onChange={(e) => setManualExplanation(e.target.value)}
                      placeholder="Pourquoi cette réponse est correcte..."
                      className="text-xs bg-background h-8"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8.5 text-xs gap-1.5 font-medium px-4"
                    >
                      <Plus className="size-3.5" />
                      <span>Ajouter cette question</span>
                    </Button>
                  </div>
                </form>
              )}

              {/* 3. LISTE DES QUESTIONS EXISTANTES */}
              {configSubTab === "list" && (
                <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4">
                  <span className="text-xs font-semibold text-foreground block mb-2">
                    Questions enregistrées ({totalQuestions}) :
                  </span>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {questions.map((q, idx) => (
                      <div
                        key={q.id || idx}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span className="text-primary font-bold">
                              Q{idx + 1}.
                            </span>
                            <span className="truncate">{q.question}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            Bonne réponse : {q.options[q.correctAnswer]}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0 p-1.5 rounded hover:bg-destructive/10 transition-colors"
                          title="Supprimer cette question"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleStartPlay()}
                      className="gap-1.5 text-xs font-medium h-8 px-4"
                    >
                      <Play className="size-3 fill-current" />
                      <span>Lancer le quiz</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : questions.length === 0 ? (
            /* ================= ÉTAT VIDE ================= */
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="size-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center shadow-xs border border-primary/20">
                <Sparkles className="size-6" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h5 className="font-sans text-xs sm:text-sm font-semibold tracking-tight text-foreground">
                  Quiz de fin de chapitre prêt à être configuré
                </h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choisissez un chapitre ou un thème pour générer automatiquement les questions avec l&apos;IA, ou saisissez-les vous-même.
                </p>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2.5">
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveTab("settings");
                      setConfigSubTab("ai-chapter");
                    }}
                    className="gap-1.5 font-medium text-xs shadow-xs h-8.5 px-4"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Configurer le Quiz</span>
                  </Button>
                </div>
              )}
            </div>
          ) : isCompleted ? (
            /* ================= RÉSULTAT FINAL ================= */
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-500 flex items-center justify-center shadow-xs border border-amber-500/20">
                <Trophy className="size-7 animate-bounce [animation-iteration-count:2]" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-extrabold font-sans tracking-tight text-foreground">
                    {score} / {totalQuestions}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary"
                  >
                    {Math.round((score / totalQuestions) * 100)}%
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  {score === totalQuestions
                    ? "🎉 Score parfait ! Vous maîtrisez parfaitement ce chapitre."
                    : score >= totalQuestions / 2
                    ? "👏 Bon score ! Vous avez assimilé la majorité des notions."
                    : "📖 Continuez vos révisions pour consolider les points clés de ce chapitre."}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestart}
                  className="gap-1.5 text-xs font-medium h-8.5 px-3.5"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Rejouer</span>
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveTab("settings");
                      setConfigSubTab("ai-chapter");
                    }}
                    className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground h-8.5 px-3"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    <span>Modifier les réglages</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* ================= QUESTION EN COURS (MODE JEU) ================= */
            <div className="space-y-4">
              {/* Barre de progression fluide */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary animate-pulse" />
                    Question {currentIndex + 1} sur {totalQuestions}
                  </span>
                  <span className="text-[11px] font-mono font-medium">
                    Score : {score}/{currentIndex + (isAnswered ? 1 : 0)}
                  </span>
                </div>

                <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Énoncé de la question */}
              <p className="text-sm font-semibold text-foreground leading-relaxed pt-1">
                {currentQuestion.question}
              </p>

              {/* 4 options A, B, C, D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQuestion.correctAnswer;

                  let optionStyle =
                    "border-border/80 bg-background hover:border-primary/50 hover:bg-muted/30 text-foreground";
                  if (isAnswered) {
                    if (isCorrect) {
                      optionStyle =
                        "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-medium shadow-2xs";
                    } else if (isSelected) {
                      optionStyle =
                        "border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-200";
                    } else {
                      optionStyle = "border-border/40 opacity-40";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(idx)}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all duration-150 text-xs cursor-pointer ${optionStyle}`}
                    >
                      <span
                        className={`size-5 rounded-md flex items-center justify-center font-bold shrink-0 text-[10px] ${
                          isAnswered && isCorrect
                            ? "bg-emerald-500 text-white"
                            : isAnswered && isSelected
                            ? "bg-rose-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isAnswered && isCorrect ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : isAnswered && isSelected ? (
                          <XCircle className="size-3.5" />
                        ) : (
                          OPTION_LETTERS[idx]
                        )}
                      </span>
                      <span className="flex-1 leading-relaxed">{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explication pédagogique */}
              {isAnswered && (
                <div className="space-y-3 pt-1 animate-in fade-in-50 duration-200">
                  {currentQuestion.explanation && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs flex items-start gap-2.5 text-foreground">
                      <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-semibold text-primary block">
                          Explication :
                        </span>
                        <p className="leading-relaxed text-muted-foreground">
                          {currentQuestion.explanation}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleNext}
                      className="gap-1.5 text-xs font-medium h-8.5 px-4"
                    >
                      <span>
                        {currentIndex < totalQuestions - 1
                          ? "Question suivante"
                          : "Voir mon score"}
                      </span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
