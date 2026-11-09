import Link from "next/link";

import { BookOpenCheck } from "lucide-react";

import { ThemeToggle } from "@/components/features/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/#recursos", label: "Recursos" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#duvidas", label: "Dúvidas" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#conteudo"
        className="bg-background focus:ring-ring sr-only rounded-lg px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:ring-2"
      >
        Pular para o conteúdo
      </a>

      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <BookOpenCheck className="size-4" />
            </span>
            <span className="hidden sm:inline">Bizu Tracker</span>
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Seções da página"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-3 py-2 text-sm transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/login" />}
              nativeButton={false}
            >
              Entrar
            </Button>
            <Button
              size="sm"
              render={<Link href="/register" />}
              nativeButton={false}
            >
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      <main id="conteudo" className="flex-1">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <Link
              href="/"
              className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
                <BookOpenCheck className="size-4" />
              </span>
              Bizu Tracker
            </Link>
            <p className="text-muted-foreground text-sm">
              Planejamento e acompanhamento de estudos para concursos e
              vestibulares.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-12 gap-y-8 text-sm">
            <div className="flex flex-col gap-2">
              <p className="font-medium">Produto</p>
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-medium">Conta</p>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Criar conta
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-medium">Legal</p>
              <Link
                href="/termos"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Termos de uso
              </Link>
              <Link
                href="/privacidade"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacidade
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t">
          <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs sm:px-6 md:flex-row md:items-center md:justify-between">
            <p>© 2026 Rodrigo Bueno. Todos os direitos reservados.</p>
            <a
              href="mailto:rodrigojbueno@yahoo.com.br"
              className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
            >
              rodrigojbueno@yahoo.com.br
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
