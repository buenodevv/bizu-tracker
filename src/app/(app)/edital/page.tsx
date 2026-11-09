import { Suspense } from "react";

import { ClipboardList } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AREA_TYPE_LABELS } from "@/lib/format";
import {
  EditalSummary,
  EditalTree,
  type SubjectNode,
} from "@/components/features/edital/edital-tree";
import { StudyAreaForm } from "@/components/features/edital/study-area-form";
import { EditalUpload } from "@/components/features/edital/edital-upload";
import { getLlmProvider } from "@/lib/ai/extract-edital";
import { EditalActions } from "@/components/features/edital/edital-actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AreaType, EditalStatus, Importance } from "@/types/database";

export const metadata = { title: "Edital verticalizado" };

type AreaRow = {
  id: string;
  name: string;
  target_type: AreaType;
  exam_board: string | null;
};

type EditalRow = {
  id: string;
  study_area_id: string;
  title: string;
  status: EditalStatus;
};

async function EditalContent() {
  const aiConfigured = getLlmProvider() !== null;
  const user = await requireUser();
  const supabase = await createClient();

  const [areasRes, editalsRes] = await Promise.all([
    supabase
      .from("study_areas")
      .select("id, name, target_type, exam_board")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("editals")
      .select("id, study_area_id, title, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const areas = (areasRes.data ?? []) as AreaRow[];
  const editals = (editalsRes.data ?? []) as EditalRow[];

  const editalIds = editals.map((e) => e.id);

  const subjectsByEdital = new Map<string, SubjectNode[]>();
  if (editalIds.length > 0) {
    const { data } = await supabase
      .from("edital_subjects")
      .select(
        "id, edital_id, parent_id, name, importance, weight, sort_order, progress_studied",
      )
      .in("edital_id", editalIds)
      .order("sort_order");

    for (const s of data ?? []) {
      const list = subjectsByEdital.get(s.edital_id) ?? [];
      list.push({
        id: s.id,
        parent_id: s.parent_id,
        name: s.name,
        importance: s.importance as Importance,
        weight: s.weight === null ? null : Number(s.weight),
        sort_order: s.sort_order,
        progress_studied: Math.round(Number(s.progress_studied ?? 0)),
      });
      subjectsByEdital.set(s.edital_id, list);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edital verticalizado
          </h1>
          <p className="text-muted-foreground text-sm">
            Organize disciplinas e tópicos para gerar seus ciclos de estudo.
          </p>
        </div>
        <StudyAreaForm />
      </div>

      {areas.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="bg-muted text-muted-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
              <ClipboardList className="size-5" />
            </div>
            <CardTitle className="text-base">
              Comece criando uma área de estudo
            </CardTitle>
            <CardDescription>
              A área de estudo (concurso ou vestibular) agrupa seu edital,
              ciclos, sessões e questões.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {areas.map((area) => {
            const areaEditais = editals.filter(
              (e) => e.study_area_id === area.id,
            );

            return (
              <Card key={area.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {area.name}
                    <Badge variant="outline">
                      {AREA_TYPE_LABELS[area.target_type]}
                    </Badge>
                    {area.exam_board ? (
                      <Badge variant="secondary">{area.exam_board}</Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>
                    {areaEditais.length === 0
                      ? "Nenhum edital ainda — crie um abaixo."
                      : `${areaEditais.length} ${areaEditais.length === 1 ? "edital" : "editais"}`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-6">
                  <EditalActions
                    studyAreaId={area.id}
                    areaName={area.name}
                    editais={areaEditais.map((e) => ({
                      id: e.id,
                      title: e.title,
                      status: e.status,
                    }))}
                  />

                  {areaEditais.map((edital) => {
                    const subjects = subjectsByEdital.get(edital.id) ?? [];
                    return (
                      <div key={edital.id} className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium">
                              {edital.title}
                            </h3>
                            <Badge
                              variant={
                                edital.status === "ACTIVE"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {edital.status === "ACTIVE"
                                ? "ativo"
                                : "rascunho"}
                            </Badge>
                          </div>
                          <EditalSummary subjects={subjects} />
                        </div>

                        <EditalUpload
                          editalId={edital.id}
                          aiConfigured={aiConfigured}
                        />

                        <EditalTree
                          editalId={edital.id}
                          subjects={subjects}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EditalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      }
    >
      <EditalContent />
    </Suspense>
  );
}
