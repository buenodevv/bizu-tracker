"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ActionState =
  | { error?: string; success?: string }
  | undefined;

const sessionSchema = z.object({
  subject_name: z
    .string()
    .trim()
    .min(2, "Escolha ou digite a matéria estudada."),
  subject_id: z.string().uuid().nullable().optional(),
  study_area_id: z.string().uuid().nullable().optional(),
  topic_id: z.string().uuid().nullable().optional(),
  topic_name: z.string().trim().nullable().optional(),
  activity: z.enum(["THEORY", "QUESTIONS", "REVIEW", "SIMULATED"]),
  duration_sec: z.number().int().min(1, "Sessão muito curta."),
  started_at: z.string().optional(),
});

export async function saveStudySession(input: {
  subject_name: string;
  subject_id: string | null;
  study_area_id: string | null;
  topic_id?: string | null;
  topic_name?: string | null;
  activity: "THEORY" | "QUESTIONS" | "REVIEW" | "SIMULATED";
  duration_sec: number;
  started_at?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const startedAt = parsed.data.started_at ?? new Date().toISOString();
  const endedAt = new Date(
    new Date(startedAt).getTime() + parsed.data.duration_sec * 1000,
  ).toISOString();

  const { error } = await supabase.from("study_sessions").insert({
    user_id: user.id,
    study_area_id: parsed.data.study_area_id ?? null,
    subject_id: parsed.data.subject_id ?? null,
    subject_name: parsed.data.subject_name,
    topic_id: parsed.data.topic_id ?? null,
    topic_name: parsed.data.topic_name || null,
    activity: parsed.data.activity,
    started_at: startedAt,
    ended_at: endedAt,
    duration_sec: parsed.data.duration_sec,
  });

  if (error) {
    return { error: "Não foi possível salvar a sessão." };
  }

  // Avança o progresso do tópico com base no tempo estudado.
  // Best-effort: uma falha aqui não invalida a sessão já gravada.
  if (parsed.data.topic_id) {
    const { error: progressError } = await supabase.rpc(
      "sync_topic_progress",
      { _topic_id: parsed.data.topic_id },
    );
    if (progressError) {
      console.warn("sync_topic_progress falhou:", progressError.message);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/timer");
  revalidatePath("/analytics");
  revalidatePath("/edital");
  return { success: true };
}

export async function deleteStudySession(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("study_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível excluir a sessão." };

  revalidatePath("/dashboard");
  revalidatePath("/timer");
  revalidatePath("/analytics");
  return { success: "Sessão excluída." };
}
