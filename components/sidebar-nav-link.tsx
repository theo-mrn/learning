"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarMenuButton } from "@/components/ui/sidebar";

/**
 * Un lien de navigation de la sidebar qui connaît sa propre route active.
 * L'emplacement courant doit être visible (et pas seulement déductible),
 * donc `isActive` est calculé ici plutôt que passé depuis chaque écran.
 */
export function SidebarNavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <SidebarMenuButton
      isActive={isActive}
      render={<Link href={href} aria-current={isActive ? "page" : undefined} />}
    >
      {icon}
      <span>{label}</span>
    </SidebarMenuButton>
  );
}
