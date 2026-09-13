"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/workspace-actions";

export function AcceptInvitationButton({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      await acceptInvitation(token);
    } catch (caught) {
      // `redirect()` de Next lève volontairement : ce n'est pas une erreur,
      // il ne faut ni l'afficher ni l'avaler.
      if (
        caught &&
        typeof caught === "object" &&
        "digest" in caught &&
        typeof caught.digest === "string" &&
        caught.digest.startsWith("NEXT_REDIRECT")
      ) {
        throw caught;
      }
      setError(
        caught instanceof Error ? caught.message : "Impossible d'accepter"
      );
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={accept} disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Rejoindre l&apos;espace
      </Button>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
