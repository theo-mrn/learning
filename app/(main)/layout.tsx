import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SearchCommand } from "@/components/search-command";
import { ThemeGuard } from "@/components/theme-guard";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { readPreferences } from "@/lib/preferences";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La préférence est lue une seule fois, ici, et exposée par un attribut :
  // les espacements sont affaire de CSS, donc inutile de faire descendre un
  // booléen à travers chaque composant de la barre latérale et de l'éditeur.
  const user = await requireUser();
  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { preferences: true },
  });
  const { compactMode } = readPreferences(record.preferences);

  return (
    <SidebarProvider data-compact={compactMode ? "true" : undefined}>
      {/* Garde global : réapplique la classe `dark` que le Strict Mode efface
          en développement. Portée par le sélecteur de thème de la barre
          latérale jusqu'à son retrait, cette réparation devait être conservée
          quelque part — elle n'avait rien de spécifique au bouton. */}
      <ThemeGuard />
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
      <SearchCommand />
    </SidebarProvider>
  );
}
