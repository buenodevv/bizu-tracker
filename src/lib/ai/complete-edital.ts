import "server-only";

import type { LlmProvider } from "@/lib/ai/extract-edital";
import type { CompleteSubject } from "@/lib/ai/complete-types";

/** Schema declarativo aceito pelo Gemini (structured output). */
const GEMINI_COMPLETE_SCHEMA = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subject_id: { type: "string" },
          name: { type: "string" },
          reason: { type: "string" },
        },
        required: ["subject_id", "name"],
        propertyOrdering: ["subject_id", "name", "reason"],
      },
    },
  },
  required: ["topics"],
  propertyOrdering: ["topics"],
} as const;

export function buildCompletePrompt(
  subjects: CompleteSubject[],
  examBoard?: string | null,
): string {
  const board = examBoard?.trim()
    ? `Banca/exame: ${examBoard.trim()}.`
    : "Banca não informada.";

  return `Você é especialista no conteúdo programático de concursos e vestibulares brasileiros.
${board}

Abaixo está a árvore atual do edital: cada disciplina (raiz) com os tópicos já cadastrados.

Sua tarefa é sugerir APENAS tópicos que estejam claramente faltando, com base no programa típico da banca/exame.

REGRAS OBRIGATÓRIAS:
1. Use exatamente o subject_id de uma das disciplinas enviadas.
2. NUNCA repita um tópico que já está na lista daquela disciplina (nem com outra grafia).
3. Sugira no máximo 3 tópicos por disciplina e 15 no total.
4. Não invente disciplinas novas e não sugira subtópicos — apenas tópicos do 2º nível.
5. Na dúvida, não sugira. Só inclua o que for claramente ausente para a banca.
6. Se não houver lacuna evidente, devolva a lista vazia.

ÁRVORE ATUAL:
${JSON.stringify({ subjects }, null, 0)}

Responda apenas com o JSON no formato solicitado.`;
}

export async function completeEditalTopics(
  provider: LlmProvider,
  subjects: CompleteSubject[],
  examBoard?: string | null,
): Promise<unknown> {
  return provider.generateJson(
    buildCompletePrompt(subjects, examBoard),
    GEMINI_COMPLETE_SCHEMA as unknown as Record<string, unknown>,
  );
}
