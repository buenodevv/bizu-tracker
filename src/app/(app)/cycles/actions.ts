"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActivityType } from "@/types/database";

export type CycleActionState =
  | { error?: string; success?: string; cycleId?: string }
  | undefined;

const blockSchema = z.object({
  subject_id: z.string().uuid().nullable().optional(),
  subject_name: z.string().trim().min(1, "Informe a matéria do bloco."),
  activity: z
    .enum(["THEORY", "QUESTIONS", "REVIEW", "SIMULATED"])
    .default("THEORY"),
  minutes: z.number().int().min(5, "Mínimo de 5 minutos por bloco.").max(600),
  day_of_cycle: z.number().int().min(0).max(6),
  sort_order: z.number().int().min(0).default(0),
});

const cycleSchema = z.object({
  study_area_id: z.string().uuid("Selecione uma área de estudo."),
  name: z.string().trim().min(2, "Dê um nome ao ciclo."),
  description: z.string().trim().optional(),
  period_days: z.number().int().min(1).max(7).default(7),
  blocks: z.array(blockSchema).min(1, "Adicione ao menos um bloco."),
});

export type CycleBlockInput = z.input<typeof blockSchema>;
export type CycleInput = z.input<typeof cycleSchema>;

function revalidateCycleViews() {
  revalidatePath("/cycles");
  revalidatePath("/dashboard");
}

export async function createCycle(
  input: CycleInput,
): Promise<{ error?: string; success?: boolean; cycleId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const parsed = cycleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: cycle, error } = await supabase
    .from("cycles")
    .insert({
      study_area_id: parsed.data.study_area_id,
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      period_days: parsed.data.period_days,
    })
    .select("id")
    .single();

  if (error || !cycle) {
    return { error: "Não foi possível criar o ciclo." };
  }

  const { error: blocksError } = await supabase.from("cycle_blocks").insert(
    parsed.data.blocks.map((b, i) => ({
      cycle_id: cycle.id,
      subject_id: b.subject_id ?? null,
      subject_name: b.subject_name,
      activity: b.activity as ActivityType,
      minutes: b.minutes,
      day_of_cycle: b.day_of_cycle,
      sort_order: b.sort_order ?? i,
    })),
  );

  if (blocksError) {
    // Rollback simples: remove o ciclo criado sem blocos.
    await supabase.from("cycles").delete().eq("id", cycle.id);
    return { error: "Não foi possível salvar os blocos do ciclo." };
  }

  revalidateCycleViews();
  return { success: true, cycleId: cycle.id };
}

export async function deleteCycle(id: string): Promise<CycleActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("cycles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível excluir o ciclo." };

  revalidateCycleViews();
  return { success: "Ciclo excluído." };
}

/**
 * Copia um ciclo público (ou de outra pessoa via link) para a conta atual.
 */
export async function duplicateCycle(
  sourceCycleId: string,
): Promise<{ error?: string; success?: boolean; cycleId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  // O RLS permite ler ciclos públicos.
  const { data: source } = await supabase
    .from("cycles")
    .select("id, name, description, period_days, study_area_id, is_public")
    .eq("id", sourceCycleId)
    .maybeSingle();

  if (!source) return { error: "Ciclo não encontrado ou não é público." };

  // Descobre a área de estudo do usuário para vincular a cópia.
  let targetAreaId: string | null = null;

  const { data: ownAreas } = await supabase
    .from("study_areas")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  targetAreaId = ownAreas?.[0]?.id ?? null;

  // Se o dono copiou o próprio ciclo, usa a mesma área.
  if (!targetAreaId) {
    const { data: sourceArea } = await supabase
      .from("study_areas")
      .select("id")
      .eq("id", source.study_area_id)
      .maybeSingle();
    targetAreaId = sourceArea?.id ?? null;
  }

  if (!targetAreaId) {
    return {
      error:
        "Crie uma área de estudo antes de copiar um ciclo para a sua conta.",
    };
  }

  const { data: blocks } = await supabase
    .from("cycle_blocks")
    .select("subject_id, subject_name, activity, minutes, day_of_cycle, sort_order")
    .eq("cycle_id", source.id);

  const { data: created, error } = await supabase
    .from("cycles")
    .insert({
      study_area_id: targetAreaId,
      user_id: user.id,
      name: `${source.name} (cópia)`,
      description: source.description,
      period_days: source.period_days,
      source_cycle_id: source.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "Não foi possível copiar o ciclo." };
  }

  if (blocks && blocks.length > 0) {
    await supabase.from("cycle_blocks").insert(
      blocks.map((b) => ({
        cycle_id: created.id,
        // Não referencia o subject_id de outro edital para evitar vínculo inválido.
        subject_id: null,
        subject_name: b.subject_name,
        activity: b.activity as ActivityType,
        minutes: b.minutes,
        day_of_cycle: b.day_of_cycle,
        sort_order: b.sort_order,
      })),
    );
  }

  revalidateCycleViews();
  return { success: true, cycleId: created.id };
}

/** Liga/desliga a visibilidade pública do ciclo. */
export async function setCycleVisibility(
  id: string,
  isPublic: boolean,
): Promise<CycleActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("cycles")
    .update({ is_public: isPublic })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível atualizar a visibilidade." };

  revalidateCycleViews();
  return { success: isPublic ? "Ciclo agora é público." : "Ciclo tornado privado." };
}

/**
 * Atualiza um ciclo existente: nome, descrição, período e blocos.
 * Os blocos são substituídos integralmente (mais simples e previsível).
 */
export async function updateCycle(
  id: string,
  input: {
    name: string;
    description?: string | null;
    period_days: number;
    blocks: CycleBlockInput[];
  },
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const parsed = cycleSchema
    .omit({ study_area_id: true })
    .safeParse({
      name: input.name,
      description: input.description ?? undefined,
      period_days: input.period_days,
      blocks: input.blocks,
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Confirma a posse antes de alterar.
  const { data: existing } = await supabase
    .from("cycles")
    .select("id, study_area_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return { error: "Ciclo não encontrado." };

  const { error } = await supabase
    .from("cycles")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      period_days: parsed.data.period_days,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível atualizar o ciclo." };

  // Substitui os blocos.
  const { error: delError } = await supabase
    .from("cycle_blocks")
    .delete()
    .eq("cycle_id", id);

  if (delError) return { error: "Não foi possível atualizar os blocos." };

  const { error: insError } = await supabase.from("cycle_blocks").insert(
    parsed.data.blocks.map((b, i) => ({
      cycle_id: id,
      subject_id: b.subject_id ?? null,
      subject_name: b.subject_name,
      activity: b.activity as ActivityType,
      minutes: b.minutes,
      day_of_cycle: b.day_of_cycle,
      sort_order: b.sort_order ?? i,
    })),
  );

  if (insError) return { error: "Não foi possível salvar os blocos." };

  revalidateCycleViews();
  return { success: true };
}
