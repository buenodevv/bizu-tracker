import { Suspense } from "react";

import Link from "next/link";
import {
  BookOpenCheck,
  CalendarCheck,
  ListChecks,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMinutes } from "@/lib/format";
import {
  AccuracyChart,
  HoursByDayChart,
  HoursBySubjectChart,
  HoursByTopicChart,
} from "@/components/features/analytics/charts";
import {
  RangeSelector,
  type RangeKey,
} from "@/components/features/analytics/range-selector";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Rendimento" };

const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

function resolveRange(raw?: string): RangeKey {
  return raw && raw in RANGE_DAYS ? (raw as RangeKey) : "30d";
}

async function AnalyticsContent({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range = resolveRange(rawRange);

  await requireUser();
  const supabase = await createClient();

  const now = new Date();
  const from = new Date();
  from.setDate(from.getDate() - RANGE_DAYS[range]);
  from.setHours(0, 0, 0, 0);

  const args = { _from: from.toISOString(), _to: now.toISOString() };

  const [totalsRes, bySubjectRes, byDayRes, accuracyRes, byTopicRes, coverageRes] =
    await Promise.all([
      supabase.rpc("analytics_totals", args),
      supabase.rpc("analytics_hours_by_subject", args),
      supabase.rpc("analytics_hours_by_day", args),
      supabase.rpc("analytics_accuracy_by_subject", args),
      supabase.rpc("analytics_hours_by_topic", args),
      supabase.rpc("analytics_edital_coverage"),
    ]);

  const totals = totalsRes.data?.[0];
  const bySubject = (bySubjectRes.data ?? []).map((r) => ({
    subject_name: r.subject_name,
    minutes: Number(r.minutes),
  }));
  const byDay = (byDayRes.data ?? []).map((r) => ({
    day: String(r.day),
    minutes: Number(r.minutes),
  }));
  const accuracy = (accuracyRes.data ?? []).map((r) => ({
    subject_name: r.subject_name,
    accuracy: Number(r.accuracy),
    total: Number(r.total),
  }));
  const byTopic = (byTopicRes.data ?? []).map((r) => ({
    topic_name: r.topic_name,
    subject_name: r.subject_name,
    minutes: Number(r.minutes),
  }));
  const coverage = (coverageRes.data ?? []).map((r) => ({
    subject_name: r.subject_name,
    total_topics: Number(r.total_topics),
    started_topics: Number(r.started_topics),
    done_topics: Number(r.done_topics),
    coverage_pct: Number(r.coverage_pct),
  }));

  const hasSessions = (totals?.total_sessions ?? 0) > 0;
  const rpcError =
    totalsRes.error ?? bySubjectRes.error ?? byDayRes.error ?? accuracyRes.error;

  const cards = [
    {
      label: "Tempo estudado",
      value: formatMinutes(Number(totals?.total_minutes ?? 0)),
      hint: `${Number(totals?.total_sessions ?? 0)} sessões`,
      icon: Timer,
    },
    {
      label: "Questões",
      value: String(Number(totals?.questions_total ?? 0)),
      hint: `${Number(totals?.accuracy ?? 0).toFixed(1)}% de acerto`,
      icon: ListChecks,
    },
    {
      label: "Dias ativos",
      value: String(Number(totals?.active_days ?? 0)),
      hint: `de ${RANGE_DAYS[range]} dias`,
      icon: CalendarCheck,
    },
    {
      label: "Média/dia ativo",
      value: (() => {
        const activeDays = Number(totals?.active_days ?? 0);
        const minutes = Number(totals?.total_minutes ?? 0);
        return activeDays > 0 ? formatMinutes(minutes / activeDays) : "—";
      })(),
      hint: "nos dias com estudo",
      icon: Target,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">
            Rendimento
          </h1>
          <p className="text-muted-foreground text-sm">
            Horas e desempenho no período selecionado.
          </p>
        </div>
        <RangeSelector value={range} />
      </div>

      {rpcError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Funções de analytics ausentes</CardTitle>
            <CardDescription>
              Rode a migration <code>supabase/migrations/0002_analytics.sql</code>{" "}
              no SQL Editor do Supabase para habilitar os gráficos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
              {rpcError.message}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {label}
              </CardTitle>
              <Icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{value}</div>
              <p className="text-muted-foreground text-xs">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas por matéria</CardTitle>
            <CardDescription>
              Onde seu tempo foi investido no período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasSessions ? (
              <HoursBySubjectChart data={bySubject} />
            ) : (
              <EmptyState
                icon={Timer}
                title="Sem sessões no período"
                description="Use o cronômetro para registrar seu primeiro estudo."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/timer" />}
                    nativeButton={false}
                  >
                    Abrir cronômetro
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução diária</CardTitle>
            <CardDescription>Tempo estudado por dia.</CardDescription>
          </CardHeader>
          <CardContent>
            {hasSessions ? (
              <HoursByDayChart data={byDay} />
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="Sem evolução ainda"
                description="Assim que houver sessões, seu progresso diário aparece aqui."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acurácia por matéria</CardTitle>
          <CardDescription>
            Matérias com menor acurácia aparecem primeiro. Priorize-as na revisão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accuracy.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nenhuma questão no período"
              description="Registre questões para acompanhar sua acurácia por matéria."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/questions" />}
                  nativeButton={false}
                >
                  Registrar questões
                </Button>
              }
            />
          ) : (
            <AccuracyChart data={accuracy} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tempo por tópico</CardTitle>
            <CardDescription>
              Onde seu tempo foi investido dentro de cada disciplina.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {byTopic.length === 0 ? (
              <EmptyState
                icon={Timer}
                title="Nenhum tópico registrado"
                description="Escolha um tópico ao usar o cronômetro para ver onde seu tempo foi investido."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/timer" />}
                    nativeButton={false}
                  >
                    Registrar sessão
                  </Button>
                }
              />
            ) : (
              <HoursByTopicChart data={byTopic} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cobertura do edital</CardTitle>
            <CardDescription>
              Quanto de cada disciplina você já concluiu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {coverage.length === 0 ? (
              <EmptyState
                icon={BookOpenCheck}
                title="Sem cobertura ainda"
                description="Adicione tópicos ao edital para acompanhar o quanto já concluiu."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/edital" />}
                    nativeButton={false}
                  >
                    Abrir edital
                  </Button>
                }
              />
            ) : (
              coverage.map((c) => (
                <div key={c.subject_name} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{c.subject_name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {c.done_topics}/{c.total_topics} concluídos ·{" "}
                      {c.coverage_pct}%
                    </span>
                  </div>
                  <Progress value={c.coverage_pct} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      }
    >
      <AnalyticsContent searchParams={searchParams} />
    </Suspense>
  );
}
