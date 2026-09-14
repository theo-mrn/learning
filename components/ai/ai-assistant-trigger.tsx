"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAIAssistant } from "./ai-assistant-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AIAssistantTrigger({ className }: { className?: string }) {
  const { openAssistant, pageContext } = useAIAssistant();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            onClick={openAssistant}
            className={`h-8 gap-1.5 px-2.5 text-xs font-medium text-foreground transition-all duration-150 hover:border-primary/50 hover:bg-primary/5 hover:text-primary ${
              className ?? ""
            }`}
          >
            <Sparkles className="size-3.5 text-primary animate-pulse" />
            <span className="hidden sm:inline">Assistant IA</span>
            {pageContext && (
              <span className="size-1.5 rounded-full bg-emerald-500 animate-ping ml-0.5" />
            )}
          </Button>
        }
      />
      <TooltipContent side="bottom">
        {pageContext
          ? `Poser une question sur « ${pageContext.title || "ce cours"} »`
          : "Ouvrir l'assistant d'apprentissage IA"}
      </TooltipContent>
    </Tooltip>
  );
}
