import Link from "next/link";

import { BookOpenCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <BookOpenCheck className="size-4" />
            </div>
            Bizu Tracker
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <div className="bg-muted relative hidden overflow-hidden lg:block">
        <div className="from-primary/15 to-background absolute inset-0 bg-gradient-to-br via-transparent" />
        <div className="relative flex h-full flex-col justify-center gap-6 p-12">
          <blockquote className="space-y-3">
            <p className="text-2xl font-medium text-balance">
              &ldquo;Quem mede, melhora. Tenha o controle do seu estudo em um
              só lugar.&rdquo;
            </p>
            <footer className="text-muted-foreground text-sm">
              Cronômetro, gráficos de rendimento, estatísticas de questões e
              edital verticalizado.
            </footer>
          </blockquote>

          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>⏱️ Cronômetro com pomodoro e modo foco</li>
            <li>📈 Rendimento por matéria e acurácia em questões</li>
            <li>🔁 Ciclos de estudo compartilháveis</li>
            <li>📄 Edital verticalizado gerado por IA</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
