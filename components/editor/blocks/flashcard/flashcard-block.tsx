"use client";

import { useState, useCallback, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  Sparkles,
  RotateCcw,
  Trophy,
  Trash2,
  MoreHorizontal,
  Loader2,
  Lightbulb,
  Plus,
  Play,
  SlidersHorizontal,
  BookOpen,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Eye,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBlockEditable } from "../common/use-block-editable";
import { FLASHCARD_DEFAULT_TITLE } from "./flashcard-types";
import {
  shuffleFlashcards,
  type FlashcardItem,
} from "@/components/flashcard/flashcard-types";
import { toast } from "sonner";

export function FlashcardBlockComponent({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: NodeViewProps) {
  const canEdit = useBlockEditable(editor);

  const title = (node.attrs.title as string) || FLASHCARD_DEFAULT_TITLE;
  const cards = (node.attrs.cards as FlashcardItem[]) || [];

  // Onglet principal : "play" (révision interactive) ou "settings" (configuration)
  const [activeTab, setActiveTab] = useState<"play" | "settings">(
    cards.length === 0 ? "settings" : "play"
  );

  // Sous-onglet de configuration : "ai-chapter" | "manual" | "list"
  const [configSubTab, setConfigSubTab] = useState<"ai-chapter" | "manual" | "list">(
    "ai-chapter"
  );

  // Formulaire de génération IA
  const [chapterTopic, setChapterTopic] = useState("");
  const [cardCount, setCardCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);

  // État de l'entraînement
  const [deck, setDeck] = useState<FlashcardItem[]>(() => shuffleFlashcards(cards));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Répétition active : statuts des cartes (mastered / toReview)
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [toReviewIds, setToReviewIds] = useState<Set<string>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);

  // Formulaire d'ajout manuel
  const [manualFront, setManualFront] = useState("");
  const [manualBack, setManualBack] = useState("");
  const [manualHint, setManualHint] = useState("");

  const activeCards = deck.length > 0 ? deck : cards;
  const totalCards = activeCards.length;
  const currentCard = activeCards[currentIndex];

  // Gestion du retournement de carte
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    setShowHint(false);
  }, []);

  // Évaluation d'une carte (À revoir ou Maîtrisé)
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

  // Lance ou relance une session avec un nouveau mélange
  const handleStartPlay = (sourceCards?: FlashcardItem[]) => {
    const base = sourceCards ?? cards;
    setDeck(shuffleFlashcards(base));
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setMasteredIds(new Set());
    setToReviewIds(new Set());
    setIsCompleted(false);
    setActiveTab("play");
  };

  // Ne revoir que les cartes non assimilées
  const handleReviewDifficultOnly = () => {
    const unmastered = cards.filter((c) => toReviewIds.has(c.id));
    if (unmastered.length === 0) return;
    setDeck(shuffleFlashcards(unmastered));
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setIsCompleted(false);
    setActiveTab("play");
  };

  // Mélanger le paquet actif
  const handleShuffleDeck = () => {
    setDeck(shuffleFlashcards(deck.length > 0 ? deck : cards));
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    toast.info("Cartes mélangées aléatoirement !");
  };

  // Ajout manuel d'une carte
  const handleAddManualCard = (e: React.FormEvent) => {
    e.preventDefault();
    const front = manualFront.trim();
    const back = manualBack.trim();
    if (!front || !back) {
      toast.error("Veuillez renseigner le Recto et le Verso de la carte.");
      return;
    }

    const newCard: FlashcardItem = {
      id: crypto.randomUUID(),
      front,
      back,
      hint: manualHint.trim() || undefined,
    };

    const updated = [...cards, newCard];
    updateAttributes({ cards: updated });
    setDeck(shuffleFlashcards(updated));

    setManualFront("");
    setManualBack("");
    setManualHint("");
    toast.success("Carte ajoutée au paquet !");
  };

  // Suppression d'une carte
  const handleDeleteCard = (id: string) => {
    const nextCards = cards.filter((c) => c.id !== id);
    updateAttributes({ cards: nextCards });
    setDeck((prev) => prev.filter((c) => c.id !== id));
    if (currentIndex >= nextCards.length) {
      setCurrentIndex(Math.max(0, nextCards.length - 1));
    }
    toast.info("Carte supprimée");
  };

  // Génération de flashcards avec l'IA
  const handleGenerateChapterCards = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const pageText = editor.getText();
      const topicInstruction = chapterTopic.trim();
      const derivedTitle = topicInstruction
        ? topicInstruction.toLowerCase().startsWith("flashcard") ||
          topicInstruction.toLowerCase().startsWith("carte")
          ? topicInstruction
          : `Flashcards — ${topicInstruction}`
        : title !== FLASHCARD_DEFAULT_TITLE
        ? title
        : "Cartes de révision";

      const response = await fetch("/api/ai/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageTitle: derivedTitle,
          pageContent: pageText,
          count: cardCount,
          topic: topicInstruction || undefined,
          previousCards: cards.map((c) => c.front),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Échec de la génération des flashcards.");
      }

      const data = await response.json();
      const generatedCards: FlashcardItem[] = data.deck?.cards || [];

      const combined =
        cards.length > 0 ? [...cards, ...generatedCards] : generatedCards;

      updateAttributes({
        cards: combined,
        title: derivedTitle,
        topic: topicInstruction || undefined,
      });

      handleStartPlay(combined);
      setChapterTopic("");
      toast.success(
        `Flashcards générées avec succès (${generatedCards.length} cartes) !`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur de génération";
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Raccourci clavier barre d'espace pour retourner la carte
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "play" || isCompleted) return;
      if (
        e.code === "Space" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, isCompleted, handleFlip]);

  const masteredCount = masteredIds.size;
  const toReviewCount = toReviewIds.size;
  const progressPercent =
    totalCards > 0 ? Math.round(((currentIndex + 1) / totalCards) * 100) : 0;
  const masteryPercent =
    totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  return (
    <NodeViewWrapper className="my-5 select-none">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-b from-card via-card/95 to-muted/20 shadow-sm overflow-hidden transition-all hover:border-primary/50">
        {/* ================= EN-TÊTE ULTRA-SOIGNÉ DU BLOC ================= */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60 bg-muted/25 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-2xs shrink-0">
              <Layers className="size-4" />
            </div>

            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              {canEdit ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => updateAttributes({ title: e.target.value })}
                  placeholder="Titre des flashcards (ex: Cartes — Chapitre 1)"
                  className="font-sans text-xs sm:text-sm font-semibold tracking-tight text-foreground bg-transparent border-none outline-none focus:underline truncate max-w-xs sm:max-w-md"
                />
              ) : (
                <h4 className="font-sans text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  {title}
                </h4>
              )}

              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold shrink-0"
              >
                {cards.length} {cards.length > 1 ? "cartes" : "carte"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Boutons d'alternance Mode Réviser vs Mode Configurer */}
            {canEdit && (
              <div className="flex items-center p-0.5 rounded-lg border border-border/80 bg-background/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleStartPlay()}
                  disabled={cards.length === 0}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "play"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground disabled:opacity-40"
                  }`}
                >
                  <Play className="size-3 fill-current" />
                  <span className="hidden sm:inline">Réviser</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Options des flashcards"
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                <DropdownMenuItem
                  onClick={handleShuffleDeck}
                  disabled={cards.length === 0}
                >
                  <Shuffle className="size-3.5 mr-2 text-primary" />
                  <span>Mélanger les cartes</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStartPlay()}
                  disabled={cards.length === 0}
                >
                  <RotateCcw className="size-3.5 mr-2 text-primary" />
                  <span>Recommencer la révision</span>
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setActiveTab("settings");
                        setConfigSubTab("ai-chapter");
                      }}
                    >
                      <Sparkles className="size-3.5 mr-2 text-primary" />
                      <span>Générer avec l&apos;IA</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={deleteNode}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3.5 mr-2" />
                      <span>Supprimer ce bloc</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ================= CORPS DU BLOC ================= */}
        <div className="p-4 sm:p-5">
          {activeTab === "settings" ? (
            /* ================= MODE CONFIGURATION ================= */
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Sous-onglets de configuration */}
              <div className="flex items-center gap-2 border-b border-border/60 pb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setConfigSubTab("ai-chapter")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    configSubTab === "manual"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Plus className="size-3.5" />
                  <span>Ajouter une carte</span>
                </button>

                {cards.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfigSubTab("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      configSubTab === "list"
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <BookOpen className="size-3.5" />
                    <span>Cartes ({cards.length})</span>
                  </button>
                )}
              </div>

              {/* Contenu de sous-onglet : Générateur IA */}
              {configSubTab === "ai-chapter" && (
                <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                  <div className="space-y-1">
                    <h5 className="font-sans text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="size-3.5 text-primary" />
                      <span>Génération automatique de Flashcards</span>
                    </h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      L&apos;IA analyse le cours pour extraire les notions clés, définitions et Q&A sous forme de fiches mémos optimisées.
                    </p>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Chapitre, notion ou focus ciblé (optionnel) :
                      </label>
                      <Input
                        value={chapterTopic}
                        onChange={(e) => setChapterTopic(e.target.value)}
                        placeholder="Ex: Chapitre 1 — Définitions clés, Dates importantes..."
                        className="text-xs h-9 rounded-xl border-border/80 bg-background/80 focus:bg-background shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Nombre de flashcards :
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[5, 10, 15, 20].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setCardCount(num)}
                            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                              cardCount === num
                                ? "border-primary bg-primary/15 text-primary shadow-xs ring-2 ring-primary/20 font-bold"
                                : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border"
                            }`}
                          >
                            {num} cartes
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleGenerateChapterCards}
                      disabled={isGenerating}
                      className="w-full gap-2 text-xs font-semibold h-10 rounded-xl mt-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs hover:shadow-md transition-all cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Création des cartes en cours...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3.5" />
                          <span>Générer les flashcards</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Contenu de sous-onglet : Ajout manuel */}
              {configSubTab === "manual" && (
                <form onSubmit={handleAddManualCard} className="space-y-3.5 rounded-2xl border border-border/80 bg-gradient-to-b from-card/80 via-card/50 to-muted/20 p-5 shadow-xs">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Recto — Question ou Notion :</span>
                      <span className="text-[10px] text-muted-foreground">Visible en premier</span>
                    </label>
                    <Input
                      value={manualFront}
                      onChange={(e) => setManualFront(e.target.value)}
                      placeholder="Ex: Qu'est-ce que le principe d'encapsulation ?"
                      className="text-xs h-9 rounded-xl border-border/80 bg-background/80 focus:bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Verso — Réponse ou Définition :</span>
                      <span className="text-[10px] text-muted-foreground">Révélé après retournement</span>
                    </label>
                    <Textarea
                      value={manualBack}
                      onChange={(e) => setManualBack(e.target.value)}
                      placeholder="Ex: Le mécanisme qui regroupe données et méthodes en restreignant l'accès direct depuis l'extérieur."
                      className="text-xs min-h-[70px] rounded-xl border-border/80 bg-background/80 focus:bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Lightbulb className="size-3.5 text-amber-500" />
                      <span>Indice facultatif :</span>
                    </label>
                    <Input
                      value={manualHint}
                      onChange={(e) => setManualHint(e.target.value)}
                      placeholder="Ex: L'un des 3 piliers fondamentaux de la POO"
                      className="text-xs h-9 rounded-xl border-border/80 bg-background/80 focus:bg-background"
                    />
                  </div>

                  <Button type="submit" size="sm" className="gap-1.5 text-xs h-9 px-5 rounded-xl font-semibold shadow-xs">
                    <Plus className="size-3.5" />
                    <span>Ajouter cette carte</span>
                  </Button>
                </form>
              )}

              {/* Contenu de sous-onglet : Liste des cartes */}
              {configSubTab === "list" && (
                <div className="space-y-3">
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {cards.map((card, idx) => (
                      <div
                        key={card.id}
                        className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-border/60 bg-muted/20 text-xs hover:border-border transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="size-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-foreground truncate">
                              {card.front}
                            </span>
                          </div>
                          <p className="text-muted-foreground pl-7 text-[11px] line-clamp-2 leading-relaxed">
                            {card.back}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCard(card.id)}
                          className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleStartPlay()}
                      className="gap-1.5 text-xs font-semibold h-9 px-5 rounded-xl shadow-xs"
                    >
                      <Play className="size-3 fill-current" />
                      <span>Lancer la révision</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : cards.length === 0 ? (
            /* ================= ÉTAT VIDE SOIGNÉ ================= */
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 max-w-md mx-auto animate-in fade-in-50 duration-200">
              <div className="size-14 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary flex items-center justify-center shadow-xs border border-primary/25">
                <Layers className="size-7" />
              </div>
              <div className="space-y-1.5">
                <h5 className="font-sans text-sm sm:text-base font-semibold text-foreground tracking-tight">
                  Paquet de Flashcards prêt à être configuré
                </h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Générez vos fiches de révision en un clic à partir du cours grâce à l&apos;IA, ou concevez vos propres cartes recto/verso.
                </p>
              </div>

              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => {
                    setActiveTab("settings");
                    setConfigSubTab("ai-chapter");
                  }}
                  className="gap-2 font-semibold text-xs shadow-xs h-9 px-5 rounded-xl mt-1"
                >
                  <Sparkles className="size-3.5" />
                  <span>Configurer les Flashcards</span>
                </Button>
              )}
            </div>
          ) : isCompleted ? (
            /* ================= ÉCRAN DE BILAN MODERNE ================= */
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-5 max-w-md mx-auto animate-in zoom-in-95 duration-200">
              <div className="relative">
                <div className="size-16 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent text-emerald-500 flex items-center justify-center shadow-md border border-emerald-500/30">
                  <Trophy className="size-8 animate-bounce [animation-iteration-count:2]" />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 size-6 rounded-full bg-background border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shadow-2xs">
                  {masteryPercent}%
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="font-sans text-xl font-bold tracking-tight text-foreground">
                  {masteredCount === totalCards
                    ? "Score Parfait ! 🎉"
                    : masteryPercent >= 70
                    ? "Excellente rétention ! 👏"
                    : "Session terminée ! 💪"}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Tu as assimilé{" "}
                  <strong className="text-foreground font-semibold">
                    {masteredCount} sur {totalCards}
                  </strong>{" "}
                  notions ({masteryPercent}% de réussite).
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 w-full">
                {toReviewCount > 0 && (
                  <Button
                    size="sm"
                    onClick={handleReviewDifficultOnly}
                    className="gap-1.5 text-xs font-semibold h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
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
                  onClick={() => handleStartPlay()}
                  className="gap-1.5 text-xs font-medium h-9 px-4 rounded-xl border-border/80 hover:bg-muted/60"
                >
                  <Shuffle className="size-3.5 text-primary" />
                  <span>Recommencer tout</span>
                </Button>

                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveTab("settings");
                      setConfigSubTab("ai-chapter");
                    }}
                    className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground h-9 px-3 rounded-xl"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    <span>Modifier</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* ================= MODE JEU : CARTE INTERACTIVE 3D ================= */
            <div className="space-y-5 max-w-lg mx-auto">
              {/* Barre de progression & contrôles supérieurs */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary animate-pulse" />
                    Carte {currentIndex + 1} sur {totalCards}
                  </span>
                  <div className="flex items-center gap-3 text-[11px] font-medium">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> {masteredCount} maîtrisée(s)
                    </span>
                    {toReviewCount > 0 && (
                      <span className="text-rose-500 flex items-center gap-1">
                        <X className="size-3" /> {toReviewCount} à revoir
                      </span>
                    )}
                  </div>
                </div>

                <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* PILE DE CARTES + CARTE FLIP 3D */}
              <div className="relative w-full [perspective:1000px] select-none py-1.5">
                {/* Cartes arrière superposées */}
                <div className="absolute inset-x-5 -bottom-2.5 h-full rounded-3xl bg-muted/30 border border-border/30 -z-20 pointer-events-none" />
                <div className="absolute inset-x-2.5 -bottom-1 h-full rounded-3xl bg-muted/60 border border-border/50 -z-10 pointer-events-none" />

                <div
                  onClick={handleFlip}
                  className={`relative w-full min-h-[250px] sm:min-h-[280px] rounded-3xl border transition-all duration-500 cursor-pointer shadow-md [transform-style:preserve-3d] ${
                    isFlipped
                      ? "[transform:rotateY(180deg)] border-emerald-500/40 bg-gradient-to-b from-card via-card/95 to-emerald-500/5"
                      : "border-border/90 bg-gradient-to-b from-card via-card/95 to-muted/20 hover:border-primary/50 shadow-black/5 hover:shadow-lg"
                  }`}
                >
                  {/* ===== FACE AVANT (RECTO) ===== */}
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
                      <h3 className="font-sans text-base sm:text-lg font-semibold text-foreground leading-relaxed tracking-tight">
                        {currentCard.front}
                      </h3>

                      {showHint && currentCard.hint && (
                        <div className="mt-3 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs text-left animate-in fade-in-50 duration-200">
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

                  {/* ===== FACE ARRIÈRE (VERSO) ===== */}
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
                      <p className="font-sans text-sm sm:text-base font-normal text-foreground leading-relaxed">
                        {currentCard.back}
                      </p>
                    </div>

                    <div className="flex items-center justify-center pt-1 text-xs text-muted-foreground">
                      <span>Évaluez votre mémorisation ci-dessous</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOUTONS D'ÉVALUATION (ACTIFS LORSQUE LA CARTE EST RETOURNÉE) */}
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
                /* CONTRÔLES DE NAVIGATION SIMPLES */
                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="gap-1 text-xs h-9 px-3.5 rounded-xl"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span className="hidden sm:inline">Précédente</span>
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
                    <span className="hidden sm:inline">Suivante</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
