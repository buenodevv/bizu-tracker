import { Suspense } from "react";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  ListChecks,
  Repeat,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMinutes, toLocalDateKey } from "@/lib/format";
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

async function DashboardStats() {
  const user = await requireUser();
  const supabase = await createClient();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const streakWindow = new Date();
  streakWindow.setDate(streakWindow.getDate() - 90);
  streakWindow.setHours(0, 0, 0, 0);

  const [profileRes, areasRes, sessionsRes, questionsRes, streakRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("weekly_goal_min")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("study_areas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("study_sessions")
        .select("duration_sec")
        .eq("user_id", user.id)
        .gte("started_at", weekAgo.toISOString()),
      supabase
        .from("questions")
        .select("result")
        .eq("user_id", user.id)
        .gte("answered_at", weekAgo.toISOString()),
      supabase
        .from("study_sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .gte("started_at", streakWindow.toISOString()),
    ]);

  const weeklyGoal = profileRes.data?.weekly_goal_min ?? 1200;
  const areaCount = areasRes.count ?? 0;

  const minutesThisWeek =
    (sessionsRes.data ?? []).reduce((acc, s) => acc + (s.duration_sec ?? 0), 0) /
    60;

  const questions = questionsRes.data ?? [];
  const answered = questions.filter((q) => q.result !== "SKIPPED").length;
  const correct = questions.filter((q) => q.result === "CORRECT").length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  const goalPct = Math.min(
    100,
    Math.round((minutesThisWeek / Math.max(weeklyGoal, 1)) * 100),
  );

  // ---- Sequência de dias consecutivos com estudo ----
  const studyDays = new Set(
    (streakRes.data ?? []).map((s) => toLocalDateKey(new Date(s.started_at))),
  );

  let streak = 0;
  const cursor = new Date();
  // Se hoje ainda não estudou, a sequência pode começar ontem.
  if (!studyDays.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (studyDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const stats = [
    {
      label: "Meta semanal",
      value: `${formatMinutes(minutesThisWeek)} / ${formatMinutes(weeklyGoal)}`,
      hint: `${goalPct}% da meta`,
      icon: Target,
    },
    {
      label: "Questões (7 dias)",
      value: String(questions.length),
      hint: `${accuracy}% de acerto`,
      icon: ListChecks,
    },
    {
      label: "Áreas de estudo",
      value: String(areaCount),
      hint: areaCount === 0 ? "Comece criando uma" : "ativas",
      icon: BookOpenCheck,
    },
    {
      label: "Sequência",
      value: streak > 0 ? `${streak} ${streak === 1 ? "dia" : "dias"}` : "—",
      hint: streak > 0 ? "de estudo seguidos 🔥" : "estude hoje para começar",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bem-vindo de volta, {user.name.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground text-sm">
          Aqui está o resumo dos seus últimos 7 dias de estudo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, hint, icon: Icon }, index) => (
          <Card
            key={label}
            className="card-hover animate-fade-in-up"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {label}
              </CardTitle>
              <Icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">
                {value}
              </div>
              <p className="text-muted-foreground text-xs">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {areaCount === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Vamos começar 🚀</CardTitle>
            <CardDescription>
              Crie sua primeira área de estudo (concurso ou vestibular) para
              desbloquear cronômetro, questões, ciclos e edital verticalizado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/edital" />} nativeButton={false}>
              Criar área de estudo
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-medium">Acesso rápido</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: "/timer",
              icon: Timer,
              title: "Cronômetro",
              desc: "Registre uma sessão de estudo agora",
            },
            {
              href: "/questions",
              icon: ListChecks,
              title: "Questões",
              desc: "Lance questões e acompanhe a acurácia",
            },
            {
              href: "/analytics",
              icon: TrendingUp,
              title: "Rendimento",
              desc: "Veja horas e acurácia por matéria",
            },
            {
              href: "/cycles",
              icon: Repeat,
              title: "Ciclos",
              desc: "Crie, gere e compartilhe ciclos",
            },
            {
              href: "/edital",
              icon: ClipboardList,
              title: "Edital verticalizado",
              desc: "Envie o PDF e deixe a IA organizar",
            },
          ].map(({ href, icon: Icon, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="hover:bg-muted/50 hover:border-primary/30 group flex items-start gap-3 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
            >
              <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-105">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-muted-foreground text-xs">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Badge variant="outline" className="text-muted-foreground w-fit">
        MVP em construção · Fase 0
      </Badge>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      }
    >
      <DashboardStats />
    </Suspense>
  );
}
