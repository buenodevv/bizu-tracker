import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath, trustedOrigin } from "@/lib/auth-redirect";

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
