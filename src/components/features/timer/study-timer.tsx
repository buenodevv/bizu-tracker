"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import {
  Pause,
  Play,
  RotateCcw,
  Save,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import { saveStudySession } from "@/app/(app)/timer/actions";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTimerNow } from "@/components/features/timer/timer-provider";
import { ACTIVITY_LABELS, formatClock, formatDuration } from "@/lib/format";
import { primeTimerAudio } from "@/lib/timer-audio";
import {
  getElapsedSeconds,
  getPhaseTotalSeconds,
  PHASE_LABELS,
  useTimerStore,
} from "@/store/timer-store";
import type { ActivityType } from "@/types/database";

export type TopicOption = {
  id: string;
  name: string;
};

export type SubjectOption = {
  id: string;
  name: string;
  /** Tópicos da disciplina (2º nível do edital). */
  topics: TopicOption[];
};

export function StudyTimer({ subjects }: { subjects: SubjectOption[] }) {
  const state = useTimerStore();
  const {
    mode,
    setMode,
    status,
    subjectName,
    subjectId,
    topicId,
    activity,
    setSessionConfig,
    pomodoro,
    setPomodoro,
    phase,
    completedFocusSessions,
    soundEnabled,
    setSoundEnabled,
    start,
    pause,
    resume,
    reset,
    finish,
  } = state;

  const now = useTimerNow();
  const [isSaving, startTransition] = useTransition();
  const [showSettings, setShowSettings] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const elapsed = getElapsedSeconds(state, now);
  const phaseTotal = getPhaseTotalSeconds(state);

  const displaySeconds = useMemo(() => {
    if (mode === "pomodoro" && phaseTotal !== null) {
      return Math.max(0, phaseTotal - elapsed);
    }
    return elapsed;
  }, [mode, phaseTotal, elapsed]);

  const progressPct =
    mode === "pomodoro" && phaseTotal
      ? Math.min(100, (elapsed / phaseTotal) * 100)
      : 0;

  // Disciplina selecionada (para listar seus tópicos).
  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId) ?? null,
    [subjects, subjectId],
  );

  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isFinished = status === "finished";
  const canStart = subjectName.trim().length >= 2;

  const handleFinish = useCallback(() => {
    const result = finish();
    if (!result) {
      toast.error("Sessão muito curta para ser salva.");
      return;
    }

    const current = useTimerStore.getState();
    startTransition(async () => {
      const res = await saveStudySession({
        subject_name: current.subjectName.trim(),
        subject_id: current.subjectId,
        study_area_id: current.studyAreaId,
        topic_id: current.topicId,
        topic_name: current.topicName || null,
        activity: current.activity,
        duration_sec: result.durationSec,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Sessão de ${formatDuration(result.durationSec)} salva!`);
        setLastSaved(result.durationSec);
      }
      reset();
    });
  }, [finish, reset, startTransition]);

  // Aviso sonoro + troca de fase são tratados pelo TimerProvider global.
  const cycleLabel = `${completedFocusSessions}/${pomodoro.cyclesUntilLongBreak}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Relógio */}
      <Card
        className={`transition-shadow duration-500 ${
          isRunning ? "timer-glow" : ""
        }`}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>{mode === "pomodoro" ? "Pomodoro" : "Cronômetro"}</CardTitle>
              <CardDescription>
                {mode === "pomodoro"
                  ? `Fase atual: ${PHASE_LABELS[phase]}, ciclos ${cycleLabel}`
                  : "Tempo livre: pare quando quiser e salve a sessão."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={mode === "stopwatch" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("stopwatch")}
                disabled={isRunning || isPaused}
              >
                Livre
              </Button>
              <Button
                variant={mode === "pomodoro" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("pomodoro")}
                disabled={isRunning || isPaused}
              >
                Pomodoro
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-6 py-8">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`font-mono text-6xl font-semibold tracking-tight tabular-nums transition-colors duration-300 sm:text-7xl ${
                isRunning ? "text-primary" : ""
              }`}
              aria-live="polite"
            >
              {formatClock(displaySeconds)}
            </div>
            {mode === "pomodoro" ? (
              <Badge variant="secondary">{PHASE_LABELS[phase]}</Badge>
            ) : isFinished && lastSaved ? (
              <Badge variant="secondary">
                Última sessão: {formatDuration(lastSaved)}
              </Badge>
            ) : null}
          </div>

          {mode === "pomodoro" ? (
            <Progress
              value={progressPct}
              className={`h-2 w-full max-w-md transition-opacity duration-300 ${
                isRunning ? "shimmer-bar" : ""
              }`}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {!isRunning && !isPaused && !isFinished ? (
              <Button
                size="lg"
                onClick={() => {
                  primeTimerAudio();
                  start();
                }}
                disabled={!canStart}
                title={canStart ? undefined : "Escolha a matéria primeiro"}
              >
                <Play className="size-4" />
                Iniciar
              </Button>
            ) : null}

            {isRunning ? (
              <Button size="lg" variant="outline" onClick={pause}>
                <Pause className="size-4" />
                Pausar
              </Button>
            ) : null}

            {isPaused ? (
              <Button
                size="lg"
                onClick={() => {
                  primeTimerAudio();
                  resume();
                }}
              >
                <Play className="size-4" />
                Retomar
              </Button>
            ) : null}

            {(isRunning || isPaused) ? (
              <Button
                size="lg"
                variant="secondary"
                onClick={handleFinish}
                disabled={isSaving}
              >
                <Save className="size-4" />
                {isSaving ? "Salvando..." : "Encerrar e salvar"}
              </Button>
            ) : null}

            {(isRunning || isPaused || isFinished) ? (
              <Button size="lg" variant="ghost" onClick={reset} disabled={isSaving}>
                <RotateCcw className="size-4" />
                Descartar
              </Button>
            ) : null}
          </div>

          {!canStart ? (
            <p className="text-muted-foreground text-center text-sm">
              Selecione a matéria para começar.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Configuração da sessão */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessão</CardTitle>
            <CardDescription>O que você vai estudar agora</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subject">Matéria</Label>
              {subjects.length > 0 ? (
                <>
                  <Select
                    value={subjectId ?? ""}
                    items={Object.fromEntries(
                      subjects.map((s) => [s.id, s.name]),
                    )}
                    onValueChange={(value) => {
                      const picked = subjects.find((s) => s.id === value);
                      setSessionConfig({
                        subjectId: picked?.id ?? null,
                        subjectName: picked?.name ?? "",
                        // Troca de matéria limpa o tópico selecionado.
                        topicId: null,
                        topicName: "",
                      });
                    }}
                    disabled={isRunning || isPaused}
                  >
                    <SelectTrigger id="subject" className="w-full">
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
                  <p className="text-muted-foreground text-xs">
                    Ou digite uma matéria livre:
                  </p>
                </>
              ) : null}
              <Input
                aria-label="Nome da matéria"
                placeholder="Ex.: Direito Constitucional"
                value={subjectName}
                onChange={(e) =>
                  setSessionConfig({
                    subjectName: e.target.value,
                    subjectId: null,
                    topicId: null,
                    topicName: "",
                  })
                }
                disabled={isRunning || isPaused}
              />

              {/* Tópico da disciplina selecionada */}
              {selectedSubject && selectedSubject.topics.length > 0 ? (
                <div className="mt-1 grid gap-2">
                  <Label htmlFor="topic">Tópico</Label>
                  <Select
                    value={topicId ?? ""}
                    items={Object.fromEntries(
                      selectedSubject.topics.map((t) => [t.id, t.name]),
                    )}
                    onValueChange={(value) => {
                      const picked = selectedSubject.topics.find(
                        (t) => t.id === value,
                      );
                      setSessionConfig({
                        topicId: picked?.id ?? null,
                        topicName: picked?.name ?? "",
                      });
                    }}
                    disabled={isRunning || isPaused}
                  >
                    <SelectTrigger id="topic" className="w-full">
                      <SelectValue placeholder="Qual tópico vai estudar?" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSubject.topics.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Opcional — ajuda a medir o progresso por assunto.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="activity">Atividade</Label>
              <Select
                value={activity}
                items={ACTIVITY_LABELS}
                onValueChange={(value) =>
                  setSessionConfig({ activity: value as ActivityType })
                }
                disabled={isRunning || isPaused}
              >
                <SelectTrigger id="activity" className="w-full">
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
            </div>
          </CardContent>
        </Card>

        {mode === "pomodoro" ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Pomodoro</CardTitle>
                <CardDescription>
                  {pomodoro.focusMin} / {pomodoro.shortBreakMin} /{" "}
                  {pomodoro.longBreakMin} min
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowSettings((v) => !v)}
                aria-label="Configurar pomodoro"
              >
                <Settings2 className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-1">
                  <p className="text-sm font-medium">Aviso sonoro</p>
                  <p className="text-muted-foreground text-xs">
                    Um sinal curto quando a fase termina.
                  </p>
                </div>
                <Switch
                  aria-label="Aviso sonoro"
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
              </div>

              {showSettings ? (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["focusMin", "Foco (min)"],
                        ["shortBreakMin", "Pausa curta"],
                        ["longBreakMin", "Pausa longa"],
                        ["cyclesUntilLongBreak", "Ciclos p/ longa"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="grid gap-1.5">
                        <Label htmlFor={key} className="text-xs">
                          {label}
                        </Label>
                        <Input
                          id={key}
                          type="number"
                          min={1}
                          max={120}
                          value={pomodoro[key]}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n) && n > 0) {
                              setPomodoro({ [key]: n });
                            }
                          }}
                          disabled={isRunning || isPaused}
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <p className="text-muted-foreground text-xs">
                    Sessões de foco concluídas: {completedFocusSessions}
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
