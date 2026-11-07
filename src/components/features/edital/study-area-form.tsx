"use client";

import { useActionState, useState } from "react";

import { Plus } from "lucide-react";

import {
  createStudyArea,
  type EditalActionState,
} from "@/app/(app)/edital/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StudyAreaForm() {
  const [state, formAction, isPending] = useActionState<
    EditalActionState,
    FormData
  >(createStudyArea, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nova área de estudo
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="area-name">Nome</Label>
          <Input
            id="area-name"
            name="name"
            placeholder="Ex.: TRT-SP 2025 — Técnico"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="area-type">Tipo</Label>
          <Select
            name="target_type"
            defaultValue="CONCURSO"
            items={{ CONCURSO: "Concurso", VESTIBULAR: "Vestibular" }}
          >
            <SelectTrigger id="area-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CONCURSO">Concurso</SelectItem>
              <SelectItem value="VESTIBULAR">Vestibular</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="area-board">Banca (opcional)</Label>
          <Input id="area-board" name="exam_board" placeholder="Ex.: FCC" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="area-date">Data da prova (opcional)</Label>
          <Input id="area-date" name="exam_date" type="date" />
        </div>
      </div>

      {state?.error ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {state.success}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Criando..." : "Criar área"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
