import { NextRequest } from "next/server";
import { requireUser } from "@/lib/dal";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Vérification de la session utilisateur
    await requireUser();

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Clé API DeepSeek (API_KEY) non configurée dans l'environnement.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { messages, pageContext } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      pageContext?: { title?: string; content?: string };
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucun message fourni." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Construction du prompt système avec le contexte du cours
    let systemContent = `Tu es un tuteur pédagogique intelligent, rigoureux et bienveillant, intégré directement à l'application de cours et de prise de notes de l'étudiant.
Ton rôle est d'aider l'étudiant à comprendre en profondeur, réviser, synthétiser et mémoriser ses cours de façon stimulante et claire.`;

    if (pageContext?.content && pageContext.content.trim().length > 0) {
      systemContent += `\n\nVoici le document/cours actuellement ouvert par l'étudiant :
---
TITRE DU COURS : ${pageContext.title || "Sans titre"}
CONTENU DU COURS :
${pageContext.content.slice(0, 30_000)}
---

Règles essentielles :
1. Réponds toujours en français de manière fluide, claire et pédagogique.
2. Utilise en priorité le contenu du cours ci-dessus pour répondre aux questions, fournir des explications, générer des résumés ou concevoir des quiz.
3. Si la question dépasse le cadre du cours, réponds avec précision en signalant que cette information complète le cours.
4. Structure toujours tes réponses avec du Markdown élégant : titres hiérarchisés (#, ##), listes à puces concises, mise en valeur en **gras** des termes clés, blocs de code avec coloration syntaxique si pertinent.
5. RÈGLE CRITIQUE SUR LES QUIZ ET QUESTIONS :
L'application intègre un module de Quiz interactif complet avec boutons de réponse, timer et score en base de données.
Tu ne dois JAMAIS générer de QCM ou de liste de questions textuelles (Question 1, Question 2, A, B, C, D) dans cette conversation.
Si l'étudiant demande un quiz, des questions de révision, un test ou d'en rajouter (ex: "2 de plus", "encore 5 questions", "quiz difficile"), réponds EXCLUSIVEMENT par la balise d'action suivante, SANS AUCUN AUTRE MOT avant ni après :
[ACTION:QUIZ:{"count":X,"difficulty":"easy"|"medium"|"hard","topic":"..."}]
Exemples :
- "2 de plus" -> [ACTION:QUIZ:{"count":2,"difficulty":"medium"}]
- "fais moi 3 questions faciles" -> [ACTION:QUIZ:{"count":3,"difficulty":"easy"}]
- "quiz sur le christianisme" -> [ACTION:QUIZ:{"count":5,"difficulty":"medium","topic":"christianisme"}]`;
    } else {
      systemContent += `\n\n(L'étudiant n'a actuellement aucun cours ouvert ou le document est vide. Si l'étudiant demande un quiz ou des questions, réponds avec la balise [ACTION:QUIZ:{"count":X,"difficulty":"medium"}].)`;
    }

    // Préparation de l'historique récent (limité aux 12 derniers messages)
    const recentMessages = messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        stream: true,
        temperature: 0.7,
        messages: [{ role: "system", content: systemContent }, ...recentMessages],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: `Erreur du service DeepSeek (${response.status}) : ${errorText}`,
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Stream de transformation SSE -> texte brut pour le client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;

              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  controller.enqueue(encoder.encode(token));
                }
              } catch {
                // Fragment JSON partiel ignoré
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Une erreur inattendue est survenue." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
