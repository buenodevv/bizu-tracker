"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { describeAiError } from "@/lib/ai/describe-error";
import { getLlmProvider } from "@/lib/ai/extract-edital";
import { refineEditalTree } from "@/lib/ai/refine-edital";
import { sanitizeRefinements } from "@/lib/ai/refine-schema";
import type { RefineNode, RefineSuggestions } from "@/lib/ai/refine-types";
import { createClient } from "@/lib/supabase/server";
import type { Importance } from "@/types/database";

export type RefineResult = {
  error?: string;
  notConfigured?: boolean;
  suggestions?: RefineSuggestions;
};

export type ApplyRefineResult = {
  error?: string;
  applied?: number;
};

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function getOwnedEdital(editalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." as const };

  const { data: edital } = await supabase
    .from("editals")
    .select("id")
    .eq("id", editalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!edital) return { error: "Edital não encontrado." as const };

  return { supabase, user };
}

async function loadNodes(
  supabase: ServerClient,
  editalId: string,
): Promise<RefineNode[]> {
  const { data } = await supabase
    .from("edital_subjects")
    .select("id, parent_id, name, importance")
    .eq("edital_id", editalId)
    .order("sort_order");

  return (data ?? []).map((row) => ({
    id: row.id,
    parent_id: row.parent_id,
    name: row.name,
    importance: row.importance as Importance,
  }));
}

function revalidateTree() {
  revalidatePath("/edital");
  revalidatePath("/cycles");
}

/**
 * Pede sugestões de organização à IA. Nada é gravado aqui — a resposta é
 * validada contra a árvore atual e devolvida para revisão na UI.
 */
export async function suggestRefinements(
  editalId: string,
): Promise<RefineResult> {
  const ctx = await getOwnedEdital(editalId);
  if ("error" in ctx) return { error: ctx.error };

  const provider = getLlmProvider();
  if (!provider) {
    return {
      notConfigured: true,
      error:
        "A IA não está configurada. Adicione GEMINI_API_KEY no .env.local para usar o refinamento automático.",
    };
  }

  // Cota antes da chamada — controla custo mesmo se o modelo falhar.
  const { data: quota, error: quotaError } = await ctx.supabase.rpc(
    "consume_ai_quota",
    { _kind: "refine" },
  );

  if (quotaError) {
    console.warn("consume_ai_quota falhou:", quotaError.message);
  } else if (!quota?.[0]?.allowed) {
    return {
      error:
        "Você atingiu o limite mensal de refinamentos por IA do plano gratuito.",
    };
  }

  const nodes = await loadNodes(ctx.supabase, editalId);
  if (nodes.length < 2) {
    return {
      error:
        "O edital precisa de ao menos duas disciplinas ou tópicos para ser refinado.",
    };
  }

  try {
    const raw = await refineEditalTree(provider, nodes);
    return { suggestions: sanitizeRefinements(raw, nodes) };
  } catch (err) {
    return { error: describeAiError(err, "Não foi possível refinar:") };
  }
}

// ---------------------------------------------------------------------------
// Aplicação das sugestões escolhidas
// ---------------------------------------------------------------------------

const selectionSchema = z.object({
  merges: z
    .array(
      z.object({
        keepId: z.string(),
        mergeIds: z.array(z.string()).min(1),
      }),
    )
    .default([]),
  renames: z
    .array(z.object({ id: z.string(), newName: z.string() }))
    .default([]),
  moves: z
    .array(z.object({ id: z.string(), parentId: z.string() }))
    .default([]),
});

export type RefineSelection = z.infer<typeof selectionSchema>;

export async function applyRefinements(
  editalId: string,
  selection: RefineSelection,
): Promise<ApplyRefineResult> {
  const ctx = await getOwnedEdital(editalId);
  if ("error" in ctx) return { error: ctx.error };

  const parsed = selectionSchema.safeParse(selection);
  if (!parsed.success) return { error: "Seleção inválida." };

  const nodes = await loadNodes(ctx.supabase, editalId);

  // Revalida contra o estado atual do banco: a seleção veio do cliente.
  let validated: RefineSuggestions;
  try {
    validated = sanitizeRefinements(
      {
        merges: parsed.data.merges.map((m) => ({
          keep_id: m.keepId,
          merge_ids: m.mergeIds,
          reason: "",
        })),
        renames: parsed.data.renames.map((r) => ({
          id: r.id,
          name: r.newName,
          reason: "",
        })),
        moves: parsed.data.moves.map((m) => ({
          id: m.id,
          parent_id: m.parentId,
          reason: "",
        })),
      },
      nodes,
    );
  } catch {
    return { error: "Seleção inválida." };
  }

  let applied = 0;
  let firstError: string | undefined;

  // 1. Mesclagens primeiro — as demais sugestões ignoram nós mesclados.
  for (const merge of validated.merges) {
    for (const sourceId of merge.mergeIds) {
      const { error } = await ctx.supabase.rpc("merge_edital_subject", {
        _keep: merge.keepId,
        _merge: sourceId,
      });
      if (error) {
        firstError ??= error.message;
        continue;
      }
      applied += 1;
    }
  }

  // 2. Movimentos (mesmo nível, validado pelo RPC).
  for (const move of validated.moves) {
    const { error } = await ctx.supabase.rpc("move_edital_subject", {
      _id: move.id,
      _parent: move.parentId,
    });
    if (error) {
      firstError ??= error.message;
      continue;
    }
    applied += 1;
  }

  // 3. Renomeações.
  for (const rename of validated.renames) {
    const { error } = await ctx.supabase
      .from("edital_subjects")
      .update({ name: rename.newName })
      .eq("id", rename.id);

    if (error) {
      firstError ??= error.message;
      continue;
    }
    applied += 1;
  }

  revalidateTree();

  if (applied === 0 && firstError) {
    return { error: "Não foi possível aplicar as sugestões." };
  }

  return {
    applied,
    error: firstError
      ? "Algumas sugestões não puderam ser aplicadas e foram ignoradas."
      : undefined,
  };
}
