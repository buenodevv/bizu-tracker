"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ActivityType } from "@/types/database";

export type TimerMode = "stopwatch" | "pomodoro";

/** idle → running ⇄ paused → finished (voltando a idle) */
export type TimerStatus = "idle" | "running" | "paused" | "finished";

export type Phase = "focus" | "shortBreak" | "longBreak";

export const PHASE_LABELS: Record<Phase, string> = {
  focus: "Foco",
  shortBreak: "Pausa curta",
  longBreak: "Pausa longa",
};

export type PomodoroSettings = {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesUntilLongBreak: number;
};

type TimerState = {
  // Configuração da sessão em andamento
  mode: TimerMode;
  subjectName: string;
  subjectId: string | null;
  topicName: string;
  topicId: string | null;
  studyAreaId: string | null;
  activity: ActivityType;

  // Relógio
  status: TimerStatus;
  /** Timestamp (ms) do início/retomada do trecho atual. */
  segmentStartedAt: number | null;
  /** Segundos acumulados antes do trecho atual. */
  accumulatedSec: number;
  /** Timestamp (ms) em que a fase do pomodoro termina. */
  phaseEndAt: number | null;

  // Pomodoro
  pomodoro: PomodoroSettings;
  phase: Phase;
  completedFocusSessions: number;
  soundEnabled: boolean;

  // Ações
  setSessionConfig: (config: {
    subjectName?: string;
    subjectId?: string | null;
    topicName?: string;
    topicId?: string | null;
    studyAreaId?: string | null;
    activity?: ActivityType;
  }) => void;
  setMode: (mode: TimerMode) => void;
  setPomodoro: (settings: Partial<PomodoroSettings>) => void;
  setSoundEnabled: (enabled: boolean) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** Encerra a sessão. Retorna a duração efetiva (s) ou null se < 1s. */
  finish: () => { durationSec: number } | null;
  /** Chamado pelo intervalo; avança de fase no pomodoro. */
  tick: () => void;
};

export function phaseDurationSec(
  phase: Phase,
  settings: PomodoroSettings,
): number {
  switch (phase) {
    case "focus":
      return settings.focusMin * 60;
    case "shortBreak":
      return settings.shortBreakMin * 60;
    case "longBreak":
      return settings.longBreakMin * 60;
  }
}

const initialClock = {
  status: "idle" as TimerStatus,
  segmentStartedAt: null,
  accumulatedSec: 0,
  phaseEndAt: null,
};

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      mode: "stopwatch",
      subjectName: "",
      subjectId: null,
      topicName: "",
      topicId: null,
      studyAreaId: null,
      activity: "THEORY",

      ...initialClock,

      pomodoro: {
        focusMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
        cyclesUntilLongBreak: 4,
      },
      phase: "focus",
      completedFocusSessions: 0,
      soundEnabled: true,

      setSessionConfig: (config) =>
        set((state) => ({
          subjectName: config.subjectName ?? state.subjectName,
          subjectId:
            config.subjectId !== undefined ? config.subjectId : state.subjectId,
          topicName: config.topicName ?? state.topicName,
          topicId:
            config.topicId !== undefined ? config.topicId : state.topicId,
          studyAreaId:
            config.studyAreaId !== undefined
              ? config.studyAreaId
              : state.studyAreaId,
          activity: config.activity ?? state.activity,
        })),

      setMode: (mode) =>
        set({ mode, phase: "focus", ...initialClock }),

      setPomodoro: (settings) =>
        set((state) => ({ pomodoro: { ...state.pomodoro, ...settings } })),

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

      start: () => {
        const state = get();
        const now = Date.now();
        const isPomodoro = state.mode === "pomodoro";
        const duration = isPomodoro
          ? phaseDurationSec(state.phase, state.pomodoro)
          : null;

        set({
          status: "running",
          segmentStartedAt: now,
          accumulatedSec: 0,
          phaseEndAt: duration !== null ? now + duration * 1000 : null,
        });
      },

      pause: () => {
        const state = get();
        if (state.status !== "running" || state.segmentStartedAt === null) return;

        const now = Date.now();
        set({
          status: "paused",
          accumulatedSec:
            state.accumulatedSec +
            Math.floor((now - state.segmentStartedAt) / 1000),
          segmentStartedAt: null,
        });
      },

      resume: () => {
        const state = get();
        if (state.status !== "paused") return;

        const now = Date.now();
        const remainingSec =
          state.mode === "pomodoro" && state.phaseEndAt !== null
            ? Math.max(0, Math.floor((state.phaseEndAt - now) / 1000))
            : null;

        set({
          status: "running",
          segmentStartedAt: now,
          phaseEndAt:
            remainingSec !== null ? now + remainingSec * 1000 : state.phaseEndAt,
        });
      },

      reset: () => set({ phase: "focus", ...initialClock }),

      finish: () => {
        const state = get();
        const live =
          state.status === "running" && state.segmentStartedAt !== null
            ? state.accumulatedSec +
              Math.floor((Date.now() - state.segmentStartedAt) / 1000)
            : state.accumulatedSec;

        if (live < 1) {
          set({ ...initialClock });
          return null;
        }

        const wasFocus = state.mode === "pomodoro" && state.phase === "focus";

        set({
          status: "finished",
          segmentStartedAt: null,
          accumulatedSec: live,
          phaseEndAt: null,
          completedFocusSessions: wasFocus
            ? state.completedFocusSessions + 1
            : state.completedFocusSessions,
        });

        return { durationSec: live };
      },

      tick: () => {
        const state = get();
        if (state.status !== "running") return;
        if (state.mode !== "pomodoro" || state.phaseEndAt === null) return;
        if (Date.now() < state.phaseEndAt) return;

        // Fase concluída: agendar automaticamente a próxima.
        const wasFocus = state.phase === "focus";
        const focusCount = wasFocus
          ? state.completedFocusSessions + 1
          : state.completedFocusSessions;

        const nextPhase: Phase = !wasFocus
          ? "focus"
          : focusCount % state.pomodoro.cyclesUntilLongBreak === 0
            ? "longBreak"
            : "shortBreak";

        set({
          status: "idle",
          segmentStartedAt: null,
          accumulatedSec: 0,
          phaseEndAt: null,
          completedFocusSessions: focusCount,
          phase: nextPhase,
        });
      },
    }),
    {
      name: "bizu-timer",
      // Só persiste configuração — nunca o relógio em andamento, para evitar
      // tempos "fantasma" ao recarregar a página.
      partialize: (state) => ({
        mode: state.mode,
        subjectName: state.subjectName,
        subjectId: state.subjectId,
        topicName: state.topicName,
        topicId: state.topicId,
        studyAreaId: state.studyAreaId,
        activity: state.activity,
        pomodoro: state.pomodoro,
        completedFocusSessions: state.completedFocusSessions,
        soundEnabled: state.soundEnabled,
      }),
    },
  ),
);

/** Segundos decorridos, considerando pausas. */
export function getElapsedSeconds(state: TimerState, now = Date.now()): number {
  if (state.status === "running" && state.segmentStartedAt !== null) {
    return (
      state.accumulatedSec +
      Math.floor((now - state.segmentStartedAt) / 1000)
    );
  }
  return state.accumulatedSec;
}

/** Total da fase (pomodoro) ou null (cronômetro livre). */
export function getPhaseTotalSeconds(state: TimerState): number | null {
  if (state.mode !== "pomodoro") return null;
  return phaseDurationSec(state.phase, state.pomodoro);
}
