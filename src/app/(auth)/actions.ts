"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type AuthActionState =
  | { error?: string; message?: string }
  | undefined;

/**
 * Aceita apenas caminhos internos. `//host` e `/\host` são interpretados
 * pelo navegador como URL protocol-relative e virariam open redirect.
 */
function safeInternalPath(target: string, fallback = "/dashboard"): string {
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(target)) return fallback;
  return target;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function translateError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (normalized.includes("user already registered")) {
    return "Já existe uma conta com este e-mail.";
  }
  if (normalized.includes("password should be at least")) {
    return "A senha é muito curta.";
  }
  if (normalized.includes("invalid email")) {
    return "Informe um e-mail válido.";
  }
  return message;
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: translateError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect(safeInternalPath(redirectTo));
}

export async function register(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) {
    return { error: "Informe seu nome (mínimo 2 caracteres)." };
  }
  if (!email) {
    return { error: "Informe um e-mail válido." };
  }
  if (password.length < 8) {
    return { error: "A senha deve ter ao menos 8 caracteres." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: translateError(error.message) };
  }

  // Com confirmação de e-mail habilitada, não há sessão imediatamente.
  if (!data.session) {
    return {
      message:
        "Conta criada! Verifique seu e-mail para confirmar o cadastro.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** Envia o e-mail de redefinição de senha (mensagem sempre genérica). */
export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Informe o e-mail da sua conta." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Rota dedicada: a URL de redirect pode ser exata na allowlist do Supabase.
    redirectTo: `${siteUrl()}/auth/reset`,
  });

  if (error) {
    return {
      error:
        "Não foi possível enviar o e-mail agora. Aguarde instantes e tente novamente.",
    };
  }

  return {
    message:
      "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
  };
}

/** Define a nova senha a partir da sessão de recuperação. */
export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Link expirado. Solicite uma nova redefinição de senha.",
    };
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    return { error: "A senha deve ter ao menos 8 caracteres." };
  }
  if (password !== confirm) {
    return { error: "As senhas não coincidem." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: translateError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
