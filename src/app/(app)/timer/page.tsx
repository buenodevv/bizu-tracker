import { Suspense } from "react";

import { History } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_LABELS, formatDateTime, formatDuration } from "@/lib/format";
import {
  StudyTimer,
  type SubjectOption,
} from "@/components/features/timer/study-timer";
import { DeleteSessionButton } from "@/components/features/timer/delete-session-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Cronômetro" };

async function TimerContent() {
  const user = await requireUser();
  const supabase = await createClient();

  const [editalsRes, sessionsRes] = await Promise.all([
    supabase.from("editals").select("id").eq("user_id", user.id),
    supabase
      .from("study_sessions")
      .select("id, subject_name, topic_name, activity, duration_sec, started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  const editalIds = (editalsRes.data ?? []).map((e) => e.id);

  let subjects: SubjectOption[] = [];
  if (editalIds.length > 0) {
    // Busca a árvore inteira para montar matéria -> tópicos.
    const { data } = await supabase
      .from("edital_subjects")
      .select("id, name, parent_id, sort_order")
      .in("edital_id", editalIds)
      .order("sort_order")
      .order("name")
      .limit(2000);

    const all = data ?? [];

    // Matérias = nós raiz
    const roots = all.filter((n) => n.parent_id === null && n.name);

    // Agrupa os filhos diretos por matéria
    const childrenByParent = new Map<string, { id: string; name: string }[]>();
    for (const node of all) {
      if (!node.parent_id || !node.name) continue;
      const list = childrenByParent.get(node.parent_id) ?? [];
      list.push({ id: node.id, name: node.name });
      childrenByParent.set(node.parent_id, list);
    }

    // Remove duplicatas por nome (mesma matéria em editais diferentes)
    const seen = new Set<string>();
    subjects = [];
    for (const root of roots) {
      const key = root.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      subjects.push({
        id: root.id,
        name: root.name,
        topics: childrenByParent.get(root.id) ?? [],
      });
    }
  }

  const sessions = sessionsRes.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cronômetro</h1>
        <p className="text-muted-foreground text-sm">
          Estude em foco e registre a sessão ao terminar.
        </p>
      </div>

      <StudyTimer subjects={subjects} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Sessões recentes
          </CardTitle>
          <CardDescription>Suas últimas 10 sessões salvas.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nenhuma sessão registrada ainda. Inicie o cronômetro acima!
            </p>
          ) : (
            <>
              <div className="flex flex-col divide-y md:hidden">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {s.subject_name}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {s.topic_name ?? "Sem tópico"}
                      </span>
                      <span className="text-muted-foreground mt-0.5 text-xs">
                        {ACTIVITY_LABELS[s.activity]} ·{" "}
                        {formatDateTime(s.started_at)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-sm tabular-nums">
                        {formatDuration(s.duration_sec)}
                      </span>
                      <DeleteSessionButton id={s.id} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matéria</TableHead>
                      <TableHead>Tópico</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.subject_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-50 truncate">
                          {s.topic_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ACTIVITY_LABELS[s.activity]}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(s.started_at)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDuration(s.duration_sec)}
                        </TableCell>
                        <TableCell>
                          <DeleteSessionButton id={s.id} />
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

export default function TimerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      }
    >
      <TimerContent />
    </Suspense>
  );
}
