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
 * Nome de exibição. O trigger `handle_new_user` grava o e-mail como nome
 * quando o cadastro não traz `name`; nesse caso derivamos algo legível da
 * parte local em vez de mostrar o e-mail completo na interface.
 */
function resolveDisplayName(
  profileName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = profileName?.trim();
  if (name && !name.includes("@")) return name;

  const local = email?.split("@")[0]?.trim();
  if (!local) return "Estudante";

  return local
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)([a-z])/g, (_, space: string, letter: string) => {
      return space + letter.toUpperCase();
    });
}

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
    name: resolveDisplayName(profile?.name, user.email),
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
    name: resolveDisplayName(profile?.name, user.email),
    avatarUrl: profile?.avatar_url ?? null,
  };
}
