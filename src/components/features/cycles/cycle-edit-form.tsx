"use client";

import { useState, useTransition } from "react";

import { Check, Minus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { updateCycle } from "@/app/(app)/cycles/actions";
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
import { ACTIVITY_LABELS, formatMinutes } from "@/lib/format";
import type { EditorSubject } from "@/components/features/cycles/cycle-editor";
import type { ActivityType } from "@/types/database";

export type EditBlock = {
  subject_id: string | null;
  subject_name: string;
  topic_id: string | null;
  topic_name: string | null;
  activity: ActivityType;
  minutes: number;
  day_of_cycle: number;
};

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
/** Sentinela do Select para "sem tópico" (Select não aceita valor vazio). */
const NO_TOPIC = "__none__";

export function CycleEditForm({
  cycleId,
  initialName,
  initialDescription,
  initialPeriodDays,
  initialBlocks,
  subjects,
  onDone,
}: {
  cycleId: string;
  initialName: string;
  initialDescription: string | null;
  initialPeriodDays: number;
  initialBlocks: EditBlock[];
  subjects: EditorSubject[];
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [periodDays, setPeriodDays] = useState(initialPeriodDays);
  const [blocks, setBlocks] = useState<EditBlock[]>(initialBlocks);
  const [isPending, startTransition] = useTransition();

  const total = blocks.reduce((acc, b) => acc + b.minutes, 0);

  const topicsFor = (subjectName: string) =>
    subjects.find((s) => s.name === subjectName)?.topics ?? [];

  const updateBlock = (index: number, patch: Partial<EditBlock>) => {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const save = () => {
    if (name.trim().length < 2) {
      toast.error("Dê um nome ao ciclo.");
      return;
    }
    if (blocks.length === 0) {
      toast.error("O ciclo precisa de ao menos um bloco.");
      return;
    }

    startTransition(async () => {
      const res = await updateCycle(cycleId, {
        name: name.trim(),
        description: description.trim() || null,
        period_days: periodDays,
        blocks: blocks.map((b, i) => ({
          subject_id: b.subject_id,
          subject_name: b.subject_name.trim(),
          topic_id: b.topic_id,
          topic_name: b.topic_name,
          activity: b.activity,
          minutes: b.minutes,
          // Ajusta blocos de dias que deixaram de existir.
          day_of_cycle: Math.min(b.day_of_cycle, periodDays - 1),
          sort_order: i,
        })),
      });

      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Ciclo atualizado!");
      onDone();
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`name-${cycleId}`} className="text-xs">
            Nome
          </Label>
          <Input
            id={`name-${cycleId}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`days-${cycleId}`} className="text-xs">
            Dias por ciclo
          </Label>
          <Select
            value={String(periodDays)}
            items={{ "5": "5 dias", "6": "6 dias", "7": "7 dias" }}
            onValueChange={(v) => v && setPeriodDays(Number(v))}
          >
            <SelectTrigger id={`days-${cycleId}`} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 6, 7].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`desc-${cycleId}`} className="text-xs">
            Descrição (opcional)
          </Label>
          <Input
            id={`desc-${cycleId}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8"
            placeholder="Ex.: foco em revisão"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {blocks.length} blocos, {formatMinutes(total)} no total
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {blocks.map((block, index) => (
            <div
              key={index}
              className="bg-muted/40 flex flex-col gap-1.5 rounded-lg border p-2"
            >
              <div className="flex items-center gap-1.5">
                {subjects.length > 0 ? (
                  <Select
                    value={block.subject_name}
                    items={Object.fromEntries(
                      subjects.map((s) => [s.name, s.name]),
                    )}
                    onValueChange={(v) => {
                      if (!v) return;
                      const subject = subjects.find((s) => s.name === v);
                      updateBlock(index, {
                        subject_name: v,
                        subject_id: subject?.id ?? null,
                        // Troca de matéria limpa o tópico escolhido.
                        topic_id: null,
                        topic_name: null,
                      });
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue placeholder="Matéria" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-7"
                    value={block.subject_name}
                    onChange={(e) =>
                      updateBlock(index, {
                        subject_name: e.target.value,
                        subject_id: null,
                        topic_id: null,
                        topic_name: null,
                      })
                    }
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remover bloco"
                  onClick={() => removeBlock(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {topicsFor(block.subject_name).length > 0 ? (
                <Select
                  value={block.topic_id ?? NO_TOPIC}
                  items={Object.fromEntries([
                    [NO_TOPIC, "Sem tópico"],
                    ...topicsFor(block.subject_name).map((t) => [t.id, t.name]),
                  ])}
                  onValueChange={(v) => {
                    if (!v) return;
                    if (v === NO_TOPIC) {
                      updateBlock(index, { topic_id: null, topic_name: null });
                      return;
                    }
                    const topic = topicsFor(block.subject_name).find(
                      (t) => t.id === v,
                    );
                    if (!topic) return;
                    updateBlock(index, {
                      topic_id: topic.id,
                      topic_name: topic.name,
                    });
                  }}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Tópico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TOPIC}>Sem tópico</SelectItem>
                    {topicsFor(block.subject_name).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <div className="flex items-center gap-1.5">
                <Select
                  value={String(block.day_of_cycle)}
                  items={Object.fromEntries(
                    Array.from({ length: periodDays }, (_, d) => [
                      String(d),
                      DAY_LABELS[d] ?? `Dia ${d + 1}`,
                    ]),
                  )}
                  onValueChange={(v) => v && updateBlock(index, { day_of_cycle: Number(v) })}
                >
                  <SelectTrigger size="sm" className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: periodDays }).map((_, d) => (
                      <SelectItem key={d} value={String(d)}>
                        {DAY_LABELS[d] ?? `Dia ${d + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={block.activity}
                  items={ACTIVITY_LABELS}
                  onValueChange={(v) =>
                    v && updateBlock(index, { activity: v as ActivityType })
                  }
                >
                  <SelectTrigger size="sm" className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-0.5">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    aria-label="Diminuir 15 min"
                    onClick={() =>
                      updateBlock(index, {
                        minutes: Math.max(5, block.minutes - 15),
                      })
                    }
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-11 text-center text-xs tabular-nums">
                    {block.minutes}min
                  </span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    aria-label="Aumentar 15 min"
                    onClick={() =>
                      updateBlock(index, {
                        minutes: Math.min(600, block.minutes + 15),
                      })
                    }
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setBlocks((prev) => [
              ...prev,
              {
                subject_id: subjects[0]?.id ?? null,
                subject_name: subjects[0]?.name ?? "",
                topic_id: null,
                topic_name: null,
                activity: "THEORY",
                minutes: 60,
                day_of_cycle: 0,
              },
            ])
          }
        >
          <Plus className="size-3.5" />
          Adicionar bloco
        </Button>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={isPending}>
          <Check className="size-3.5" />
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={isPending}
        >
          <X className="size-3.5" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}
