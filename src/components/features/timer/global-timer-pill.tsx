"use client";

import Link from "next/link";

import { Pause, Play, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTimerNow } from "@/components/features/timer/timer-provider";
import { formatClock } from "@/lib/format";
import { primeTimerAudio } from "@/lib/timer-audio";
import {
  getElapsedSeconds,
  getPhaseTotalSeconds,
  useTimerStore,
} from "@/store/timer-store";

/** Indicador compacto do cronômetro global, visível no header de todas as telas. */
export function GlobalTimerPill() {
  const status = useTimerStore((state) => state.status);
  const mode = useTimerStore((state) => state.mode);
  const subjectName = useTimerStore((state) => state.subjectName);
  const pause = useTimerStore((state) => state.pause);
  const resume = useTimerStore((state) => state.resume);
  const now = useTimerNow();

  if (status !== "running" && status !== "paused") return null;

  const state = useTimerStore.getState();
  const total = getPhaseTotalSeconds(state);
  const elapsed = getElapsedSeconds(state, now);
  const seconds =
    mode === "pomodoro" && total !== null
      ? Math.max(0, total - elapsed)
      : elapsed;
  const isPaused = status === "paused";

  return (
    <div className="animate-scale-in bg-card/90 motion-reduce:animate-none flex items-center gap-0.5 rounded-full border backdrop-blur">
      <Link
        href="/timer"
        aria-label={`Abrir cronômetro: ${formatClock(seconds)} ${
          isPaused ? "pausado" : "em andamento"
        }${subjectName ? `, ${subjectName}` : ""}`}
        className="focus-visible:ring-ring hover:bg-muted/60 flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 pl-2.5 transition-colors outline-none focus-visible:ring-2"
      >
        <Timer
          className={
            isPaused
              ? "text-muted-foreground size-3.5"
              : "text-primary size-3.5"
          }
        />
        <span className="text-sm font-medium tabular-nums">
          {formatClock(seconds)}
        </span>
        {subjectName ? (
          <span className="text-muted-foreground hidden max-w-40 truncate text-xs sm:inline">
            {subjectName}
          </span>
        ) : null}
      </Link>

      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        aria-label={isPaused ? "Retomar cronômetro" : "Pausar cronômetro"}
        onClick={() => {
          if (isPaused) {
            primeTimerAudio();
            resume();
          } else {
            pause();
          }
        }}
      >
        {isPaused ? (
          <Play className="size-3.5" />
        ) : (
          <Pause className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
