"use client";

import { useState, useTransition } from "react";

import { Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { updateStudyArea } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AREA_TYPE_LABELS } from "@/lib/format";
import type { AreaType } from "@/types/database";

export type AreaItem = {
  id: string;
  name: string;
  target_type: AreaType;
  exam_board: string | null;
  exam_date: string | null;
};

export function StudyAreaEditor({ area }: { area: AreaItem }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(area.name);
  const [board, setBoard] = useState(area.exam_board ?? "");
  const [date, setDate] = useState(area.exam_date ?? "");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const res = await updateStudyArea({
        id: area.id,
        name,
        exam_board: board || null,
        exam_date: date || null,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Área atualizada!");
      setEditing(false);
    });
  };

  const cancel = () => {
    setName(area.name);
    setBoard(area.exam_board ?? "");
    setDate(area.exam_date ?? "");
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{area.name}</span>
          <Badge variant="outline">{AREA_TYPE_LABELS[area.target_type]}</Badge>
          {area.exam_board ? (
            <Badge variant="secondary">{area.exam_board}</Badge>
          ) : null}
          {area.exam_date ? (
            <span className="text-muted-foreground text-xs">
              prova:{" "}
              {new Date(`${area.exam_date}T12:00:00`).toLocaleDateString(
                "pt-BR",
              )}
            </span>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          aria-label={`Editar ${area.name}`}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={`name-${area.id}`}>Nome</Label>
          <Input
            id={`name-${area.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`board-${area.id}`}>Banca</Label>
          <Input
            id={`board-${area.id}`}
            value={board}
            placeholder="Ex.: FCC"
            onChange={(e) => setBoard(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`date-${area.id}`}>Data da prova</Label>
          <Input
            id={`date-${area.id}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={cancel} disabled={isPending}>
          <X className="size-3.5" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}
