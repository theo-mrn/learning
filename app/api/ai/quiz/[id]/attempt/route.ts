import { NextRequest } from "next/server";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: quizId } = await params;

    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, userId: true },
    });

    if (!quiz) {
      return new Response(JSON.stringify({ error: "Quiz introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { score, total, answers } = body as {
      score: number;
      total: number;
      answers: Record<string, number>;
    };

    if (typeof score !== "number" || typeof total !== "number") {
      return new Response(JSON.stringify({ error: "Données de score invalides." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId: user.id,
        score,
        total,
        answers: answers || {},
      },
    });

    return new Response(
      JSON.stringify({ success: true, attemptId: attempt.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Save quiz attempt error:", error);
    return new Response(
      JSON.stringify({ error: "Une erreur inattendue est survenue." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
