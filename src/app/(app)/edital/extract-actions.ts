"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { describeAiError } from "@/lib/ai/describe-error";
import { getLlmProvider, hasUsefulTopics } from "@/lib/ai/extract-edital";
import {
  extractEditalWithCache,
  persistExtractedEdital,
} from "@/lib/ai/extract-service";

export type ExtractState = {
  error?: string;
  success?: string;
  info?: string;
  /** true quando a IA não está configurada (UI deve manter o modo manual). */
  notConfigured?: boolean;
} | undefined;

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Proteção simples contra extrações simultâneas demais no mesmo processo.
 * É best-effort (não vale entre réplicas), mas evita segurar o event loop
 * com vários PDFs grandes ao mesmo tempo.
 */
const MAX_CONCURRENT_EXTRACTIONS = 3;
let activeExtractions = 0;

function tryAcquireExtractionSlot(): boolean {
  if (activeExtractions >= MAX_CONCURRENT_EXTRACTIONS) return false;
  activeExtractions += 1;
  return true;
}

function releaseExtractionSlot(): void {
  activeExtractions = Math.max(0, activeExtractions - 1);
}

/**
 * Extrai texto de um PDF em memória.
 *
 * Nota: `pdf-parse` precisa estar em `serverExternalPackages` no next.config,
 * pois carrega `pdf.worker.mjs` em runtime.
 */
async function pdfToText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy?.().catch(() => undefined);
  }
}

/** Converte uma falha de leitura do PDF em mensagem acionável. */
function describePdfError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (/password/i.test(message)) {
    return "O PDF está protegido por senha. Remova a proteção e tente novamente.";
  }
  if (/fake worker|pdf\.worker|Cannot find module/i.test(message)) {
    return "Falha interna ao processar o PDF (worker ausente). Isso é um problema de configuração — avise o suporte.";
  }
  if (/InvalidPDF|not a pdf|bad XRef|format/i.test(message)) {
    return "O arquivo não parece ser um PDF válido ou está corrompido.";
  }
  return `Não foi possível ler o PDF: ${message}`;
}

async function assertEditalOwner(editalId: string) {
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

/**
 * Recebe o PDF do edital, extrai o texto e dispara a extração por IA.
 *
 * Como o processamento é rápido o bastante para editais típicos
 * (poucos segundos), roda de forma síncrona na Server Action. Se o
 * volume crescer, basta mover para o Inngest/Trigger.dev.
 */
export async function extractFromPdf(
  editalId: string,
  formData: FormData,
): Promise<ExtractState> {
  const ctx = await assertEditalOwner(editalId);
  if ("error" in ctx) return { error: ctx.error };

  if (!getLlmProvider()) {
    return {
      notConfigured: true,
      error:
        "A IA não está configurada. Adicione GEMINI_API_KEY no .env.local para usar a extração automática.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Selecione um arquivo PDF." };
  }
  if (file.size === 0) {
    return { error: "O arquivo está vazio." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { error: "Arquivo muito grande (máximo 15 MB)." };
  }
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return { error: "Envie um arquivo PDF." };
  }

  if (!tryAcquireExtractionSlot()) {
    return {
      error:
        "Muitas extrações em andamento no momento. Tente novamente em instantes.",
    };
  }

  try {
    // Cota mensal por usuário — aplicada dentro do banco, de forma atômica.
    const { data: quota, error: quotaError } = await ctx.supabase.rpc(
      "consume_ai_quota",
      { _kind: "extraction" },
    );

    if (quotaError) {
      // Fail-open: uma falha no controle de cota não deve bloquear a extração.
      console.warn("consume_ai_quota falhou:", quotaError.message);
    } else if (!quota?.[0]?.allowed) {
      return {
        error:
          "Você atingiu o limite mensal de extrações por IA do plano gratuito. Use o editor manual ou tente novamente no próximo mês.",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let text: string;
    try {
      text = await pdfToText(buffer);
    } catch (err) {
      return { error: describePdfError(err) };
    }

    if (text.trim().length < 60) {
      return {
        error:
          "O PDF parece não ter texto selecionável (provavelmente digitalizado como imagem). A extração automática precisa de um PDF com texto — você pode usar o editor manual abaixo.",
      };
    }

    try {
      const { data, fromCache } = await extractEditalWithCache(text);

      if (data.subjects.length === 0) {
        return {
          error:
            "A IA não encontrou disciplinas no documento. Verifique se o PDF contém o conteúdo programático.",
        };
      }

      if (!hasUsefulTopics(data)) {
        return {
          error:
            "A IA identificou as disciplinas, mas não listou os tópicos. Tente novamente — se persistir, use o editor manual abaixo.",
        };
      }

      const { error, count } = await persistExtractedEdital(editalId, data);

      if (error) return { error };

      revalidatePath("/edital");
      revalidatePath("/cycles");

      return {
        success: `Extraídas ${data.subjects.length} disciplinas (${count} nós no total). Revise e ajuste abaixo.`,
        info: fromCache
          ? "⚡ Resultado veio do cache — nenhum token de IA foi gasto."
          : `Processado por ${data.subjects.length} disciplinas em uma única chamada de IA.`,
      };
    } catch (err) {
      return { error: describeAiError(err, "Não foi possível extrair:") };
    }
  } finally {
    releaseExtractionSlot();
  }
}

/** Verifica se a IA está configurada (para a UI decidir o que mostrar). */
export async function isAiConfigured(): Promise<boolean> {
  return getLlmProvider() !== null;
}
