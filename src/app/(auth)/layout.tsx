import Link from "next/link";

import {
  BookOpenCheck,
  FileText,
  Repeat,
  Timer,
  TrendingUp,
} from "lucide-react";

const FEATURES = [
  { icon: Timer, label: "Cronômetro com pomodoro e modo foco" },
  { icon: TrendingUp, label: "Rendimento por matéria e acurácia em questões" },
  { icon: Repeat, label: "Ciclos de estudo compartilháveis" },
  { icon: FileText, label: "Edital verticalizado gerado por IA" },
];

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

      <div className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:block">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-black/15 blur-3xl" />

        <div className="relative flex h-full flex-col justify-center gap-10 p-12">
          <blockquote className="space-y-4">
            <p className="text-3xl leading-tight font-medium text-balance">
              “Quem mede, melhora.”
            </p>
            <p className="text-primary-foreground/80 text-base text-balance">
              Tenha o controle do seu estudo em um só lugar: minutos, questões,
              ciclos e edital.
            </p>
          </blockquote>

          <ul className="space-y-3 text-sm">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4" />
                </span>
                <span className="text-primary-foreground/90">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
