"use client";

import { useTransition } from "react";
import { Loader2, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutOtherDevices } from "@/lib/account-actions";

type DeviceSession = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
};

const RELATIVE = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, "hour");
  return RELATIVE.format(Math.round(hours / 24), "day");
}

/** Résumé lisible d'un `User-Agent`, sans bibliothèque : on ne cherche pas la
 * précision, seulement à reconnaître son propre appareil dans la liste. */
function describe(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: "Appareil inconnu", mobile: false };

  const mobile = /iPhone|iPad|Android|Mobile/i.test(userAgent);
  const navigateur = /Firefox\//.test(userAgent)
    ? "Firefox"
    : /Edg\//.test(userAgent)
      ? "Edge"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Navigateur";
  const systeme = /Mac OS X/.test(userAgent)
    ? "macOS"
    : /Windows/.test(userAgent)
      ? "Windows"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";

  return {
    label: systeme ? `${navigateur} sur ${systeme}` : navigateur,
    mobile,
  };
}

export function DeviceList({ sessions }: { sessions: DeviceSession[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <section>
      <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Appareils connectés
      </h2>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/50 shadow-paper">
        <ul>
          {sessions.map((session, index) => {
            const { label, mobile } = describe(session.userAgent);
            return (
              <li
                key={session.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  index > 0 ? "border-t border-border/60" : ""
                }`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {mobile ? (
                    <Smartphone className="size-4" />
                  ) : (
                    <Monitor className="size-4" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-medium">{label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Actif {relativeTime(session.lastUsedAt)}
                    {session.ipAddress && ` · ${session.ipAddress}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {sessions.length > 1 && (
          <div className="border-t border-border/60 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(() => void signOutOtherDevices())}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Déconnecter les autres appareils
            </Button>
          </div>
        )}
      </div>

      {sessions.length === 1 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Une seule session active : celle-ci.
        </p>
      )}
    </section>
  );
}
