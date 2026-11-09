import { Suspense } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  History,
  ListChecks,
  Target,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, LEVEL_LABELS, RESULT_LABELS } from "@/lib/format";
import {
  QuestionForm,
  type SubjectOption,
} from "@/components/features/questions/question-form";
import { DeleteQuestionButton } from "@/components/features/questions/delete-question-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Questões" };

type QuestionRow = {
  id: string;
  subject_name: string;
  exam_board: string | null;
  level: keyof typeof LEVEL_LABELS;
  result: keyof typeof RESULT_LABELS;
  took_sec: number | null;
  answered_at: string;
  notes: string | null;
};

async function QuestionsContent() {
  const user = await requireUser();
  const supabase = await createClient();

  const [editalsRes, recentRes, allRes] = await Promise.all([
    supabase.from("editals").select("id").eq("user_id", user.id),
    supabase
      .from("questions")
      .select(
        "id, subject_name, exam_board, level, result, took_sec, answered_at, notes",
      )
      .eq("user_id", user.id)
      .order("answered_at", { ascending: false })
      .limit(25),
    supabase
      .from("questions")
      .select("subject_name, result")
      .eq("user_id", user.id)
      .limit(5000),
  ]);

  const editalIds = (editalsRes.data ?? []).map((e) => e.id);

  let subjects: SubjectOption[] = [];
  if (editalIds.length > 0) {
    const { data } = await supabase
      .from("edital_subjects")
      .select("id, name")
      .in("edital_id", editalIds)
      .is("parent_id", null)
      .order("name")
      .limit(100);

    subjects = (data ?? [])
      .filter((s) => Boolean(s.name))
      .map((s) => ({ id: s.id, name: s.name }));
  }

  const recent = (recentRes.data ?? []) as QuestionRow[];
  const all = allRes.data ?? [];

  // Lista de bancas já usadas (para autocomplete).
  const boards = Array.from(
    new Set(recent.map((r) => r.exam_board).filter(Boolean) as string[]),
  ).sort();

  // ---- Estatísticas gerais ----
  const answered = all.filter((q) => q.result !== "SKIPPED");
  const correct = all.filter((q) => q.result === "CORRECT");
  const accuracy =
    answered.length > 0 ? Math.round((correct.length / answered.length) * 100) : 0;

  // ---- Acurácia por matéria ----
  const bySubject = new Map<
    string,
    { total: number; correct: number; wrong: number; skipped: number }
  >();

  for (const q of all) {
    const entry = bySubject.get(q.subject_name) ?? {
      total: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
    };
    entry.total += 1;
    if (q.result === "CORRECT") entry.correct += 1;
    else if (q.result === "WRONG") entry.wrong += 1;
    else entry.skipped += 1;
    bySubject.set(q.subject_name, entry);
  }

  const subjectStats = Array.from(bySubject.entries())
    .map(([name, v]) => {
      const answeredCount = v.correct + v.wrong;
      return {
        name,
        ...v,
        accuracy:
          answeredCount > 0
            ? Math.round((v.correct / answeredCount) * 100)
            : 0,
      };
    })
    .filter((s) => s.correct + s.wrong > 0)
    .sort((a, b) => a.accuracy - b.accuracy);

  const weakest = subjectStats.slice(0, 3);
  const hasQuestions = all.length > 0;

  const cards = [
    {
      label: "Questões resolvidas",
      value: String(all.length),
      hint: `${answered.length} válidas (sem pular)`,
      icon: ListChecks,
    },
    {
      label: "Acurácia geral",
      value: `${accuracy}%`,
      hint: `${correct.length} acertos`,
      icon: Target,
    },
    {
      label: "Matérias treinadas",
      value: String(subjectStats.length),
      hint: hasQuestions ? "com questões registradas" : "comece agora",
      icon: TrendingUp,
    },
    {
      label: "Melhor matéria",
      value:
        subjectStats.length > 0
          ? `${subjectStats[subjectStats.length - 1].accuracy}%`
          : "—",
      hint: subjectStats.length > 0 ? subjectStats[subjectStats.length - 1].name : "sem dados",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">
          Questões
        </h1>
        <p className="text-muted-foreground text-sm">
          Registre suas questões e acompanhe a acurácia por matéria.
        </p>
      </div>

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
              <p className="text-muted-foreground truncate text-xs">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <QuestionForm subjects={subjects} boards={boards} />

      {weakest.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" />
              Pontos de atenção
            </CardTitle>
            <CardDescription>
              Matérias com menor acurácia — priorize revisões nelas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {weakest.map((s) => (
              <div key={s.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {s.accuracy}% de acerto ({s.correct}/{s.correct + s.wrong})
                  </span>
                </div>
                <Progress
                  value={s.accuracy}
                  className={
                    s.accuracy >= 70
                      ? ""
                      : s.accuracy >= 50
                        ? "[&>div]:bg-amber-500"
                        : "[&>div]:bg-destructive"
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Histórico recente
          </CardTitle>
          <CardDescription>Últimas 25 questões registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nenhuma questão registrada"
              description="Use o painel acima para lançar seu primeiro registro."
            />
          ) : (
            <>
              <div className="flex flex-col divide-y md:hidden">
                {recent.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {q.subject_name}
                        </span>
                        <Badge
                          variant={
                            q.result === "CORRECT"
                              ? "default"
                              : q.result === "WRONG"
                                ? "destructive"
                                : "secondary"
                          }
                          className="shrink-0"
                        >
                          {RESULT_LABELS[q.result]}
                        </Badge>
                      </div>
                      {q.notes ? (
                        <span className="text-muted-foreground truncate text-xs">
                          {q.notes}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground mt-0.5 text-xs">
                        {q.exam_board ?? "Sem banca"}, {LEVEL_LABELS[q.level]},{" "}
                        {formatDateTime(q.answered_at)}
                      </span>
                    </div>
                    <DeleteQuestionButton id={q.id} />
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matéria</TableHead>
                      <TableHead>Banca</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{q.subject_name}</span>
                            {q.notes ? (
                              <span className="text-muted-foreground text-xs">
                                {q.notes}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {q.exam_board ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {LEVEL_LABELS[q.level]}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              q.result === "CORRECT"
                                ? "default"
                                : q.result === "WRONG"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {RESULT_LABELS[q.result]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(q.answered_at)}
                        </TableCell>
                        <TableCell>
                          <DeleteQuestionButton id={q.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuestionsPage() {
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
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      }
    >
      <QuestionsContent />
    </Suspense>
  );
}
