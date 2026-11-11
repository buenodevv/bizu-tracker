import "server-only";

import { z } from "zod";

// ---------------------------------------------------------------------------
// Contrato de saída da extração do edital
// ---------------------------------------------------------------------------

export const extractedSubjectSchema = z.object({
  name: z.string().describe("Nome da disciplina"),
  importance: z
    .enum(["CAI_POUCO", "CAI_MEDIO", "CAI_MUITO"])
    .describe("Importância estimada pela incidência no edital"),
  // Aceita qualquer peso positivo: modelos costumam devolver 1..10.
  // A normalização para 0..1 acontece em `parseExtractedEdital`.
  weight: z
    .number()
    .min(0)
    .describe("Peso relativo da disciplina (será normalizado para 0 a 1)"),
  topics: z
    .array(
      z.object({
        name: z.string(),
        subtopics: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export const extractedEditalSchema = z.object({
  title: z.string().describe("Título do concurso/vestibular"),
  examBoard: z.string().nullable().optional(),
  subjects: z.array(extractedSubjectSchema),
});

export type ExtractedEdital = z.infer<typeof extractedEditalSchema>;
export type ExtractedSubject = z.infer<typeof extractedSubjectSchema>;

// ---------------------------------------------------------------------------
// Interface do provedor (trocável)
// ---------------------------------------------------------------------------

export interface LlmProvider {
  readonly name: string;
  extractEdital(text: string): Promise<ExtractedEdital>;
  /**
   * Geração de JSON estruturado a partir de um prompt + schema declarativo.
   * Usado por features que validam a resposta por conta própria (ex.:
   * refinamento da árvore do edital).
   */
  generateJson(
    prompt: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<unknown>;
}

/** Erro de configuração/credencial — permite fallback gracioso na UI. */
export class LlmNotConfiguredError extends Error {
  constructor(message = "Chave de IA não configurada.") {
    super(message);
    this.name = "LlmNotConfiguredError";
  }
}

/** Limite de caracteres enviados ao modelo (evita custo/latência excessivos). */
export const MAX_EDITAL_CHARS = 120_000;

/**
 * Limpa o texto do edital antes de enviar:
 * - remove sequências de espaços e linhas vazias repetidas
 * - mantém o conteúdo semântico intacto
 */
export function normalizeEditalText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    // Remove marcadores de página inseridos pelo parser (ex.: "-- 3 of 42 --").
    .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gim, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EDITAL_CHARS);
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * Instruções para o modelo. Regras importantes:
 * - extrair SOMENTE conteúdo programático (não inscrição, datas, taxas)
 * - inferir importância pela incidência/peso declarado
 * - saída em JSON estrito
 */
export function buildExtractionPrompt(text: string): string {
  return `Você é um especialista em editais de concursos públicos e vestibulares brasileiros.

Tarefa: extrair o CONTEÚDO PROGRAMÁTICO do edital abaixo e estruturá-lo em disciplinas e tópicos.

REGRAS OBRIGATÓRIAS:

1. Extraia APENAS disciplinas e assuntos que o candidato precisa estudar.
2. IGNORE completamente: cronograma, datas de inscrição, taxas, requisitos de escolaridade, atribuições do cargo, legislação do concurso, informações sobre a prova, número de vagas, salário, quadro de provas com horários.
3. Mantenha a nomenclatura original do edital (não invente nomes).

ESTRUTURA (muito importante):
4. O array "topics" de cada disciplina é OBRIGATÓRIO e deve conter TODOS os assuntos daquela disciplina. Uma disciplina sem "topics" é considerada ERRADA.
5. Cada item numerado ou separado por ponto no texto original é um tópico próprio. Exemplo: o texto "1 Princípios fundamentais. 2 Direitos e garantias." gera DOIS tópicos.
6. Quando um tópico tiver itens detalhados (subitens após dois-pontos, letras a), b), c), etc.), coloque-os em "subtopics".
7. Preserve a granularidade do edital: não junte assuntos diferentes em um único tópico nem invente tópicos que não existem.
8. Se o texto listar uma disciplina sem nenhum assunto detalhado, crie um único tópico com o próprio nome da disciplina. Nunca retorne "topics" vazio.

CLASSIFICAÇÃO:
9. importance: "CAI_MUITO" se o edital dedicar mais assuntos/peso à disciplina, "CAI_POUCO" se dedicar poucos, "CAI_MEDIO" no caso intermediário.
10. weight: distribua proporcionalmente à quantidade de assuntos de cada disciplina. A soma aproximada deve ser 1.
11. Não crie disciplinas que não estejam no texto.

TEXTO DO EDITAL:
"""
${text}
"""

Responda APENAS com o JSON no formato solicitado.`;
}

// ---------------------------------------------------------------------------
// Provider: Google Gemini
// ---------------------------------------------------------------------------

// Schema JSON do Gemini (formato declarativo aceito pela API).
const GEMINI_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    examBoard: { type: "string" },
    subjects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          importance: {
            type: "string",
            enum: ["CAI_POUCO", "CAI_MEDIO", "CAI_MUITO"],
          },
          weight: { type: "number" },
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                subtopics: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["name"],
              propertyOrdering: ["name", "subtopics"],
            },
          },
        },
        required: ["name", "importance", "weight"],
        propertyOrdering: ["name", "importance", "weight", "topics"],
      },
    },
  },
  required: ["title", "subjects"],
  propertyOrdering: ["title", "examBoard", "subjects"],
} as const;

/** Modelo padrão do Gemini para extração (barato e com structured output). */
export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";

/**
 * Uma chave `LLM_MODEL` só é usada pelo Gemini se parecer um modelo Gemini.
 * Caso contrário (ex.: `gpt-4o-mini`), cai no padrão — evita 404 confuso.
 */
function resolveGeminiModel(configured?: string): string {
  const value = configured?.trim();
  if (value && /^gemini[-.]/i.test(value)) return value;
  return DEFAULT_GEMINI_MODEL;
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model?: string,
  ) {
    this.model = resolveGeminiModel(model ?? process.env.LLM_MODEL);
  }

  async extractEdital(text: string): Promise<ExtractedEdital> {
    const raw = await this.generateJson(
      buildExtractionPrompt(normalizeEditalText(text)),
      GEMINI_SCHEMA as unknown as Record<string, unknown>,
    );
    return parseExtractedEditalObject(raw);
  }

  async generateJson(
    prompt: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<unknown> {
    const { GoogleGenAI } = await import("@google/genai");
    // O SDK usa `v1` por padrão, mas os modelos `*-latest` só existem em
    // `v1beta`. Sem isso, a API responde 404 "model is not found".
    const ai = new GoogleGenAI({
      apiKey: this.apiKey,
      httpOptions: { apiVersion: "v1beta" },
    });

    const response = await ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        // Força JSON e restringe a forma da resposta.
        responseMimeType: "application/json",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: jsonSchema as any,
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });

    const raw = response.text;
    if (!raw) {
      throw new Error("A IA não retornou conteúdo.");
    }

    return parseJsonResponse(raw);
  }
}

// ---------------------------------------------------------------------------
// Parse seguro (a resposta do modelo não é confiável)
// ---------------------------------------------------------------------------

/** Remove cercas de código e parseia o JSON devolvido pela IA. */
export function parseJsonResponse(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("A IA retornou um JSON inválido.");
  }
}

export function parseExtractedEdital(raw: string): ExtractedEdital {
  return parseExtractedEditalObject(parseJsonResponse(raw));
}

export function parseExtractedEditalObject(parsed: unknown): ExtractedEdital {
  const result = extractedEditalSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("A resposta da IA não segue o formato esperado.");
  }

  // Normaliza: remove disciplinas vazias e reescala os pesos para somarem ~1.
  const subjects = result.data.subjects.filter(
    (s) => s.name.trim().length > 0,
  );

  // Normaliza nomes e subtópicos.
  for (const subject of subjects) {
    subject.name = subject.name.trim();
    subject.topics = (subject.topics ?? [])
      .filter((t) => t.name.trim().length > 0)
      // Descarta tópicos que apenas repetem o nome da disciplina.
      .filter(
        (t) => t.name.trim().toLowerCase() !== subject.name.toLowerCase(),
      )
      .map((t) => ({
        name: t.name.trim(),
        subtopics: (t.subtopics ?? [])
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      }));
  }

  const totalWeight = subjects.reduce((acc, s) => acc + (s.weight || 0), 0);
  if (totalWeight > 0) {
    for (const s of subjects) {
      s.weight = Number((s.weight / totalWeight).toFixed(4));
    }
  }

  return {
    title: result.data.title.trim(),
    examBoard: result.data.examBoard?.trim() || null,
    subjects,
  };
}

/**
 * Verifica se a extração trouxe tópicos de verdade.
 *
 * Se todas as disciplinas vieram sem tópicos, a resposta é inútil
 * (provavelmente o modelo ignorou a instrução) — devemos falhar em vez de
 * gravar uma árvore rasa ou cachear o resultado ruim.
 */
export function hasUsefulTopics(data: ExtractedEdital): boolean {
  if (data.subjects.length === 0) return false;
  const subjectsWithTopics = data.subjects.filter(
    (s) => s.topics.length > 0,
  ).length;
  // Aceita se a maioria das disciplinas tiver ao menos um tópico.
  return subjectsWithTopics / data.subjects.length >= 0.5;
}

// ---------------------------------------------------------------------------
// Fábrica
// ---------------------------------------------------------------------------

/**
 * Cria o provedor configurado. Retorna `null` quando não há chave,
 * permitindo que a UI degrade para o editor manual.
 */
export function getLlmProvider(): LlmProvider | null {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    return new GeminiProvider(geminiKey);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey !== "sk-...") {
    return new OpenAiProvider(openaiKey);
  }

  return null;
}

/** Retorna o provedor ou lança erro tipado. */
export function requireLlmProvider(): LlmProvider {
  const provider = getLlmProvider();
  if (!provider) {
    throw new LlmNotConfiguredError(
      "Configure GEMINI_API_KEY no arquivo .env.local para usar a extração por IA.",
    );
  }
  return provider;
}

// ---------------------------------------------------------------------------
// Provider alternativo: OpenAI-compatible (opcional)
// ---------------------------------------------------------------------------

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.OPENAI_MODEL || "gpt-4o-mini",
    private readonly baseUrl =
      process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  ) {}

  async extractEdital(text: string): Promise<ExtractedEdital> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Responda somente JSON com o formato: {"title":string,"examBoard":string,"subjects":[{"name":string,"importance":"CAI_POUCO"|"CAI_MEDIO"|"CAI_MUITO","weight":number,"topics":[{"name":string,"subtopics":string[]}]}]}',
          },
          {
            role: "user",
            content: buildExtractionPrompt(normalizeEditalText(text)),
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Falha na IA (${res.status}).`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("A IA não retornou conteúdo.");

    return parseExtractedEdital(content);
  }

  async generateJson(
    prompt: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Responda somente com JSON válido que siga este schema: ${JSON.stringify(jsonSchema)}`,
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Falha na IA (${res.status}).`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("A IA não retornou conteúdo.");

    return parseJsonResponse(content);
  }
}
