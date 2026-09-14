import { NextRequest } from "next/server";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  shuffleQuizQuestions,
  type QuizQuestion,
} from "@/components/quiz/quiz-types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Clé API DeepSeek (API_KEY) non configurée.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      pageId,
      pageTitle,
      pageContent,
      count = 5,
      difficulty = "medium",
      topic,
      previousQuestions = [],
    } = body as {
      pageId?: string;
      pageTitle?: string;
      pageContent?: string;
      count?: number;
      difficulty?: "easy" | "medium" | "hard";
      topic?: string;
      previousQuestions?: string[];
    };

    const hasCourseContent = Boolean(pageContent && pageContent.trim().length >= 20);
    const contentContext = hasCourseContent
      ? `CONTENU DU COURS :\n"""\n${pageContent?.slice(0, 25_000)}\n"""`
      : `(Aucun contenu de cours détaillé fourni. Génère le quiz en te basant sur le sujet "${topic || pageTitle || "Culture générale"}")`;

    let difficultyInstruction = "";
    if (difficulty === "easy") {
      difficultyInstruction = `NIVEAU DE DIFFICULTÉ : FACILE / DÉBUTANT. Les questions doivent tester les définitions de base, la mémorisation directe et les faits simples explicites du cours, sans pièges.`;
    } else if (difficulty === "hard") {
      difficultyInstruction = `NIVEAU DE DIFFICULTÉ : AVANCÉ / DIFFICILE. Les questions doivent être pointues, comporter des pièges subtils mais justes, tester la déduction logique, l'application concrète et la compréhension approfondie des mécanismes du cours.`;
    } else {
      difficultyInstruction = `NIVEAU DE DIFFICULTÉ : INTERMÉDIAIRE. Équilibre entre notions fondamentales et mise en relation de concepts.`;
    }

    let topicInstruction = "";
    if (topic && topic.trim().length > 0) {
      topicInstruction = `\nFOCUS PARTICULIER : Concentre le quiz prioritairement sur la notion ou le thème suivant : "${topic.trim()}".`;
    }

    let previousQuestionsInstruction = "";
    if (Array.isArray(previousQuestions) && previousQuestions.length > 0) {
      previousQuestionsInstruction = `\nQUESTIONS DÉJÀ POSÉES (À NE PAS RÉPÉTER NI REFORMULER IDENTIQUEMENT) :
${previousQuestions.slice(-25).map((q, i) => `${i + 1}. ${q}`).join("\n")}
Génère des questions entièrement NOUVELLES, différentes et complémentaires par rapport à cette liste.`;
    }

    const systemPrompt = `Tu es un générateur expert de quiz et QCM pédagogiques. Tu réponds exclusivement en JSON valide, sans aucune fioriture, sans texte conversationnel, et sans balises de code markdown (pas de \`\`\`json).`;

    const cleanCount = Math.min(20, Math.max(1, count));
    const hasValidTitle = Boolean(
      pageTitle &&
      pageTitle.trim().length > 0 &&
      !/sans titre/i.test(pageTitle.trim())
    );

    const hasValidTopic = Boolean(
      topic &&
      topic.trim().length > 0 &&
      !/sans titre/i.test(topic.trim()) &&
      !/^quiz/i.test(topic.trim())
    );

    const subjectLabel = hasValidTopic
      ? topic!.trim()
      : hasValidTitle
      ? pageTitle!.trim().replace(/^(?:quiz\s*:\s*)+/i, "")
      : "";

    const cleanDefaultTitle = subjectLabel
      ? `Quiz : ${subjectLabel}`
      : "Quiz d'évaluation";

    const cleanDefaultDescription = subjectLabel
      ? `Quiz d'évaluation (${difficulty === "hard" ? "Avancé" : difficulty === "easy" ? "Facile" : "Intermédiaire"}) sur ${subjectLabel}`
      : `Quiz d'évaluation (${difficulty === "hard" ? "Avancé" : difficulty === "easy" ? "Facile" : "Intermédiaire"})`;

    const userPrompt = `Génère un quiz d'évaluation stimulant et rigoureux pour tester la compréhension de ce cours :

TITRE DU COURS : ${hasValidTitle ? pageTitle : "(Document d'étude)"}
${contentContext}


${difficultyInstruction}
${topicInstruction}
${previousQuestionsInstruction}

CONSIGNES STRICTES :
1. Génère exactement ${cleanCount} questions à choix multiples.
2. Chaque question doit avoir exactement 4 options de réponse (options).
3. "correctAnswer" doit être l'indice de la bonne réponse dans le tableau options (entier : 0, 1, 2 ou 3).
4. Rédige une "explanation" claire et pédagogique pour expliquer la bonne réponse.
5. Renvoie UNIQUEMENT un objet JSON structuré comme suit (évite absolument les mentions "sans titre" dans le titre ou la description) :
{
  "title": "${cleanDefaultTitle}",
  "description": "${cleanDefaultDescription}",
  "questions": [
    {
      "id": "q1",
      "question": "Texte de la question ?",
      "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
      "correctAnswer": 0,
      "explanation": "Pourquoi cette réponse est correcte."
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
      console.error("DeepSeek Quiz Error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: `Erreur du service DeepSeek (${response.status}) : ${errorText}`,
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? "";

    // Nettoyage au cas où le modèle inclut des balises ```json ... ```
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: {
      title?: string;
      description?: string;
      questions?: QuizQuestion[];
    };

    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Erreur de parsing JSON du quiz :", parseError, cleaned);
      return new Response(
        JSON.stringify({
          error: "Le format de quiz retourné par l'IA est invalide. Réessaie !",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Aucune question n'a pu être générée pour ce contenu.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Normalisation des questions
    const validQuestions: QuizQuestion[] = parsed.questions.map((q, idx) => ({
      id: q.id || `q_${idx + 1}`,
      question: q.question,
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : ["A", "B", "C", "D"],
      correctAnswer:
        typeof q.correctAnswer === "number" && q.correctAnswer >= 0 && q.correctAnswer < 4
          ? q.correctAnswer
          : 0,
      explanation: q.explanation || "Bonne réponse validée d'après le cours.",
    }));

    // Ordre aléatoire des questions et placement aléatoire des réponses (A, B, C, D)
    const randomizedQuestions = shuffleQuizQuestions(validQuestions);

    // Validation de pageId s'il est fourni (évite les erreurs de clé étrangère si la page n'existe pas)
    let validPageId: string | null = null;
    if (pageId && typeof pageId === "string") {
      try {
        const pageExists = await db.page.findUnique({
          where: { id: pageId },
          select: { id: true },
        });
        if (pageExists) validPageId = pageExists.id;
      } catch {
        // En cas d'ID invalide, on laisse validPageId à null
      }
    }

    // Nettoyage et assainissement du titre et de la description
    let finalTitle = (parsed.title || cleanDefaultTitle).trim();
    finalTitle = finalTitle.replace(/^(?:quiz\s*:\s*)+/i, "Quiz : ");
    if (/sans titre/i.test(finalTitle)) {
      finalTitle = cleanDefaultTitle;
    }

    let finalDescription = (
      parsed.description || cleanDefaultDescription
    ).trim();
    if (/sans titre/i.test(finalDescription)) {
      finalDescription = cleanDefaultDescription;
    }

    // Enregistrement en base de données Postgres via Prisma
    const quiz = await db.quiz.create({
      data: {
        title: finalTitle,
        description: finalDescription,
        pageId: validPageId,
        userId: user.id,
        questions: randomizedQuestions,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          difficulty,
          topic: topic || null,
          pageId: quiz.pageId,
          pageTitle: pageTitle || null,
          questions: randomizedQuestions,
          createdAt: quiz.createdAt.toISOString(),
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Quiz generation error:", error);
    const message =
      error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
