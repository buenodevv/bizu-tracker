"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeEditalTopics } from "@/lib/ai/complete-edital";
import { sanitizeNewTopics } from "@/lib/ai/complete-schema";
import type {
  CompleteSubject,
  NewTopicSuggestion,
} from "@/lib/ai/complete-types";
import { describeAiError } from "@/lib/ai/describe-error";
import { getLlmProvider } from "@/lib/ai/extract-edital";
import { createClient } from "@/lib/supabase/server";
import type { Importance } from "@/types/database";

export type CompleteResult = {
  error?: string;
  notConfigured?: boolean;
  suggestions?: NewTopicSuggestion[];
};

export type ApplyCompleteResult = {
  error?: string;
  applied?: number;
};

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type NodeRow = {
  id: string;
  parent_id: string | null;
  name: string;
  importance: Importance;
  sort_order: number;
};

async function getOwnedEdital(editalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." as const };

  const { data: edital } = await supabase
    .from("editals")
    .select("id, study_area_id")
    .eq("id", editalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!edital) return { error: "Edital não encontrado." as const };

  return { supabase, user, edital };
}

async function loadNodes(
  supabase: ServerClient,
  editalId: string,
): Promise<NodeRow[]> {
  const { data } = await supabase
    .from("edital_subjects")
    .select("id, parent_id, name, importance, sort_order")
    .eq("edital_id", editalId)
    .order("sort_order");

  return (data ?? []) as NodeRow[];
}

/** Monta as disciplinas (raízes) com os nomes dos tópicos existentes. */
function buildSubjects(nodes: NodeRow[]): CompleteSubject[] {
  const childrenByParent = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node.parent_id) continue;
    const list = childrenByParent.get(node.parent_id) ?? [];
    list.push(node.name);
    childrenByParent.set(node.parent_id, list);
  }

  return nodes
    .filter((node) => node.parent_id === null)
    .map((node) => ({
      id: node.id,
      name: node.name,
      topicNames: childrenByParent.get(node.id) ?? [],
    }));
}

function revalidateTree() {
  revalidatePath("/edital");
  revalidatePath("/cycles");
}

/**
 * Pede à IA sugestões de tópicos ausentes. Nada é gravado — a UI revisa.
 */
export async function suggestMissingTopics(
  editalId: string,
): Promise<CompleteResult> {
  const ctx = await getOwnedEdital(editalId);
  if ("error" in ctx) return { error: ctx.error };

  const provider = getLlmProvider();
  if (!provider) {
    return {
      notConfigured: true,
      error:
        "A IA não está configurada. Adicione GEMINI_API_KEY no .env.local para usar o complemento automático.",
    };
  }

  const { data: quota, error: quotaError } = await ctx.supabase.rpc(
    "consume_ai_quota",
    { _kind: "complete" },
  );

  if (quotaError) {
    console.warn("consume_ai_quota falhou:", quotaError.message);
  } else if (!quota?.[0]?.allowed) {
    return {
      error:
        "Você atingiu o limite mensal de complementos por IA do plano gratuito.",
    };
  }

  const nodes = await loadNodes(ctx.supabase, editalId);
  const subjects = buildSubjects(nodes);

  if (subjects.length === 0) {
    return {
      error:
        "Adicione ao menos uma disciplina antes de pedir sugestões de tópicos.",
    };
  }

  const { data: area } = await ctx.supabase
    .from("study_areas")
    .select("exam_board")
    .eq("id", ctx.edital.study_area_id)
    .maybeSingle();

  try {
    const raw = await completeEditalTopics(
      provider,
      subjects,
      area?.exam_board ?? null,
    );
    return { suggestions: sanitizeNewTopics(raw, subjects) };
  } catch (err) {
    return { error: describeAiError(err, "Não foi possível completar:") };
  }
}

// ---------------------------------------------------------------------------
// Aplicação dos tópicos escolhidos
// ---------------------------------------------------------------------------

const selectionSchema = z.object({
  topics: z
    .array(
      z.object({
        subjectId: z.string(),
        name: z.string(),
      }),
    )
    .min(1)
    .max(30),
});

export type NewTopicSelection = z.infer<typeof selectionSchema>;

export async function applyNewTopics(
  editalId: string,
  selection: NewTopicSelection,
): Promise<ApplyCompleteResult> {
  const ctx = await getOwnedEdital(editalId);
  if ("error" in ctx) return { error: ctx.error };

  const parsed = selectionSchema.safeParse(selection);
  if (!parsed.success) return { error: "Seleção inválida." };

  const nodes = await loadNodes(ctx.supabase, editalId);
  const subjects = buildSubjects(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Revalida contra o estado atual do banco: a seleção veio do cliente.
  let validated;
  try {
    validated = sanitizeNewTopics(
      {
        topics: parsed.data.topics.map((topic) => ({
          subject_id: topic.subjectId,
          name: topic.name,
          reason: "",
        })),
      },
      subjects,
    );
  } catch {
    return { error: "Seleção inválida." };
  }

  if (validated.length === 0) {
    return { error: "Nenhum tópico novo para adicionar." };
  }

  const nextOrderByParent = new Map<string, number>();
  for (const node of nodes) {
    if (!node.parent_id) continue;
    const current = nextOrderByParent.get(node.parent_id) ?? 0;
    nextOrderByParent.set(node.parent_id, Math.max(current, node.sort_order + 1));
  }

  const rows = validated.map((suggestion) => {
    const subject = byId.get(suggestion.subjectId);
    const sortOrder = nextOrderByParent.get(suggestion.subjectId) ?? 0;
    nextOrderByParent.set(suggestion.subjectId, sortOrder + 1);

    return {
      edital_id: editalId,
      parent_id: suggestion.subjectId,
      name: suggestion.name,
      importance: subject?.importance ?? "CAI_MEDIO",
      sort_order: sortOrder,
    };
  });

  const { error } = await ctx.supabase.from("edital_subjects").insert(rows);

  if (error) return { error: "Não foi possível adicionar os tópicos." };

  revalidateTree();
  return { applied: rows.length };
}
