import "server-only";

import { createHash } from "node:crypto";

import {
  getLlmProvider,
  hasUsefulTopics,
  LlmNotConfiguredError,
  normalizeEditalText,
  type ExtractedEdital,
} from "@/lib/ai/extract-edital";
import { createClient } from "@/lib/supabase/server";

/** Hash estável do conteúdo, usado como chave de cache. */
export function hashEditalText(rawText: string): string {
  const normalized = normalizeEditalText(rawText);
  return createHash("sha256").update(normalized).digest("hex");
}

export type ExtractionResult = {
  data: ExtractedEdital;
  /** true quando veio do cache (nenhuma chamada de IA foi feita). */
  fromCache: boolean;
  provider: string;
};

/**
 * Extrai a estrutura do edital, usando cache por hash do conteúdo.
 *
 * Fluxo:
 * 1. Calcula o hash do texto.
 * 2. Se houver cache, retorna direto (custo zero de IA).
 * 3. Senão, chama o provedor configurado.
 * 4. Salva no cache para os próximos usuários.
 */
export async function extractEditalWithCache(
  rawText: string,
): Promise<ExtractionResult> {
  const provider = getLlmProvider();
  if (!provider) {
    throw new LlmNotConfiguredError();
  }

  const contentHash = hashEditalText(rawText);
  const supabase = await createClient();

  // 1. Tenta o cache — mas só aceita entradas com tópicos reais.
  const { data: cached } = await supabase
    .from("edital_extraction_cache")
    .select("payload, provider")
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (cached?.payload) {
    const cachedData = cached.payload as ExtractedEdital;

    if (hasUsefulTopics(cachedData)) {
      // Incremento best-effort do contador (não deve quebrar o fluxo).
      void supabase
        .rpc("bump_extraction_cache_hit", { _hash: contentHash })
        .then(() => undefined, () => undefined);

      return {
        data: cachedData,
        fromCache: true,
        provider: cached.provider ?? provider.name,
      };
    }
    // Entrada rasa (gerada por versão antiga do prompt): ignorar e reprocessar.
  }

  // 2. Chama a IA
  const data = await provider.extractEdital(rawText);

  // 3. Só cacheia resultados com tópicos — evita propagar extração rasa.
  if (hasUsefulTopics(data)) {
    void supabase
      .from("edital_extraction_cache")
      .insert({
        content_hash: contentHash,
        payload: data,
        provider: provider.name,
        model: process.env.LLM_MODEL ?? null,
      })
      .then(() => undefined, () => undefined);
  }

  return { data, fromCache: false, provider: provider.name };
}

/**
 * Persiste a estrutura extraída como nós de `edital_subjects`.
 * Substitui o conteúdo anterior do edital (rascunho).
 */
export async function persistExtractedEdital(
  editalId: string,
  extracted: ExtractedEdital,
): Promise<{ error?: string; count?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  // Confirma a posse do edital.
  const { data: edital } = await supabase
    .from("editals")
    .select("id")
    .eq("id", editalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!edital) return { error: "Edital não encontrado." };

  // Remove a árvore anterior (children caem por CASCADE).
  await supabase
    .from("edital_subjects")
    .delete()
    .eq("edital_id", editalId)
    .is("parent_id", null);

  let sortOrder = 0;
  let count = 0;

  for (const subject of extracted.subjects) {
    const { data: created, error } = await supabase
      .from("edital_subjects")
      .insert({
        edital_id: editalId,
        parent_id: null,
        name: subject.name.trim(),
        importance: subject.importance,
        weight: subject.weight,
        sort_order: sortOrder++,
      })
      .select("id")
      .single();

    if (error || !created) continue;
    count += 1;

    if (subject.topics && subject.topics.length > 0) {
      const topicRows = subject.topics
        .filter((t) => t.name.trim().length > 0)
        .map((topic, i) => ({
          edital_id: editalId,
          parent_id: created.id,
          name: topic.name.trim(),
          importance: subject.importance,
          sort_order: i,
        }));

      if (topicRows.length > 0) {
        const { data: createdTopics } = await supabase
          .from("edital_subjects")
          .insert(topicRows)
          .select("id, name, sort_order");

        count += topicRows.length;

        // 3º nível: subtópicos vinculados a cada tópico criado.
        const subtopicRows: {
          edital_id: string;
          parent_id: string;
          name: string;
          importance: typeof subject.importance;
          sort_order: number;
        }[] = [];

        for (const createdTopic of createdTopics ?? []) {
          const original = subject.topics.find(
            (t) => t.name.trim() === createdTopic.name,
          );

          (original?.subtopics ?? []).forEach((sub, idx) => {
            const name = sub.trim();
            if (!name) return;
            subtopicRows.push({
              edital_id: editalId,
              parent_id: createdTopic.id,
              name,
              importance: subject.importance,
              sort_order: idx,
            });
          });
        }

        if (subtopicRows.length > 0) {
          await supabase.from("edital_subjects").insert(subtopicRows);
          count += subtopicRows.length;
        }
      }
    }
  }

  return { count };
}
