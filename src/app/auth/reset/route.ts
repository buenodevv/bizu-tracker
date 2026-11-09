import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { trustedOrigin } from "@/lib/auth-redirect";

/**
 * Callback exclusivo do link de recuperação de senha.
 *
 * Rota separada para que a URL de redirect configurada no Supabase seja
 * exata (`/auth/reset`), sem depender de query string na allowlist.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = trustedOrigin(requestUrl);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL("/reset-password", origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=recovery", origin));
}
