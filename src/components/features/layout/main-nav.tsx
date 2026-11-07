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
              "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            {/* Barrinha lateral que indica a rota ativa */}
            <span
              className={cn(
                "bg-sidebar-primary absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full transition-all duration-200",
                active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
              )}
            />
            <Icon
              className={cn(
                "size-4 shrink-0 transition-transform duration-200",
                active ? "" : "group-hover:scale-110",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand() {
  return (
    <Link
      href="/dashboard"
      className="group flex items-center gap-2 px-4 py-4 transition-opacity hover:opacity-90"
    >
      <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-105">
        <BookOpenCheck className="size-4" />
      </div>
      <span className="font-semibold tracking-tight">Bizu Tracker</span>
    </Link>
  );
}
