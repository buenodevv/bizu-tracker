import { Suspense } from "react";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenCheck, Repeat } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_LABELS, formatMinutes } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityType } from "@/types/database";

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const metadata: Metadata = {
  title: "Ciclo de estudo compartilhado",
  robots: { index: false },
};

async function PublicCycleBody({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // O RLS permite ler ciclos com is_public = true sem autenticação.
  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name, description, period_days, is_public")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();

  if (!cycle) notFound();

  const { data: blocks } = await supabase
    .from("cycle_blocks")
    .select("id, subject_name, activity, minutes, day_of_cycle, sort_order")
    .eq("cycle_id", id)
    .order("day_of_cycle")
    .order("sort_order");

  const list = blocks ?? [];
  const total = list.reduce((acc, b) => acc + b.minutes, 0);

  const byDay = Array.from({ length: cycle.period_days }, (_, day) =>
    list.filter((b) => b.day_of_cycle === day),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <BookOpenCheck className="size-4" />
          </div>
          Bizu Tracker
        </Link>
        <Button render={<Link href="/register" />} nativeButton={false} size="sm">
          Criar minha conta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {cycle.name}
            <Badge variant="secondary">ciclo compartilhado</Badge>
          </CardTitle>
          <CardDescription>
            {list.length} blocos · {formatMinutes(total)} · {cycle.period_days}{" "}
            dias
          </CardDescription>
        </CardHeader>
        {cycle.description ? (
          <CardContent>
            <p className="text-muted-foreground text-sm">{cycle.description}</p>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {byDay.map((dayBlocks, day) => {
          const minutes = dayBlocks.reduce((acc, b) => acc + b.minutes, 0);
          return (
            <Card key={day} size="sm">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">
                  {DAY_LABELS[day] ?? `Dia ${day + 1}`}
                </CardTitle>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {minutes > 0 ? formatMinutes(minutes) : "—"}
                </span>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {dayBlocks.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Descanso</p>
                ) : (
                  dayBlocks.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate">{b.subject_name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {b.minutes}min ·{" "}
                        {ACTIVITY_LABELS[b.activity as ActivityType]}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardHeader className="items-center text-center">
          <div className="bg-muted text-muted-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
            <Repeat className="size-5" />
          </div>
          <CardTitle className="text-base">Gostou deste ciclo?</CardTitle>
          <CardDescription>
            Crie sua conta no Bizu Tracker para copiar este ciclo, usar o
            cronômetro e acompanhar seu rendimento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button render={<Link href="/register" />} nativeButton={false}>
            Começar agora
          </Button>
        </CardContent>
      </Card>

      <footer className="text-muted-foreground/70 flex flex-col items-center gap-1 pt-2 pb-4 text-xs">
        <p>© 2026 Rodrigo Bueno</p>
        <p>
          Dúvidas e sugestões:{" "}
          <a
            href="mailto:rodrigojbueno@yahoo.com.br"
            className="hover:text-foreground underline-offset-2 transition-colors hover:underline"
          >
            rodrigojbueno@yahoo.com.br
          </a>
        </p>
      </footer>
    </div>
  );
}

export default function PublicCyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      }
    >
      <PublicCycleBody params={params} />
    </Suspense>
  );
}
