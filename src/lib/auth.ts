import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
};

/**
 * Obtém o usuário autenticado (ou redireciona para o login).
 *
 * `connection()` é obrigatório aqui: o SDK do Supabase Auth usa `Date.now()`
 * para validar a expiração do token, e o prerender do Cache Components
 * rejeita valores instáveis. Chamar `connection()` antes marca o trecho
 * como renderizado por requisição.
 */
export async function requireUser(): Promise<AuthUser> {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    name: profile?.name || user.email?.split("@")[0] || "Estudante",
    avatarUrl: profile?.avatar_url ?? null,
  };
}

/** Obtém o usuário sem redirecionar (pode ser `null`). */
export async function getUser(): Promise<AuthUser | null> {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    name: profile?.name || user.email?.split("@")[0] || "Estudante",
    avatarUrl: profile?.avatar_url ?? null,
  };
}
