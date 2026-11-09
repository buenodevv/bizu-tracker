"use client";

import { useEffect, useRef } from "react";

import { toast } from "sonner";
import { create } from "zustand";

import { playTimerChime, primeTimerAudio } from "@/lib/timer-audio";
import { PHASE_LABELS, useTimerStore } from "@/store/timer-store";

type TimerClock = {
  now: number;
  setNow: (now: number) => void;
};

/**
 * Relógio compartilhado, separado do store principal para não ser persistido
 * nem disparar escrita no localStorage a cada tick.
 */
const useTimerClock = create<TimerClock>((set) => ({
  now: 0,
  setNow: (now) => set({ now }),
}));

/** Valor de `now` que re-renderiza a cada tick (250 ms enquanto roda). */
export function useTimerNow(): number {
  return useTimerClock((state) => state.now);
}

/**
 * Motor único do cronômetro, montado no layout do app.
 *
 * - Mantém o relógio rodando entre páginas.
 * - Dispara o aviso sonoro/toast quando a fase do pomodoro termina.
 * - Não persiste o relógio em andamento (evita tempos "fantasma" no reload).
 */
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const status = useTimerStore((state) => state.status);
  const mode = useTimerStore((state) => state.mode);
  const phase = useTimerStore((state) => state.phase);
  const soundEnabled = useTimerStore((state) => state.soundEnabled);

  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      useTimerStore.getState().tick();
      useTimerClock.getState().setNow(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, [status]);

  // Atualiza o relógio imediatamente em play/pause/resume, antes do 1º tick.
  useEffect(() => {
    const unsubscribe = useTimerStore.subscribe((state, previous) => {
      if (state.status !== previous.status) {
        useTimerClock.getState().setNow(Date.now());
      }
    });

    return unsubscribe;
  }, []);

  const previousPhase = useRef(phase);
  const previousStatus = useRef(status);

  useEffect(() => {
    const phaseChanged = previousPhase.current !== phase;
    const wasRunning = previousStatus.current === "running";

    if (mode === "pomodoro" && phaseChanged && wasRunning) {
      if (soundEnabled) void playTimerChime();

      toast.info(`Pomodoro: hora de ${PHASE_LABELS[phase].toLowerCase()}!`, {
        duration: 8000,
        action: {
          label: "Iniciar",
          onClick: () => {
            primeTimerAudio();
            useTimerStore.getState().start();
          },
        },
      });
    }

    previousPhase.current = phase;
    previousStatus.current = status;
  }, [phase, status, mode, soundEnabled]);

  return children;
}
