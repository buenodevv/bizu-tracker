import { Suspense } from "react";

import { requireUser } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { Brand, MainNav } from "@/components/features/layout/main-nav";
import { UserMenu } from "@/components/features/layout/user-menu";
import { MobileNav } from "@/components/features/layout/mobile-nav";
import { ThemeToggle } from "@/components/features/layout/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/features/layout/page-transition";

async function UserHeader() {
  const user = await requireUser();

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <MobileNav />
        </div>
        <span className="text-muted-foreground hidden text-sm md:inline">
          Olá, {firstName(user.name)} 👋
        </span>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
        />
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1">
      <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r md:flex">
        <Brand />
        <MainNav />
        <div className="mt-auto flex flex-col gap-1 border-t p-4">
          <p className="text-muted-foreground text-xs">
            Bizu Tracker · v0.1
          </p>
          <p className="text-muted-foreground text-xs leading-tight">
            © 2026 Rodrigo Bueno
          </p>
          <a
            href="mailto:rodrigojbueno@yahoo.com.br"
            className="text-muted-foreground hover:text-foreground text-xs leading-tight underline-offset-2 transition-colors hover:underline"
          >
            Dúvidas e sugestões
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense
          fallback={
            <div className="bg-background flex h-14 items-center justify-between border-b px-4 md:px-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          }
        >
          <UserHeader />
        </Suspense>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
