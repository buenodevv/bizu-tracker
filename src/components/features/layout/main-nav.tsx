"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BookOpenCheck,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Repeat,
  Settings,
  Timer,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timer", label: "Cronômetro", icon: Timer },
  { href: "/questions", label: "Questões", icon: ListChecks },
  { href: "/analytics", label: "Rendimento", icon: TrendingUp },
  { href: "/cycles", label: "Ciclos", icon: Repeat },
  { href: "/edital", label: "Edital", icon: ClipboardList },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-4">
      <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
        <BookOpenCheck className="size-4" />
      </div>
      <span className="font-semibold tracking-tight">Bizu Tracker</span>
    </Link>
  );
}
