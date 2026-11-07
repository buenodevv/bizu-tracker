import { NextResponse } from "next/server";

/**
 * Healthcheck do container.
 *
 * Não acessa banco nem sessão: apenas confirma que o servidor HTTP está
 * respondendo. Um healthcheck que depende do Supabase pode derrubar o
 * container durante indisponibilidades externas.
 *
 * A rota é liberada no `proxy.ts` — sem isso o redirect para /login faria
 * o healthcheck falhar.
 */
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
