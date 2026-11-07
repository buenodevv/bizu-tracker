"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { QuestionLevel, QuestionResult } from "@/types/database";

export type QuestionActionState =
  | { error?: string; success?: string }
  | undefined;

const levelEnum = z.enum(["EASY", "MEDIUM", "HARD"]);
const resultEnum = z.enum(["CORRECT", "WRONG", "SKIPPED"]);

const questionSchema = z.object({
  subject_name: z.string().trim().min(2, "Informe a matéria."),
  subject_id: z.string().uuid().nullable().optional(),
  study_area_id: z.string().uuid().nullable().optional(),
  exam_board: z.string().trim().nullable().optional(),
  level: levelEnum.default("MEDIUM"),
  result: resultEnum,
  took_sec: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type QuestionInput = z.input<typeof questionSchema>;

function revalidateQuestionViews() {
  revalidatePath("/dashboard");
  revalidatePath("/questions");
  revalidatePath("/analytics");
}

/** Registra uma única questão. */
export async function createQuestion(
  input: QuestionInput,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase.from("questions").insert({
    user_id: user.id,
    study_area_id: parsed.data.study_area_id ?? null,
    subject_id: parsed.data.subject_id ?? null,
    subject_name: parsed.data.subject_name,
    exam_board: parsed.data.exam_board || null,
    level: parsed.data.level as QuestionLevel,
    result: parsed.data.result as QuestionResult,
    took_sec: parsed.data.took_sec ?? null,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: "Não foi possível salvar a questão." };

  revalidateQuestionViews();
  return { success: true };
}

/**
 * Registra um lote de questões (ex.: 20 questões, 15 acertos, 5 erros).
 * Insere uma linha por questão para manter a acurácia por matéria precisa.
 */
export async function createQuestionBatch(input: {
  subject_name: string;
  subject_id?: string | null;
  study_area_id?: string | null;
  exam_board?: string | null;
  level?: QuestionLevel;
  correct: number;
  wrong: number;
  skipped: number;
  avg_took_sec?: number | null;
}): Promise<{ error?: string; success?: boolean; count?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const subjectName = input.subject_name?.trim();
  if (!subjectName || subjectName.length < 2) {
    return { error: "Informe a matéria." };
  }

  const correct = Math.max(0, Math.floor(input.correct || 0));
  const wrong = Math.max(0, Math.floor(input.wrong || 0));
  const skipped = Math.max(0, Math.floor(input.skipped || 0));
  const total = correct + wrong + skipped;

  if (total < 1) {
    return { error: "Informe ao menos uma questão." };
  }
  if (total > 500) {
    return { error: "Lote muito grande (máx. 500 por vez)." };
  }

  const base = {
    user_id: user.id,
    study_area_id: input.study_area_id ?? null,
    subject_id: input.subject_id ?? null,
    subject_name: subjectName,
    exam_board: input.exam_board || null,
    level: (input.level ?? "MEDIUM") as QuestionLevel,
    took_sec: input.avg_took_sec ?? null,
  };

  const rows = [
    ...Array.from({ length: correct }, () => ({
      ...base,
      result: "CORRECT" as QuestionResult,
    })),
    ...Array.from({ length: wrong }, () => ({
      ...base,
      result: "WRONG" as QuestionResult,
    })),
    ...Array.from({ length: skipped }, () => ({
      ...base,
      result: "SKIPPED" as QuestionResult,
    })),
  ];

  const { error } = await supabase.from("questions").insert(rows);

  if (error) return { error: "Não foi possível salvar o lote." };

  revalidateQuestionViews();
  return { success: true, count: total };
}

export async function deleteQuestion(id: string): Promise<QuestionActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível excluir a questão." };

  revalidateQuestionViews();
  return { success: "Questão excluída." };
}

/** Exclui todas as questões de um mesmo registro em lote. */
export async function deleteQuestionBatch(ids: string[]): Promise<QuestionActionState> {
  if (ids.length === 0) return { error: "Nada para excluir." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("questions")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível excluir o lote." };

  revalidateQuestionViews();
  return { success: "Lote excluído." };
}
