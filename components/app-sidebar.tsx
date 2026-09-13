import { FileText, Home, Plus, Trash2 } from "lucide-react";
import { canWrite, requireUser } from "@/lib/dal";
import { getActiveWorkspace, listWorkspaces } from "@/lib/workspace";
import { getPageTree } from "@/lib/pages";
import { createPage } from "@/lib/actions";
import { SidebarSortableGroup } from "@/components/sidebar-tree";
import { SearchTriggerButton } from "@/components/search-trigger-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNavLink } from "@/components/sidebar-nav-link";
import { SidebarAccount } from "@/components/sidebar-account";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export async function AppSidebar() {
  const [user, workspace, workspaces] = await Promise.all([
    requireUser(),
    getActiveWorkspace(),
    listWorkspaces(),
  ]);
  const tree = await getPageTree(workspace.id);
  const canEdit = canWrite(workspace.role);

  return (
    <Sidebar>
      {/* Trois zones nettes : l'espace en haut, les pages au milieu (seule
          zone qui défile), le compte en bas — la hiérarchie ne bouge plus
          d'un écran à l'autre. */}
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Le vrai nombre de membres, et la liste réelle des espaces :
                les deux étaient codés en dur. */}
            <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Navigation primaire, sans étiquette : deux entrées évidentes qui
            n'ont pas besoin d'un titre de section pour se comprendre. */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SearchTriggerButton />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarNavLink href="/home" icon={<Home />} label="Accueil" />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* L'arborescence : l'action « ajouter » vit dans l'en-tête du
            groupe, là où on la cherche, au lieu d'un bouton en pied. */}
        <SidebarGroup className="min-h-0 flex-1 pt-1">
          <SidebarGroupLabel className="text-[0.7rem] font-medium tracking-[0.08em] text-sidebar-foreground/50 uppercase">
            Pages
          </SidebarGroupLabel>
          {/* Rien à créer en lecture seule : l'action serait refusée. */}
          {canEdit && (
            <form action={createPage.bind(null, null)}>
              <SidebarGroupAction
                type="submit"
                title="Nouvelle page"
                aria-label="Créer une nouvelle page"
              >
                <Plus />
              </SidebarGroupAction>
            </form>
          )}

          <SidebarGroupContent className="overflow-y-auto">
            {tree.length === 0 ? (
              /* État vide de l'arborescence : on dit quoi faire au lieu de
                 laisser une zone muette. */
              <div className="px-2 py-3">
                <p className="flex items-center gap-1.5 text-xs text-sidebar-foreground/50">
                  <FileText aria-hidden className="size-3.5 shrink-0" />
                  Aucune page
                </p>
                {canEdit && (
                  <form action={createPage.bind(null, null)} className="mt-2">
                    <button
                      type="submit"
                      className="w-full rounded-md border border-dashed border-sidebar-border px-2 py-1.5 text-xs text-sidebar-foreground/70 transition-colors duration-150 hover:border-solid hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                      Créer la première page
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <SidebarMenu className="gap-0.5">
                <SidebarSortableGroup pages={tree} />
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-0 border-t border-sidebar-border p-2">
        {/* Utilitaires discrets au-dessus du compte : ni l'un ni l'autre
            n'est une action principale, donc aucun n'est mis en avant. */}
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarNavLink
              href="/trash"
              icon={<Trash2 />}
              label="Corbeille"
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="my-1.5 h-px bg-sidebar-border" />

        {/* Le compte, ancré tout en bas — la convention attendue. */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarAccount
              user={{
                name: user.name ?? user.email.split("@")[0],
                email: user.email,
                avatarUrl: user.avatarUrl,
                role: workspace.role,
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
