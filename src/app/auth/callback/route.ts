import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const DEFAULT_REDIRECT = "/dashboard";

/**
 * Aceita apenas caminhos internos. `//host` e `/\host` são interpretados
 * pelo navegador como URL protocol-relative e virariam open redirect.
 */
function safeNextPath(value: string | null): string {
  if (!value) return DEFAULT_REDIRECT;
  if (!value.startsWith("/")) return DEFAULT_REDIRECT;
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_REDIRECT;
  if (/[\r\n]/.test(value)) return DEFAULT_REDIRECT;
  return value;
}

/**
 * Origem confiável para o redirect. Preferimos a URL pública configurada;
 * `x-forwarded-host` não é usado porque é um header controlável pelo cliente.
 */
function trustedOrigin(requestUrl: URL): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Configuração inválida: cai na origem da requisição.
    }
  }
  return requestUrl.origin;
}

/**
 * Callback do Supabase Auth (confirmação de e-mail, magic link, OAuth).
 * Troca o `code` por uma sessão e redireciona para o destino.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = trustedOrigin(requestUrl);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
