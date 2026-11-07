import { Suspense } from "react";

import { requireUser } from "@/lib/auth";
import { Brand, MainNav } from "@/components/features/layout/main-nav";
import { UserMenu } from "@/components/features/layout/user-menu";
import { MobileNav } from "@/components/features/layout/mobile-nav";
import { Skeleton } from "@/components/ui/skeleton";

async function UserHeader() {
  const user = await requireUser();

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <MobileNav />
        </div>
        <span className="text-muted-foreground hidden text-sm md:inline">
          Olá, {user.name.split(" ")[0]} 👋
        </span>
      </div>
      <UserMenu name={user.name} email={user.email} />
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1">
      <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r md:flex">
        <Brand />
        <MainNav />
        <div className="mt-auto p-4">
          <p className="text-muted-foreground text-xs">
            Bizu Tracker · v0.1
          </p>
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

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
