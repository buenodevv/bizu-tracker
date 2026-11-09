"use client";

import { useActionState } from "react";
import Link from "next/link";

import { login, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm({
  redirectTo,
  error,
}: {
  redirectTo?: string;
  error?: string;
}) {
  const [state, formAction, isPending] = useActionState<
    AuthActionState,
    FormData
  >(login, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-muted-foreground text-sm">
          Acesse sua conta para continuar estudando.
        </p>
      </div>

      <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />

      {error ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
        >
          {error === "recovery"
            ? "O link de recuperação expirou. Solicite um novo."
            : "Não foi possível confirmar sua conta. Tente entrar novamente."}
        </p>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="voce@email.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Senha</Label>
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {state?.error ? (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
          >
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </Button>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        Ainda não tem conta?{" "}
        <Link
          href="/register"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}
