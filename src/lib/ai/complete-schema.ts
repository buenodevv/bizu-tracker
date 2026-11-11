import { z } from "zod";

import type {
  CompleteSubject,
  NewTopicSuggestion,
} from "@/lib/ai/complete-types";

/**
 * Validação das sugestões de "Completar com IA" — módulo puro (sem
 * "server-only") para poder ser testado isoladamente.
 */

export const rawNewTopicsSchema = z.object({
  topics: z
    .array(
      z.object({
        subject_id: z.string(),
        name: z.string(),
        reason: z.string().default(""),
      }),
    )
    .default([]),
});

const MAX_SUGGESTIONS = 15;
const MAX_NAME_LENGTH = 160;

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Mantém apenas sugestões seguras:
 * - a disciplina precisa existir entre as raízes enviadas
 * - nome não vazio, não idêntico à disciplina e sem duplicar tópicos já
 *   existentes (comparação sem diferenciar maiúsculas)
 * - sem repetir a mesma sugestão duas vezes
 */
export function sanitizeNewTopics(
  raw: unknown,
  subjects: CompleteSubject[],
): NewTopicSuggestion[] {
  const parsed = rawNewTopicsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("A IA retornou sugestões em formato inesperado.");
  }

  const byId = new Map(subjects.map((s) => [s.id, s]));
  const existing = new Map(
    subjects.map((s) => [
      s.id,
      new Set(s.topicNames.map((name) => name.trim().toLowerCase())),
    ]),
  );

  const result: NewTopicSuggestion[] = [];
  const seen = new Set<string>();

  for (const suggestion of parsed.data.topics) {
    if (result.length >= MAX_SUGGESTIONS) break;

    const subject = byId.get(suggestion.subject_id);
    if (!subject) continue;

    const name = normalize(suggestion.name);
    if (!name || name.length > MAX_NAME_LENGTH) continue;
    if (name.toLowerCase() === subject.name.trim().toLowerCase()) continue;

    const key = `${subject.id}:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    if (existing.get(subject.id)?.has(name.toLowerCase())) continue;

    seen.add(key);
    result.push({
      subjectId: subject.id,
      subjectName: subject.name,
      name,
      reason: normalize(suggestion.reason),
    });
  }

  return result;
}
