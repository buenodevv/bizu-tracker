import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";

async function RedirectLogic(): Promise<null> {
  const user = await getUser();
  redirect(user ? "/dashboard" : "/login");
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
          Carregando...
        </div>
      }
    >
      <RedirectLogic />
    </Suspense>
  );
}
