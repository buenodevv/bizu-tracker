"use client";

import { useState, useTransition } from "react";

import { Check, Minus, Plus, RotateCcw, Save, SkipForward, X } from "lucide-react";
import { toast } from "sonner";

import {
  createQuestion,
  createQuestionBatch,
} from "@/app/(app)/questions/actions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEVEL_LABELS } from "@/lib/format";
import type { QuestionLevel, QuestionResult } from "@/types/database";

export type SubjectOption = { id: string; name: string };

type Props = {
  subjects: SubjectOption[];
  boards: string[];
};

type Counters = { CORRECT: number; WRONG: number; SKIPPED: number };

const EMPTY_COUNTERS: Counters = { CORRECT: 0, WRONG: 0, SKIPPED: 0 };

export function QuestionForm({ subjects, boards }: Props) {
  const [subjectName, setSubjectName] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [examBoard, setExamBoard] = useState("");
  const [level, setLevel] = useState<QuestionLevel>("MEDIUM");
  const [notes, setNotes] = useState("");
  const [counters, setCounters] = useState<Counters>(EMPTY_COUNTERS);
  const [isPending, startTransition] = useTransition();

  const total = counters.CORRECT + counters.WRONG + counters.SKIPPED;
  const answered = counters.CORRECT + counters.WRONG;
  const accuracy =
    answered > 0 ? Math.round((counters.CORRECT / answered) * 100) : 0;

  const canSave = subjectName.trim().length >= 2 && total > 0;

  const increment = (key: keyof Counters) =>
    setCounters((c) => ({ ...c, [key]: c[key] + 1 }));

  const decrement = (key: keyof Counters) =>
    setCounters((c) => ({ ...c, [key]: Math.max(0, c[key] - 1) }));

  const resetAll = () => {
    setCounters(EMPTY_COUNTERS);
    setNotes("");
  };

  const handleSaveBatch = () => {
    startTransition(async () => {
      const res = await createQuestionBatch({
        subject_name: subjectName.trim(),
        subject_id: subjectId,
        exam_board: examBoard || null,
        level,
        correct: counters.CORRECT,
        wrong: counters.WRONG,
        skipped: counters.SKIPPED,
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(
        `${res.count} ${res.count === 1 ? "questão registrada" : "questões registradas"}!`,
      );
      resetAll();
    });
  };

  // Registro detalhado: uma questão por vez, com nível e anotação.
  const handleSaveSingle = (result: QuestionResult) => {
    if (subjectName.trim().length < 2) {
      toast.error("Escolha a matéria primeiro.");
      return;
    }

    startTransition(async () => {
      const res = await createQuestion({
        subject_name: subjectName.trim(),
        subject_id: subjectId,
        exam_board: examBoard || null,
        level,
        result,
        notes: notes || null,
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success("Questão registrada!");
      setNotes("");
    });
  };

  const subjectField = (
    <div className="grid gap-2">
      <Label htmlFor="q-subject">Matéria</Label>
      {subjects.length > 0 ? (
        <Select
          value={subjectId ?? ""}
          items={Object.fromEntries(subjects.map((s) => [s.id, s.name]))}
          onValueChange={(value) => {
            const picked = subjects.find((s) => s.id === value);
            setSubjectId(picked?.id ?? null);
            setSubjectName(picked?.name ?? "");
          }}
        >
          <SelectTrigger id="q-subject" className="w-full">
            <SelectValue placeholder="Escolha a matéria" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Input
        aria-label="Nome da matéria"
        placeholder="Ex.: Direito Constitucional"
        value={subjectName}
        onChange={(e) => {
          setSubjectName(e.target.value);
          setSubjectId(null);
        }}
      />
    </div>
  );

  const examBoardField = (
    <div className="grid gap-2">
      <Label htmlFor="q-board">Banca (opcional)</Label>
      <Input
        id="q-board"
        list="boards-list"
        placeholder="Ex.: FCC, CEBRASPE"
        value={examBoard}
        onChange={(e) => setExamBoard(e.target.value)}
      />
      <datalist id="boards-list">
        {boards.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar questões</CardTitle>
        <CardDescription>
          Use o modo rápido para lançar um bloco de questões de uma vez.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quick">
          <TabsList>
            <TabsTrigger value="quick">Rápido</TabsTrigger>
            <TabsTrigger value="detail">Detalhado</TabsTrigger>
          </TabsList>

          {/* ---------------------------- MODO RÁPIDO --------------------------- */}
          <TabsContent value="quick" className="flex flex-col gap-5 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {subjectField}
              {examBoardField}
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-3">
              <CounterButton
                label="Acertei"
                count={counters.CORRECT}
                tone="success"
                onAdd={() => increment("CORRECT")}
                onRemove={() => decrement("CORRECT")}
                icon={<Check className="size-4" />}
              />
              <CounterButton
                label="Errei"
                count={counters.WRONG}
                tone="danger"
                onAdd={() => increment("WRONG")}
                onRemove={() => decrement("WRONG")}
                icon={<X className="size-4" />}
              />
              <CounterButton
                label="Pulei"
                count={counters.SKIPPED}
                tone="neutral"
                onAdd={() => increment("SKIPPED")}
                onRemove={() => decrement("SKIPPED")}
                icon={<SkipForward className="size-4" />}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{total} no total</Badge>
                {answered > 0 ? (
                  <Badge variant={accuracy >= 70 ? "default" : "outline"}>
                    {accuracy}% de acerto
                  </Badge>
                ) : null}
                {total > 0 ? (
                  <Button variant="ghost" size="sm" onClick={resetAll}>
                    <RotateCcw className="size-3.5" />
                    Zerar
                  </Button>
                ) : null}
              </div>

              <Button onClick={handleSaveBatch} disabled={!canSave || isPending}>
                <Save className="size-4" />
                {isPending ? "Salvando..." : `Salvar ${total || ""}`}
              </Button>
            </div>
          </TabsContent>

          {/* --------------------------- MODO DETALHADO ------------------------- */}
          <TabsContent value="detail" className="flex flex-col gap-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {subjectField}
              {examBoardField}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="q-level">Nível</Label>
              <Select
                value={level}
                items={LEVEL_LABELS}
                onValueChange={(v) => v && setLevel(v as QuestionLevel)}
              >
                <SelectTrigger id="q-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEVEL_LABELS) as QuestionLevel[]).map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {LEVEL_LABELS[lvl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="q-notes">Anotação (opcional)</Label>
              <Input
                id="q-notes"
                placeholder="Ex.: errei por confundir prazos"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                onClick={() => handleSaveSingle("CORRECT")}
                disabled={isPending}
                variant="outline"
                className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                <Check className="size-4" />
                Acertei
              </Button>
              <Button
                onClick={() => handleSaveSingle("WRONG")}
                disabled={isPending}
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <X className="size-4" />
                Errei
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function CounterButton({
  label,
  count,
  tone,
  icon,
  onAdd,
  onRemove,
}: {
  label: string;
  count: number;
  tone: "success" | "danger" | "neutral";
  icon: React.ReactNode;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70"
      : tone === "danger"
        ? "border-destructive/40 bg-destructive/5 hover:border-destructive/70"
        : "border-border bg-muted/30 hover:border-foreground/30";

  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 ${toneClasses}`}>
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </span>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onRemove}
          disabled={count === 0}
          aria-label={`Remover ${label}`}
        >
          <Minus className="size-3.5" />
        </Button>
        <span className="text-2xl font-semibold tabular-nums">{count}</span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onAdd}
          aria-label={`Adicionar ${label}`}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
