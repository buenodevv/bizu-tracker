import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Renova a sessão do Supabase a cada requisição e mantém os cookies
 * sincronizados entre o navegador e os Server Components.
 *
 * No Next.js 16 o antigo `middleware.ts` passou a se chamar `proxy.ts`.
 */
/**
 * Compara rotas por segmento completo: `/auth` casa `/auth` e `/auth/...`,
 * mas não `/authors` ou `/authentication`.
 */
function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não executar código entre createServerClient e
  // supabase.auth.getUser(). Um erro simples pode causar dificuldade para
  // os usuários se desconectarem aleatoriamente.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAuthRoute =
    matchesRoute(pathname, "/login") ||
    matchesRoute(pathname, "/register") ||
    matchesRoute(pathname, "/forgot-password") ||
    matchesRoute(pathname, "/auth");

  // Rotas públicas, que não exigem sessão:
  // - /cycles/public/... → compartilhamento de ciclos
  // - /api/health        → healthcheck do container (nunca deve redirecionar)
  const isPublicRoute =
    matchesRoute(pathname, "/cycles/public") ||
    matchesRoute(pathname, "/api/health");

  // Usuário não autenticado tentando acessar área protegida.
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Usuário autenticado na tela de login/cadastro: vai para o dashboard.
  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas, exceto arquivos estáticos e imagens:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - arquivos com extensão (svg, png, jpg, ...)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
