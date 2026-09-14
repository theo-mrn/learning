import { NextRequest } from "next/server";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  shuffleFlashcards,
  type FlashcardItem,
} from "@/components/flashcard/flashcard-types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const body = await req.json();
    const {
      pageTitle,
      pageContent,
      count = 5,
      topic,
      pageId,
      previousCards = [],
    } = body;

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Clé API DeepSeek non configurée (variable d'environnement API_KEY manquante).",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const cleanCount = Math.min(Math.max(1, Number(count) || 5), 25);
    const cleanDefaultTitle = topic
      ? topic.toLowerCase().startsWith("carte") || topic.toLowerCase().startsWith("flashcard")
        ? topic
        : `Flashcards — ${topic}`
      : pageTitle && !/sans titre/i.test(pageTitle)
      ? `Flashcards — ${pageTitle}`
      : "Cartes de révision";

    const systemPrompt = `Tu es un expert pédagogique de haut niveau spécialisé dans les sciences cognitives, la mémorisation active et la répétition espacée (méthode Leitner / Anki).
Ton objectif est de créer des fiches de mémorisation (Flashcards) ultra-efficaces, claires et stimulantes à partir du contenu ou sujet fourni.

RÈGLES D'OR POUR UNE BONNE FLASHCARD :
1. Principe d'atomicité : chaque carte ne doit porter que sur UNE SEULE notion, question ou définition clé.
2. Recto ("front") : Concis, direct et invitant à la réflexion active (ex: une question directe, un terme à définir, une formule à compléter ou un acronyme).
3. Verso ("back") : Réponse claire, précise et sans verbiage inutile. Explique le "pourquoi" ou donne un moyen mnémotechnique si utile.
4. Indice ("hint") : Un indice subtil et intelligent qui met sur la voie sans donner directement la réponse.
5. Langue : Français soigné, précis et moderne.`;

    const contentContext =
      pageContent && typeof pageContent === "string" && pageContent.trim().length > 0
        ? `CONTENU DU COURS OU DE LA PAGE :\n"""\n${pageContent.slice(0, 10000)}\n"""`
        : `THÈME / SUJET : ${topic || pageTitle || "Général"}`;

    const topicInstruction = topic
      ? `FOCUS PARTICULIER : Concentre impérativement les flashcards sur le thème ou chapitre suivant : "${topic}".`
      : "";

    const previousCardsInstruction =
      Array.isArray(previousCards) && previousCards.length > 0
        ? `ÉVITE ABSOLUMENT DE RÉPÉTER CES NOTIONS DÉJÀ EXISTANTES :\n- ${previousCards
            .slice(-30)
            .join("\n- ")}`
        : "";

    const userPrompt = `Génère un paquet de ${cleanCount} flashcards interactives basées sur les informations suivantes :

${contentContext}

${topicInstruction}
${previousCardsInstruction}

CONSIGNES STRICTES :
1. Génère exactement ${cleanCount} flashcards.
2. Chaque carte doit avoir :
   - "id" : un identifiant unique court (ex: "c1", "c2", ...)
   - "front" : Le Recto (Question, Notion, Acronyme ou Formule à deviner)
   - "back" : Le Verso (Réponse explicite, définition précise ou solution)
   - "hint" : Un petit indice pour guider l'élève s'il hésite.
3. Renvoie UNIQUEMENT un objet JSON valide structuré comme suit :
{
  "title": "${cleanDefaultTitle}",
  "description": "Fiches de mémorisation active et concepts clés.",
  "cards": [
    {
      "id": "c1",
      "front": "Qu'est-ce que l'encapsulation en programmation orientée objet ?",
      "back": "Le principe consistant à regrouper données et méthodes au sein d'une même structure en restreignant l'accès direct depuis l'extérieur.",
      "hint": "C'est l'un des piliers fondamentaux de la POO avec l'héritage et le polymorphisme."
    }
  ]
}`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek Flashcards Error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: `Erreur du service DeepSeek (${response.status}) : ${errorText}`,
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? "";

    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: {
      title?: string;
      description?: string;
      cards?: FlashcardItem[];
    };

    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Erreur de parsing JSON des flashcards :", parseError, cleaned);
      return new Response(
        JSON.stringify({
          error: "Le format de flashcards retourné par l'IA est invalide. Réessaie !",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Aucune flashcard n'a pu être générée pour ce contenu.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Normalisation des cartes
    const validCards: FlashcardItem[] = parsed.cards.map((c, idx) => ({
      id: c.id || `card_${idx + 1}_${Date.now()}`,
      front: c.front ? String(c.front).trim() : `Notion ${idx + 1}`,
      back: c.back ? String(c.back).trim() : "Définition non disponible.",
      hint: c.hint ? String(c.hint).trim() : undefined,
    }));

    // Ordre aléatoire dès la génération
    const randomizedCards = shuffleFlashcards(validCards);

    // Validation du pageId
    let validPageId: string | null = null;
    if (pageId && typeof pageId === "string") {
      try {
        const pageExists = await db.page.findUnique({
          where: { id: pageId },
          select: { id: true },
        });
        if (pageExists) validPageId = pageExists.id;
      } catch {
        // ID non trouvé
      }
    }

    let finalTitle = (parsed.title || cleanDefaultTitle).trim();
    if (/sans titre/i.test(finalTitle)) {
      finalTitle = cleanDefaultTitle;
    }

    const finalDescription = (
      parsed.description || "Fiches de mémorisation active"
    ).trim();

    let deckId = `deck_${Date.now()}`;
    let createdAt = new Date().toISOString();

    // Enregistrement en base de données Postgres via Prisma
    if (db.flashcardDeck) {
      try {
        const deck = await db.flashcardDeck.create({
          data: {
            title: finalTitle,
            description: finalDescription,
            topic: topic || null,
            pageId: validPageId,
            userId: user.id,
            cards: randomizedCards,
          },
        });
        deckId = deck.id;
        createdAt = deck.createdAt.toISOString();
      } catch (dbErr) {
        console.error("Flashcard deck persistence error:", dbErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deck: {
          id: deckId,
          title: finalTitle,
          description: finalDescription,
          topic: topic || null,
          pageId: validPageId,
          pageTitle: pageTitle || null,
          cards: randomizedCards,
          createdAt,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Flashcard generation error:", error);
    const message =
      error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
