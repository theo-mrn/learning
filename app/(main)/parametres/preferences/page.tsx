import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { AppHeader } from "@/components/app-header";
import { PreferencesForm } from "@/components/account/preferences-form";
import { readPreferences } from "@/lib/preferences";

export const metadata = { title: "Préférences · Notes" };

export default async function PreferencesPage() {
  const user = await requireUser();

  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { preferences: true },
  });

  // Le champ est libre en base : chaque valeur est validée, avec repli sur le
  // défaut plutôt que confiance au contenu.
  const preferences = readPreferences(record.preferences);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        crumbs={[{ label: "Accueil", href: "/home" }, { label: "Préférences" }]}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <header className="rule-accent">
          <h1 className="font-heading text-[clamp(1.75rem,5vw,2.25rem)] leading-tight text-foreground">
            Préférences
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            L&apos;apparence et le comportement de l&apos;éditeur.
          </p>
        </header>

        <div className="mt-10">
          <PreferencesForm preferences={preferences} />
        </div>
      </main>
    </div>
  );
}
