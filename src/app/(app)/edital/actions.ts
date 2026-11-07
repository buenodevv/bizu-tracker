"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Importance, ProgressStatus } from "@/types/database";

export type EditalActionState =
  | { error?: string; success?: string; id?: string }
  | undefined;

// ---------------------------------------------------------------------------
// Área de estudo
// ---------------------------------------------------------------------------

const areaSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com ao menos 2 caracteres."),
  target_type: z.enum(["CONCURSO", "VESTIBULAR"]),
  exam_board: z.string().trim().optional(),
  exam_date: z.string().trim().optional(),
});

export async function createStudyArea(
  _prevState: EditalActionState,
  formData: FormData,
): Promise<EditalActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const parsed = areaSchema.safeParse({
    name: formData.get("name"),
    target_type: formData.get("target_type") ?? "CONCURSO",
    exam_board: formData.get("exam_board") || undefined,
    exam_date: formData.get("exam_date") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data, error } = await supabase
    .from("study_areas")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      target_type: parsed.data.target_type,
      exam_board: parsed.data.exam_board ?? null,
      exam_date: parsed.data.exam_date ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Não foi possível criar a área de estudo." };
  }

  revalidatePath("/edital");
  revalidatePath("/dashboard");
  revalidatePath("/cycles");
  return { success: "Área de estudo criada!", id: data.id };
}

export async function deleteStudyArea(id: string): Promise<EditalActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("study_areas")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível excluir a área." };

  revalidatePath("/edital");
  revalidatePath("/dashboard");
  revalidatePath("/cycles");
  return { success: "Área excluída." };
}

// ---------------------------------------------------------------------------
// Edital
// ---------------------------------------------------------------------------

const subjectSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  parent_id: z.string().uuid().nullable().optional(),
  weight: z.number().min(0).max(1).nullable().optional(),
  importance: z
    .enum(["CAI_POUCO", "CAI_MEDIO", "CAI_MUITO"])
    .default("CAI_MEDIO"),
});

export async function createEdital(input: {
  study_area_id: string;
  title: string;
}): Promise<EditalActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const title = input.title?.trim();
  if (!title || title.length < 2) {
    return { error: "Informe um título para o edital." };
  }

  const { data, error } = await supabase
    .from("editals")
    .insert({
      study_area_id: input.study_area_id,
      user_id: user.id,
      title,
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Não foi possível criar o edital." };
  }

  revalidatePath("/edital");
  return { success: "Edital criado!", id: data.id };
}

export async function deleteEdital(id: string): Promise<EditalActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("editals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível excluir o edital." };

  revalidatePath("/edital");
  revalidatePath("/cycles");
  return { success: "Edital excluído." };
}

/** Cria um tópico/disciplina na árvore do edital. */
export async function createSubject(input: {
  edital_id: string;
  name: string;
  parent_id?: string | null;
  importance?: Importance;
  weight?: number | null;
}): Promise<EditalActionState & { success?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const parsed = subjectSchema.safeParse({
    name: input.name,
    parent_id: input.parent_id ?? null,
    importance: input.importance ?? "CAI_MEDIO",
    weight: input.weight ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Confirma que o edital pertence ao usuário (defesa em profundidade).
  const { data: edital } = await supabase
    .from("editals")
    .select("id")
    .eq("id", input.edital_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!edital) return { error: "Edital não encontrado." };

  // sort_order = último daquele nível
  const { count } = await supabase
    .from("edital_subjects")
    .select("id", { count: "exact", head: true })
    .eq("edital_id", input.edital_id);

  const { error } = await supabase.from("edital_subjects").insert({
    edital_id: input.edital_id,
    parent_id: parsed.data.parent_id ?? null,
    name: parsed.data.name,
    importance: parsed.data.importance,
    weight: parsed.data.weight ?? null,
    sort_order: count ?? 0,
  });

  if (error) return { error: "Não foi possível criar o tópico." };

  revalidatePath("/edital");
  revalidatePath("/cycles");
  return { success: "Tópico adicionado." };
}

/** Atualiza nome, importância, peso ou progresso de um tópico. */
export async function updateSubject(input: {
  id: string;
  name?: string;
  importance?: Importance;
  weight?: number | null;
  progress_studied?: number;
  status?: ProgressStatus;
}): Promise<EditalActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  type SubjectPatch = {
    name?: string;
    importance?: Importance;
    weight?: number | null;
    progress_studied?: number;
    status?: ProgressStatus;
  };

  const patch: SubjectPatch = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "O nome não pode ficar vazio." };
    patch.name = name;
  }
  if (input.importance !== undefined) patch.importance = input.importance;
  if (input.weight !== undefined) patch.weight = input.weight;
  if (input.progress_studied !== undefined) {
    patch.progress_studied = Math.min(100, Math.max(0, input.progress_studied));
  }
  if (input.status !== undefined) patch.status = input.status;

  if (Object.keys(patch).length === 0) return { success: "Nada a atualizar." };

  // O RLS garante o dono via edital; o filtro abaixo é defesa extra.
  const { error } = await supabase
    .from("edital_subjects")
    .update(patch)
    .eq("id", input.id);

  if (error) return { error: "Não foi possível atualizar o tópico." };

  revalidatePath("/edital");
  revalidatePath("/cycles");
  return { success: "Tópico atualizado." };
}

/** Remove um tópico (e seus filhos, via ON DELETE CASCADE). */
export async function deleteSubject(id: string): Promise<EditalActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("edital_subjects")
    .delete()
    .eq("id", id);

  if (error) return { error: "Não foi possível excluir o tópico." };

  revalidatePath("/edital");
  revalidatePath("/cycles");
  return { success: "Tópico excluído." };
}

/** Aprova o edital (DRAFT → ACTIVE). */
export async function approveEdital(id: string): Promise<EditalActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { count } = await supabase
    .from("edital_subjects")
    .select("id", { count: "exact", head: true })
    .eq("edital_id", id)
    .is("parent_id", null);

  if (!count) {
    return {
      error: "Adicione ao menos uma disciplina antes de ativar o edital.",
    };
  }

  const { error } = await supabase
    .from("editals")
    .update({ status: "ACTIVE" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível ativar o edital." };

  revalidatePath("/edital");
  revalidatePath("/cycles");
  return { success: "Edital ativado!" };
}
