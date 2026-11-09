import { Suspense } from "react";

import { LoginForm } from "@/components/features/auth/login-form";

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;
  return <LoginForm redirectTo={redirectTo} error={error} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-sm">Carregando...</div>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
