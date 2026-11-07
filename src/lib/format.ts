import type {
  ActivityType,
  AreaType,
  Importance,
  ProgressStatus,
  QuestionLevel,
  QuestionResult,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Rótulos em português para enums do banco.
// ---------------------------------------------------------------------------

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  THEORY: "Teoria",
  QUESTIONS: "Questões",
  REVIEW: "Revisão",
  SIMULATED: "Simulado",
};

export const AREA_TYPE_LABELS: Record<AreaType, string> = {
  CONCURSO: "Concurso",
  VESTIBULAR: "Vestibular",
};

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  CAI_POUCO: "Cai pouco",
  CAI_MEDIO: "Cai médio",
  CAI_MUITO: "Cai muito",
};

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  REVISED: "Revisado",
  DONE: "Concluído",
};

export const LEVEL_LABELS: Record<QuestionLevel, string> = {
  EASY: "Fácil",
  MEDIUM: "Média",
  HARD: "Difícil",
};

export const RESULT_LABELS: Record<QuestionResult, string> = {
  CORRECT: "Acertou",
  WRONG: "Errou",
  SKIPPED: "Pulou",
};

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

/** 3661 → "1h 01min" | 3599 → "59min 59s" | 45 → "45s" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  }
  if (m > 0) {
    return `${m}min ${sec.toString().padStart(2, "0")}s`;
  }
  return `${sec}s`;
}

/** 3661 → "01:01:01" (para o relógio do cronômetro) */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const mm = m.toString().padStart(2, "0");
  const ss = sec.toString().padStart(2, "0");

  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Minutos → "1h 30min" (agregados de gráficos) */
export function formatMinutes(totalMinutes: number): string {
  const total = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(total / 60);
  const m = total % 60;

  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

/** ISO date → "05/11" */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** ISO date → "05/11/2025 19:42" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Data local (YYYY-MM-DD) de um Date, sem deslocamento de fuso. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
