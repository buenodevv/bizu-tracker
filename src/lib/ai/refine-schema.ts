import { z } from "zod";

import type { RefineNode, RefineSuggestions } from "@/lib/ai/refine-types";

/**
 * Validação das sugestões da IA — módulo puro (sem "server-only") para poder
 * ser testado isoladamente. A resposta do modelo NUNCA é confiável.
 */

export const rawRefinementsSchema = z.object({
  merges: z
    .array(
      z.object({
        keep_id: z.string(),
        merge_ids: z.array(z.string()).min(1),
        reason: z.string().default(""),
      }),
    )
    .default([]),
  renames: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        reason: z.string().default(""),
      }),
    )
    .default([]),
  moves: z
    .array(
      z.object({
        id: z.string(),
        parent_id: z.string().nullable(),
        reason: z.string().default(""),
      }),
    )
    .default([]),
});

export type RawRefinements = z.infer<typeof rawRefinementsSchema>;

const MAX_PER_KIND = 10;

/** Profundidade de cada nó (raiz = 1), com proteção contra ciclos. */
function computeDepths(nodes: RefineNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depths = new Map<string, number>();

  for (const node of nodes) {
    let depth = 1;
    let current = node;
    const seen = new Set<string>([node.id]);

    while (current.parent_id) {
      const parent = byId.get(current.parent_id);
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      depth += 1;
      current = parent;
    }

    depths.set(node.id, depth);
  }

  return depths;
}

function isDescendant(
  candidate: string,
  ancestor: string,
  byId: Map<string, RefineNode>,
): boolean {
  let current = byId.get(candidate);
  const seen = new Set<string>();

  while (current?.parent_id) {
    if (current.parent_id === ancestor) return true;
    if (seen.has(current.parent_id)) return false;
    seen.add(current.parent_id);
    current = byId.get(current.parent_id);
  }

  return false;
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Valida as sugestões contra a árvore real:
 * - ids inexistentes são descartados
 * - mesclagens só entre irmãos, sem reutilizar um nó já mesclado
 * - movimentos só para o nível imediatamente acima e sem ciclos
 * - renomeações sem nomes vazios, idênticos ou em nós já mesclados
 */
export function sanitizeRefinements(
  raw: unknown,
  nodes: RefineNode[],
): RefineSuggestions {
  const parsed = rawRefinementsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("A IA retornou sugestões em formato inesperado.");
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depths = computeDepths(nodes);
  const mergedAway = new Set<string>();
  const result: RefineSuggestions = { merges: [], renames: [], moves: [] };

  for (const merge of parsed.data.merges) {
    if (result.merges.length >= MAX_PER_KIND) break;

    const keep = byId.get(merge.keep_id);
    if (!keep) continue;

    const sources = [...new Set(merge.merge_ids)]
      .filter((id) => id !== keep.id)
      .map((id) => byId.get(id))
      .filter(
        (node): node is RefineNode =>
          node !== undefined &&
          node.parent_id === keep.parent_id &&
          !mergedAway.has(node.id),
      );

    if (sources.length === 0) continue;

    result.merges.push({
      keepId: keep.id,
      keepName: keep.name,
      mergeIds: sources.map((n) => n.id),
      mergeNames: sources.map((n) => n.name),
      reason: cleanName(merge.reason),
    });

    for (const source of sources) mergedAway.add(source.id);
  }

  for (const rename of parsed.data.renames) {
    if (result.renames.length >= MAX_PER_KIND) break;

    const node = byId.get(rename.id);
    if (!node || mergedAway.has(node.id)) continue;

    const name = cleanName(rename.name);
    if (!name || name.length > 200 || name === node.name) continue;
    if (result.renames.some((r) => r.id === node.id)) continue;

    result.renames.push({
      id: node.id,
      currentName: node.name,
      newName: name,
      reason: cleanName(rename.reason),
    });
  }

  for (const move of parsed.data.moves) {
    if (result.moves.length >= MAX_PER_KIND) break;

    const node = byId.get(move.id);
    if (!node || mergedAway.has(node.id) || !move.parent_id) continue;

    const parent = byId.get(move.parent_id);
    if (!parent || parent.id === node.id) continue;

    // Mesmo nível: o novo pai deve estar exatamente um nível acima.
    const nodeDepth = depths.get(node.id) ?? 0;
    const parentDepth = depths.get(parent.id) ?? 0;
    if (parentDepth !== nodeDepth - 1) continue;

    if (isDescendant(parent.id, node.id, byId)) continue;
    if (node.parent_id === parent.id) continue;
    if (result.moves.some((m) => m.id === node.id)) continue;

    result.moves.push({
      id: node.id,
      name: node.name,
      parentId: parent.id,
      parentName: parent.name,
      reason: cleanName(move.reason),
    });
  }

  return result;
}
