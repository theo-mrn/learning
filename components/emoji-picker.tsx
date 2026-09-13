"use client";

import { useState } from "react";
import { Smile, X } from "lucide-react";
import EmojiPickerReact, { Theme } from "emoji-picker-react";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function EmojiPicker({
  icon,
  onSelect,
}: {
  icon: string | null;
  onSelect: (icon: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            // Sans icône, on montre un emplacement discret mais cliquable
            // plutôt qu'un grand vide : l'affordance reste visible.
            className={`size-14 shrink-0 p-0 leading-none transition-colors duration-150 ${
              icon
                ? "text-[2.75rem] hover:bg-accent"
                : "border border-dashed border-border text-muted-foreground hover:border-solid hover:bg-accent hover:text-foreground"
            }`}
            aria-label={
              icon ? "Changer l'icône de la page" : "Ajouter une icône"
            }
          />
        }
      >
        {icon ?? <Smile className="size-6" strokeWidth={1.5} />}
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <EmojiPickerReact
          theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
          onEmojiClick={(data) => {
            onSelect(data.emoji);
            setOpen(false);
          }}
          searchPlaceHolder="Rechercher un emoji"
          previewConfig={{ showPreview: false }}
          width={320}
          height={400}
        />
        {icon && (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className="flex min-h-10 w-full items-center justify-center gap-1.5 border-t border-border text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <X aria-hidden className="size-3.5" />
            Retirer l&apos;icône
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
