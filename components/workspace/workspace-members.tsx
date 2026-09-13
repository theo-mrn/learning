"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Loader2, Mail, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createInvitation,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type InviteState,
} from "@/lib/workspace-actions";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  editor: "Éditeur",
  viewer: "Lecture seule",
};

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function WorkspaceMembers({
  workspaceId,
  currentUserId,
  canManage,
  members,
  invitations,
}: {
  workspaceId: string;
  currentUserId: string;
  canManage: boolean;
  members: {
    userId: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    role: string;
  }[];
  invitations: { id: string; email: string | null; role: string; expiresAt: string }[];
}) {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    createInvitation.bind(null, workspaceId),
    undefined
  );
  const [copied, setCopied] = useState(false);

  async function copyLink(path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé (permission, contexte non sécurisé) : le lien
      // reste sélectionnable à la main dans le champ.
    }
  }

  return (
    <section id="membres">
      <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Membres
      </h2>

      <ul className="overflow-hidden rounded-xl border border-border/70 bg-card/50 shadow-paper">
        {members.map((member, index) => (
          <li
            key={member.userId}
            className={`flex items-center gap-3 px-4 py-3 ${
              index > 0 ? "border-t border-border/60" : ""
            }`}
          >
            <Avatar className="size-8 rounded-lg after:rounded-lg">
              {member.avatarUrl && (
                <AvatarImage src={member.avatarUrl} alt="" className="rounded-lg" />
              )}
              <AvatarFallback className="rounded-lg bg-primary/15 text-xs font-medium text-primary">
                {initials(member.name, member.email)}
              </AvatarFallback>
            </Avatar>

            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">
                {member.name ?? member.email.split("@")[0]}
                {member.userId === currentUserId && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    (toi)
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {member.email}
              </span>
            </span>

            {canManage && member.userId !== currentUserId ? (
              <>
                <select
                  defaultValue={member.role}
                  onChange={(e) =>
                    updateMemberRole(workspaceId, member.userId, e.target.value)
                  }
                  aria-label={`Rôle de ${member.email}`}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                >
                  <option value="owner">Propriétaire</option>
                  <option value="editor">Éditeur</option>
                  <option value="viewer">Lecture seule</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeMember(workspaceId, member.userId)}
                  aria-label={`Retirer ${member.email}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            ) : (
              <Badge variant="outline" className="shrink-0">
                {ROLE_LABELS[member.role] ?? member.role}
              </Badge>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <>
          {/* Invitations en attente */}
          {invitations.length > 0 && (
            <ul className="mt-3 overflow-hidden rounded-xl border border-dashed border-border/70 bg-card/30">
              {invitations.map((invitation, index) => (
                <li
                  key={invitation.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    index > 0 ? "border-t border-border/60" : ""
                  }`}
                >
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm">
                      {invitation.email ?? "Lien ouvert"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[invitation.role]} · expire le{" "}
                      {new Date(invitation.expiresAt).toLocaleDateString("fr-FR")}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => revokeInvitation(invitation.id)}
                    aria-label="Révoquer l'invitation"
                    className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Nouvelle invitation */}
          <form
            action={action}
            className="mt-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-4 shadow-paper"
          >
            <p className="text-sm font-medium">Inviter quelqu&apos;un</p>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label htmlFor="invite-email">
                  Email <span className="text-muted-foreground">(optionnel)</span>
                </Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="Laisser vide pour un lien ouvert"
                  aria-invalid={Boolean(state?.errors?.email)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-role">Rôle</Label>
                <select
                  id="invite-role"
                  name="role"
                  defaultValue="editor"
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
                >
                  <option value="editor">Éditeur</option>
                  <option value="viewer">Lecture seule</option>
                </select>
              </div>

              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Créer le lien
              </Button>
            </div>

            {state?.errors?.email?.map((error) => (
              <p key={error} className="text-xs text-destructive">
                {error}
              </p>
            ))}

            {/* Le lien n'apparaît qu'une fois : la base n'en garde que
                l'empreinte, il est donc impossible de le réafficher. */}
            {state?.link && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-medium">
                  Copie ce lien maintenant — il ne sera plus affiché.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${typeof window === "undefined" ? "" : window.location.origin}${state.link}`}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(state.link!)}
                  >
                    {copied ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copied ? "Copié" : "Copier"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Aucun email n&apos;est envoyé : transmets-le toi-même.
                </p>
              </div>
            )}
          </form>
        </>
      )}
    </section>
  );
}
