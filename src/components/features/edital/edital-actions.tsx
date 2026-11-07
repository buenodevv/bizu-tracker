"use client";

import { useState, useTransition } from "react";

import { Check, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  approveEdital,
  createEdital,
  deleteEdital,
  deleteStudyArea,
} from "@/app/(app)/edital/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EditalListItem = {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE";
};

export function EditalActions({
  studyAreaId,
  areaName,
  editais,
}: {
  studyAreaId: string;
  areaName: string;
  editais: EditalListItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(editais.length === 0);
  const [title, setTitle] = useState(`${areaName} — Edital`);

  const handleCreate = () => {
    const t = title.trim();
    if (t.length < 2) {
      toast.error("Informe um título para o edital.");
      return;
    }

    startTransition(async () => {
      const res = await createEdital({ study_area_id: studyAreaId, title: t });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Edital criado! Agora adicione as disciplinas.");
        setCreating(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {editais.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-1.5 rounded-lg border px-2 py-1"
          >
            <FileText className="text-muted-foreground size-3.5" />
            <span className="max-w-50 truncate text-xs">{e.title}</span>
            <Badge
              variant={e.status === "ACTIVE" ? "default" : "outline"}
              className="text-[10px]"
            >
              {e.status === "ACTIVE" ? "ativo" : "rascunho"}
            </Badge>

            {e.status === "DRAFT" ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Ativar edital"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await approveEdital(e.id);
                    if (res?.error) toast.error(res.error);
                    else toast.success(res?.success ?? "Edital ativado!");
                  })
                }
              >
                <Check className="size-3" />
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Excluir edital"
              disabled={isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Excluir o edital "${e.title}" e todos os tópicos?`,
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  const res = await deleteEdital(e.id);
                  if (res?.error) toast.error(res.error);
                  else toast.success("Edital excluído.");
                });
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        {!creating ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
            disabled={isPending}
          >
            <Plus className="size-3.5" />
            Novo edital
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground ml-auto"
          disabled={isPending}
          onClick={() => {
            if (
              !window.confirm(
                `Excluir a área "${areaName}"? Isso remove edital, ciclos, sessões e questões vinculados.`,
              )
            ) {
              return;
            }
            startTransition(async () => {
              const res = await deleteStudyArea(studyAreaId);
              if (res?.error) toast.error(res.error);
              else toast.success("Área excluída.");
            });
          }}
        >
          <Trash2 className="size-3.5" />
          Excluir área
        </Button>
      </div>

      {creating ? (
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do edital"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            disabled={isPending}
            className="max-w-md"
          />
          <Button size="sm" onClick={handleCreate} disabled={isPending}>
            {isPending ? "Criando..." : "Criar"}
          </Button>
          {editais.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreating(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
