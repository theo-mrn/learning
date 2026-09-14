import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { AppHeader } from "@/components/app-header";
import { ProfileForm } from "@/components/account/profile-form";
import { PasswordForm } from "@/components/account/password-form";
import { DeviceList } from "@/components/account/device-list";
import { AccountDangerZone } from "@/components/account/account-danger-zone";

export const metadata = { title: "Mon compte · Notes" };

export default async function AccountPage() {
  const user = await requireUser();

  const [sessions, stats] = await Promise.all([
    db.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
      },
    }),
    // Ce que la suppression du compte emporterait : à afficher avant de la
    // proposer, pas après.
    Promise.all([
      db.page.count({ where: { userId: user.id } }),
      db.workspaceMember.count({ where: { userId: user.id } }),
    ]).then(([pageCount, workspaceCount]) => ({ pageCount, workspaceCount })),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        crumbs={[{ label: "Accueil", href: "/home" }, { label: "Mon compte" }]}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <header className="rule-accent">
          <h1 className="font-heading text-[clamp(1.75rem,5vw,2.25rem)] leading-tight text-foreground">
            Mon compte
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ton identité, ton mot de passe et les appareils connectés.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10">
          <ProfileForm
            user={{ name: user.name, email: user.email }}
            createdAt={null}
          />

          <PasswordForm />

          <DeviceList
            sessions={sessions.map((session) => ({
              id: session.id,
              userAgent: session.userAgent,
              ipAddress: session.ipAddress,
              lastUsedAt: session.lastUsedAt.toISOString(),
            }))}
          />

          <AccountDangerZone
            email={user.email}
            pageCount={stats.pageCount}
            workspaceCount={stats.workspaceCount}
          />
        </div>
      </main>
    </div>
  );
}
