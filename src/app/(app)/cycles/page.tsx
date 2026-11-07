import { Suspense } from "react";

import { Globe, Repeat } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  CycleEditor,
  type EditorArea,
  type EditorSubject,
} from "@/components/features/cycles/cycle-editor";
import {
  CycleCard,
  type CycleView,
} from "@/components/features/cycles/cycle-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActivityType, Importance } from "@/types/database";

export const metadata = { title: "Ciclos" };

type RawCycle = {
  id: string;
  name: string;
  description: string | null;
  period_days: number;
  is_public: boolean;
  source_cycle_id: string | null;
  user_id: string;
};

async function CyclesContent() {
  const user = await requireUser();
  const supabase = await createClient();

  const [profileRes, areasRes, cyclesRes, publicRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("weekly_goal_min")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("study_areas")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("cycles")
      .select(
        "id, name, description, period_days, is_public, source_cycle_id, user_id",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("cycles")
      .select(
        "id, name, description, period_days, is_public, source_cycle_id, user_id",
      )
      .eq("is_public", true)
      .neq("user_id", user.id)
      .limit(12),
  ]);

  const weeklyGoal = profileRes.data?.weekly_goal_min ?? 1200;
  const areas: EditorArea[] = (areasRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  // Matérias do edital (para gerar ciclos)
  const editalIds = areas.length
    ? (
        await supabase
          .from("editals")
          .select("id")
          .eq("user_id", user.id)
      ).data?.map((e) => e.id) ?? []
    : [];

  let subjects: EditorSubject[] = [];
  if (editalIds.length > 0) {
    const { data } = await supabase
      .from("edital_subjects")
      .select("id, name, weight, importance")
      .in("edital_id", editalIds)
      .is("parent_id", null)
      .order("sort_order")
      .limit(50);

    subjects = (data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      weight: s.weight === null ? null : Number(s.weight),
      importance: s.importance as Importance,
    }));
  }

  const myCyclesRaw = (cyclesRes.data ?? []) as RawCycle[];
  const publicCyclesRaw = (publicRes.data ?? []) as RawCycle[];

  // Busca os blocos de todos os ciclos exibidos de uma vez.
  const allIds = [...myCyclesRaw, ...publicCyclesRaw].map((c) => c.id);

  const blocksByCycle = new Map<string, CycleView["blocks"]>();

  if (allIds.length > 0) {
    const { data: blocks } = await supabase
      .from("cycle_blocks")
      .select("id, cycle_id, subject_id, subject_name, activity, minutes, day_of_cycle, sort_order")
      .in("cycle_id", allIds)
      .order("day_of_cycle")
      .order("sort_order");

    for (const b of blocks ?? []) {
      const list = blocksByCycle.get(b.cycle_id) ?? [];
      list.push({
        id: b.id,
        subject_id: b.subject_id,
        subject_name: b.subject_name,
        activity: b.activity as ActivityType,
        minutes: b.minutes,
        day_of_cycle: b.day_of_cycle,
      });
      blocksByCycle.set(b.cycle_id, list);
    }
  }

  const toView = (c: RawCycle): CycleView => ({
    id: c.id,
    name: c.name,
    description: c.description,
    period_days: c.period_days,
    is_public: c.is_public,
    source_cycle_id: c.source_cycle_id,
    blocks: blocksByCycle.get(c.id) ?? [],
    isOwn: c.user_id === user.id,
  });

  const myCycles = myCyclesRaw.map(toView);
  const publicCycles = publicCyclesRaw.map(toView);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Ciclos de estudo
        </h1>
        <p className="text-muted-foreground text-sm">
          Distribua suas matérias em blocos e repita o ciclo até fechar a meta.
        </p>
      </div>

      {areas.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Crie uma área de estudo</CardTitle>
            <CardDescription>
              Os ciclos precisam estar vinculados a um concurso ou vestibular.
              Crie uma área na página do Edital.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<a href="/edital" />} nativeButton={false}>
              Ir para o edital
            </Button>
          </CardContent>
        </Card>
      ) : (
        <CycleEditor
          areas={areas}
          subjects={subjects}
          defaultWeeklyGoalMin={weeklyGoal}
        />
      )}

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">
            Meus ciclos ({myCycles.length})
          </TabsTrigger>
          <TabsTrigger value="public">
            <Globe className="size-3.5" />
            Comunidade ({publicCycles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="flex flex-col gap-4 pt-4">
          {myCycles.length === 0 ? (
            <EmptyState
              title="Nenhum ciclo criado"
              description="Use o editor acima para gerar um ciclo automaticamente a partir do edital."
            />
          ) : (
            myCycles.map((c) => (
              <CycleCard
                key={c.id}
                cycle={c}
                subjectNames={subjects.map((s) => s.name)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="public" className="flex flex-col gap-4 pt-4">
          {publicCycles.length === 0 ? (
            <EmptyState
              title="Nenhum ciclo público ainda"
              description="Quando alguém compartilhar um ciclo publicamente, ele aparece aqui para você copiar."
            />
          ) : (
            publicCycles.map((c) => (
              <CycleCard
                key={c.id}
                cycle={c}
                subjectNames={subjects.map((s) => s.name)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="bg-muted text-muted-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
          <Repeat className="size-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function CyclesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      }
    >
      <CyclesContent />
    </Suspense>
  );
}
