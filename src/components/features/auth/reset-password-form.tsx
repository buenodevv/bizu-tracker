"use client";

import { useActionState } from "react";

import Link from "next/link";

import { updatePassword, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState<
    AuthActionState,
    FormData
  >(updatePassword, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Criar nova senha
        </h1>
        <p className="text-muted-foreground text-sm">
          Escolha uma senha com ao menos 8 caracteres.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="password">Nova senha</Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm_password">Confirmar senha</Label>
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            minLength={8}
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
          {isPending ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/login"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
