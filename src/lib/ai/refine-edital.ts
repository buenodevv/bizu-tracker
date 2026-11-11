import "server-only";

import type { LlmProvider } from "@/lib/ai/extract-edital";
import type { RefineNode } from "@/lib/ai/refine-types";

/** Schema declarativo aceito pelo Gemini (structured output). */
const GEMINI_REFINE_SCHEMA = {
  type: "object",
  properties: {
    merges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          keep_id: { type: "string" },
          merge_ids: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
        },
        required: ["keep_id", "merge_ids"],
        propertyOrdering: ["keep_id", "merge_ids", "reason"],
      },
    },
    renames: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          reason: { type: "string" },
        },
        required: ["id", "name"],
        propertyOrdering: ["id", "name", "reason"],
      },
    },
    moves: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          parent_id: { type: "string", nullable: true },
          reason: { type: "string" },
        },
        required: ["id", "parent_id"],
        propertyOrdering: ["id", "parent_id", "reason"],
      },
    },
  },
  required: ["merges", "renames", "moves"],
  propertyOrdering: ["merges", "renames", "moves"],
} as const;

export function buildRefinePrompt(nodes: RefineNode[]): string {
  return `Você organiza editais verticalizados de concursos e vestibulares.
Abaixo está a árvore atual, em JSON, onde cada nó tem id, parent_id, nome e importância.

Sua tarefa é propor apenas ajustes CLARAMENTE problemáticos na organização.

REGRAS OBRIGATÓRIAS:
1. Mesclagens ("merges"): apenas entre nós IRMÃOS (mesmo parent_id) com nomes duplicados ou equivalentes. Escolha como keep_id o nome mais completo/padrão e liste os demais em merge_ids.
2. Renomeações ("renames"): apenas nomes truncados, com numeração solta ("1.1", "a)") ou claramente inconsistentes. Mantenha o significado original e use no máximo 120 caracteres.
3. Movimentos ("moves"): apenas quando a granularidade estiver claramente errada — por exemplo, uma disciplina listada como tópico de outra. O parent_id de destino deve ser um nó existente de um nível acima. Nunca mova uma disciplina para dentro de outra disciplina.
4. NÃO proponha exclusões.
5. NUNCA invente ids. Use exatamente os ids presentes na árvore.
6. Na dúvida, não sugira. Menos sugestões de alta confiança valem mais que muitas incertas.
7. Máximo de 20 sugestões no total. Se não houver nada claro, devolva as três listas vazias.

ÁRVORE ATUAL:
${JSON.stringify({ nodes }, null, 0)}

Responda apenas com o JSON no formato solicitado.`;
}

export async function refineEditalTree(
  provider: LlmProvider,
  nodes: RefineNode[],
): Promise<unknown> {
  return provider.generateJson(
    buildRefinePrompt(nodes),
    GEMINI_REFINE_SCHEMA as unknown as Record<string, unknown>,
  );
}
