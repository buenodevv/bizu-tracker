"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { Minus, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { createCycle } from "@/app/(app)/cycles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { generateCycleBlocks, minutesByDay } from "@/lib/cycle-generator";
import { ACTIVITY_LABELS, formatMinutes } from "@/lib/format";
import type {
  ActivityType,
  Importance,
  ProgressStatus,
} from "@/types/database";

export type EditorTopic = {
  id: string;
  name: string;
  status: ProgressStatus;
  /** Data ISO da última sessão; null quando nunca estudado. */
  lastStudiedAt: string | null;
};

export type EditorSubject = {
  id: string | null;
  name: string;
  weight: number | null;
  importance: Importance;
  /** Tópicos do edital (2º nível). */
  topics: EditorTopic[];
};

export type EditorArea = { id: string; name: string };

type DraftBlock = {
  key: string;
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

export function CycleEditor({
  areas,
  subjects,
  defaultWeeklyGoalMin,
}: {
  areas: EditorArea[];
  subjects: EditorSubject[];
  defaultWeeklyGoalMin: number;
}) {
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [periodDays, setPeriodDays] = useState(6);
  const [goalPh, setGoalPh] = useState(defaultWeeklyGoalMin);
  const [blocks, setBlocks] = useState<DraftBlock[]>([]);
  const [isPending, startTransition] = useTransition();
  // Contador estável para gerar chaves (evita Date.now/Math.random no render).
  const keyCounter = useRef(0);
  const nextKey = (prefix: string) => `${prefix}-${keyCounter.current++}`;

  const totalMinutes = blocks.reduce((acc, b) => acc + b.minutes, 0);
  const perDay = useMemo(
    () => minutesByDay(blocks, periodDays),
    [blocks, periodDays],
  );
  const maxDay = Math.max(...perDay, 1);

  const topicsFor = (subjectName: string) =>
    subjects.find((s) => s.name === subjectName)?.topics ?? [];

  const canSave =
    name.trim().length >= 2 && areaId && blocks.length > 0 && !isPending;

  const generate = () => {
    if (subjects.length === 0) {
      toast.error("Nenhuma matéria encontrada. Crie um edital verticalizado.");
      return;
    }

    const generated = generateCycleBlocks({
      subjects,
      weeklyGoalMin: goalPh,
      daysPerWeek: periodDays,
    });

    if (generated.length === 0) {
      toast.error("Não foi possível gerar com esses parâmetros.");
      return;
    }

    setBlocks(
      generated.map((b, i) => ({
        key: nextKey(`gen-${i}`),
        subject_id: b.subject_id,
        subject_name: b.subject_name,
        topic_id: b.topic_id,
        topic_name: b.topic_name,
        activity: b.activity,
        minutes: b.minutes,
        day_of_cycle: b.day_of_cycle,
      })),
    );

    if (name.trim().length < 2) {
      setName(`Ciclo ${formatMinutes(goalPh)}/semana`);
    }

    toast.success(
      `${generated.length} blocos gerados com base no edital, nos tópicos e na meta.`,
    );
  };

  const addBlock = (day: number) => {
    const fallback = subjects[0];
    setBlocks((prev) => [
      ...prev,
      {
        key: nextKey("manual"),
        subject_id: fallback?.id ?? null,
        subject_name: fallback?.name ?? "",
        topic_id: null,
        topic_name: null,
        activity: "THEORY",
        minutes: 60,
        day_of_cycle: day,
      },
    ]);
  };

  const updateBlock = (key: string, patch: Partial<DraftBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    );
  };

  const removeBlock = (key: string) => {
    setBlocks((prev) => prev.filter((b) => b.key !== key));
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await createCycle({
        study_area_id: areaId,
        name: name.trim(),
        period_days: periodDays,
        blocks: blocks
          .filter((b) => b.subject_name.trim().length > 0 && b.minutes >= 5)
          .map((b, i) => ({
            subject_id: b.subject_id,
            subject_name: b.subject_name.trim(),
            topic_id: b.topic_id,
            topic_name: b.topic_name,
            activity: b.activity,
            minutes: b.minutes,
            day_of_cycle: Math.min(b.day_of_cycle, periodDays - 1),
            sort_order: i,
          })),
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success("Ciclo criado!");
      setName("");
      setBlocks([]);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo ciclo de estudo</CardTitle>
          <CardDescription>
            Gere automaticamente a partir do edital ou monte bloco a bloco.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="cycle-name">Nome</Label>
              <Input
                id="cycle-name"
                placeholder="Ex.: Ciclo 3h/dia"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cycle-area">Área de estudo</Label>
              {areas.length > 0 ? (
                <Select
                  value={areaId}
                  items={Object.fromEntries(areas.map((a) => [a.id, a.name]))}
                  onValueChange={(v) => v && setAreaId(v)}
                >
                  <SelectTrigger id="cycle-area" className="w-full">
                    <SelectValue placeholder="Escolha a área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Crie uma área de estudo primeiro.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cycle-days">Dias por ciclo</Label>
              <Select
                value={String(periodDays)}
                items={{ "5": "5 dias", "6": "6 dias", "7": "7 dias" }}
                onValueChange={(v) => v && setPeriodDays(Number(v))}
              >
                <SelectTrigger id="cycle-days" className="w-full">
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

            <div className="grid gap-2">
              <Label htmlFor="cycle-goal">Meta semanal (min)</Label>
              <Input
                id="cycle-goal"
                type="number"
                min={60}
                max={6000}
                step={30}
                value={goalPh}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setGoalPh(n);
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generate} variant="secondary">
              <Wand2 className="size-4" />
              Gerar a partir do edital
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBlocks([]);
                toast.info("Blocos limpos. Monte manualmente abaixo.");
              }}
            >
              Limpar blocos
            </Button>
            <Badge variant="outline" className="text-muted-foreground">
              <Sparkles className="size-3" />
              {subjects.length} matérias disponíveis
            </Badge>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              Total: <strong>{formatMinutes(totalMinutes)}</strong> em{" "}
              {blocks.length} {blocks.length === 1 ? "bloco" : "blocos"}
            </span>
            <Button onClick={handleSave} disabled={!canSave}>
              {isPending ? "Salvando..." : "Salvar ciclo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------- DIAS DO CICLO --------------------------- */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: periodDays }).map((_, day) => {
          const dayBlocks = blocks.filter((b) => b.day_of_cycle === day);
          const dayMinutes = perDay[day] ?? 0;

          // Dia vazio: linha compacta em vez de um card alto — no mobile,
          // vários cards vazios empurravam os ciclos salvos para muito abaixo.
          if (dayBlocks.length === 0) {
            return (
              <button
                key={day}
                type="button"
                onClick={() => addBlock(day)}
                className="border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/30 flex items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-3 text-left transition-colors"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-foreground text-sm font-medium">
                    {DAY_LABELS[day] ?? `Dia ${day + 1}`}
                  </span>
                  <span className="text-xs">{formatMinutes(dayMinutes)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs">
                  <Plus className="size-3.5" />
                  Adicionar bloco
                </span>
              </button>
            );
          }

          return (
            <Card key={day} size="sm">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">
                    {DAY_LABELS[day] ?? `Dia ${day + 1}`}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {formatMinutes(dayMinutes)}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Adicionar bloco em ${DAY_LABELS[day]}`}
                  onClick={() => addBlock(day)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {/* mini barra de carga do dia */}
                <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (dayMinutes / maxDay) * 100)}%` }}
                  />
                </div>

                {dayBlocks.map((block) => (
                    <div
                      key={block.key}
                      className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-2"
                    >
                      <div className="flex items-center gap-1.5">
                        {subjects.length > 0 ? (
                          <Select
                            value={block.subject_name}
                            items={Object.fromEntries(
                              subjects.map((s) => [s.name, s.name]),
                            )}
                            onValueChange={(v) =>
                              v &&
                              updateBlock(block.key, {
                                subject_name: v,
                                subject_id:
                                  subjects.find((s) => s.name === v)?.id ?? null,
                                // Troca de matéria limpa o tópico escolhido.
                                topic_id: null,
                                topic_name: null,
                              })
                            }
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
                            placeholder="Matéria"
                            onChange={(e) =>
                              updateBlock(block.key, {
                                subject_name: e.target.value,
                              })
                            }
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Remover bloco"
                          onClick={() => removeBlock(block.key)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      {topicsFor(block.subject_name).length > 0 ? (
                        <Select
                          value={block.topic_id ?? NO_TOPIC}
                          items={Object.fromEntries([
                            [NO_TOPIC, "Sem tópico"],
                            ...topicsFor(block.subject_name).map((t) => [
                              t.id,
                              t.name,
                            ]),
                          ])}
                          onValueChange={(v) => {
                            if (!v) return;
                            if (v === NO_TOPIC) {
                              updateBlock(block.key, {
                                topic_id: null,
                                topic_name: null,
                              });
                              return;
                            }
                            const topic = topicsFor(block.subject_name).find(
                              (t) => t.id === v,
                            );
                            if (!topic) return;
                            updateBlock(block.key, {
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

                      <div className="flex items-center gap-2">
                        <Select
                          value={block.activity}
                          items={ACTIVITY_LABELS}
                          onValueChange={(v) =>
                            v &&
                            updateBlock(block.key, {
                              activity: v as ActivityType,
                            })
                          }
                        >
                          <SelectTrigger size="sm" className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.entries(ACTIVITY_LABELS) as [
                                ActivityType,
                                string,
                              ][]
                            ).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon-xs"
                            aria-label="Diminuir 15 min"
                            onClick={() =>
                              updateBlock(block.key, {
                                minutes: Math.max(5, block.minutes - 15),
                              })
                            }
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-12 text-center text-xs tabular-nums">
                            {block.minutes}min
                          </span>
                          <Button
                            variant="outline"
                            size="icon-xs"
                            aria-label="Aumentar 15 min"
                            onClick={() =>
                              updateBlock(block.key, {
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
