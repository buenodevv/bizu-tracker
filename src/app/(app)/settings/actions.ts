"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type SettingsState =
  | { error?: string; success?: string }
  | undefined;

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com ao menos 2 caracteres.")
    .max(80, "Nome muito longo."),
  weekly_goal_min: z
    .number()
    .int()
    .min(30, "A meta mínima é 30 minutos.")
    .max(6000, "A meta máxima é 100 horas."),
  timezone: z.string().trim().min(1).max(60),
});

export async function updateProfile(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  // Aceita "MMSS" ou número de minutos vindos do formulário.
  const rawGoal = String(formData.get("weekly_goal_min") ?? "").trim();
  const minutes = parseGoalMinutes(rawGoal);

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    weekly_goal_min: minutes,
    timezone: String(formData.get("timezone") ?? "America/Sao_Paulo"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name: parsed.data.name,
      weekly_goal_min: parsed.data.weekly_goal_min,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id);

  if (error) return { error: "Não foi possível salvar as alterações." };

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { success: "Preferências salvas!" };
}

/**
 * Converte a meta semanal em minutos.
 * Aceita horas decimais ("20" = 20 horas) ou minutos explícitos ("1200min").
 */
function parseGoalMinutes(input: string): number {
  if (!input) return Number.NaN;

  const lower = input.toLowerCase().replace(",", ".");

  // "1200min" ou "1200 min" -> minutos
  const minMatch = lower.match(/^([\d.]+)\s*min$/);
  if (minMatch) return Math.round(Number(minMatch[1]));

  // "20h" ou "20 h" -> horas
  const hourMatch = lower.match(/^([\d.]+)\s*h$/);
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60);

  // Número puro: interpretado como HORAS (padrão da UI)
  const num = Number(lower);
  if (!Number.isFinite(num)) return Number.NaN;
  return Math.round(num * 60);
}

/** Atualiza a área de estudo (nome, banca, data da prova). */
export async function updateStudyArea(input: {
  id: string;
  name: string;
  exam_board?: string | null;
  exam_date?: string | null;
}): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const name = input.name?.trim();
  if (!name || name.length < 2) {
    return { error: "Informe um nome com ao menos 2 caracteres." };
  }

  const { error } = await supabase
    .from("study_areas")
    .update({
      name,
      exam_board: input.exam_board || null,
      exam_date: input.exam_date || null,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível salvar a área." };

  revalidatePath("/settings");
  revalidatePath("/edital");
  revalidatePath("/cycles");
  return { success: "Área atualizada!" };
}
