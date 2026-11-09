import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Cliente com a service role — **ignora RLS**.
 *
 * Use somente no servidor e apenas para operações globais que não pertencem a
 * um usuário específico (ex.: cache compartilhado de extração de edital).
 * Retorna `null` quando a chave não está configurada, permitindo desativar a
 * funcionalidade sem quebrar a aplicação.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
