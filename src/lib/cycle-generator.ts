import type {
  ActivityType,
  Importance,
  ProgressStatus,
} from "@/types/database";

export type GeneratorTopic = {
  id: string | null;
  name: string;
  status: ProgressStatus;
  /** Data ISO da última sessão neste tópico; null quando nunca estudado. */
  lastStudiedAt: string | null;
};

export type GeneratorSubject = {
  id: string | null;
  name: string;
  weight: number | null;
  importance: Importance;
  /** Tópicos do edital (2º nível). Vazio = a matéria é a própria unidade. */
  topics?: GeneratorTopic[];
};

export type GenerationInput = {
  subjects: GeneratorSubject[];
  weeklyGoalMin: number;
  daysPerWeek: number;
  /** Tamanho máximo desejado de um bloco (min). Default 90. */
  maxBlockMin?: number;
  /** Tamanho mínimo de um bloco (min). Default 20. */
  minBlockMin?: number;
  /** Data de referência para detectar tópicos "esquecidos". */
  today?: Date | string;
};

export type GeneratedBlock = {
  subject_id: string | null;
  subject_name: string;
  topic_id: string | null;
  topic_name: string | null;
  activity: ActivityType;
  minutes: number;
  day_of_cycle: number;
  sort_order: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Tópico sem estudo há mais de 14 dias ganha prioridade. */
const STALE_DAYS = 14;

/**
 * Peso efetivo de uma disciplina.
 * Usa `weight` quando informado; senão deriva da importância.
 */
export function effectiveWeight(input: {
  weight: number | null;
  importance: Importance;
}): number {
  if (input.weight !== null && input.weight > 0) return input.weight;

  switch (input.importance) {
    case "CAI_MUITO":
      return 3;
    case "CAI_MEDIO":
      return 2;
    case "CAI_POUCO":
      return 1;
  }
}

function toTimestamp(value: Date | string | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Prioridade do tópico — menor valor estuda antes:
 * - 0 nunca estudado
 * - 1 "esquecido" (sem estudo há mais de 14 dias)
 * - 2 em andamento
 * - 3 revisado/outros
 * - 4 concluído (só entra na fila quando toda a matéria terminou)
 */
function topicPriority(topic: GeneratorTopic, todayMs: number): number {
  if (topic.status === "DONE") return 4;

  const lastMs = toTimestamp(topic.lastStudiedAt);
  if (lastMs === null) return 0;
  if ((todayMs - lastMs) / DAY_MS >= STALE_DAYS) return 1;
  if (topic.status === "IN_PROGRESS") return 2;
  return 3;
}

type TopicUnit = {
  topic_id: string | null;
  topic_name: string | null;
  activity: ActivityType;
  priority: number;
  lastMs: number | null;
  index: number;
};

/**
 * Unidades de estudo de uma matéria, em ordem de prioridade.
 *
 * Matéria sem tópicos vira uma unidade única (a própria matéria). Se todos os
 * tópicos estiverem concluídos, a matéria entra em modo revisão — os tópicos
 * estudados há mais tempo vêm primeiro (revisão espaçada simples).
 */
function buildTopicUnits(
  subject: GeneratorSubject,
  todayMs: number,
): TopicUnit[] {
  const topics = (subject.topics ?? []).filter(
    (t) => t.name.trim().length > 0,
  );

  if (topics.length === 0) {
    return [
      {
        topic_id: null,
        topic_name: null,
        activity: "THEORY",
        priority: 0,
        lastMs: null,
        index: 0,
      },
    ];
  }

  const allDone = topics.every((t) => t.status === "DONE");
  const eligible = allDone
    ? topics
    : topics.filter((t) => t.status !== "DONE");

  return eligible
    .map<TopicUnit>((topic, index) => ({
      topic_id: topic.id,
      topic_name: topic.name.trim(),
      activity: allDone ? "REVIEW" : "THEORY",
      priority: topicPriority(topic, todayMs),
      lastMs: toTimestamp(topic.lastStudiedAt),
      index,
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Há mais tempo sem estudo vem antes; nunca estudado (null) primeiro.
      const aLast = a.lastMs ?? -Infinity;
      const bLast = b.lastMs ?? -Infinity;
      if (aLast !== bLast) return aLast - bLast;
      return a.index - b.index;
    });
}

type QueueItem = {
  subject_id: string | null;
  subject_name: string;
  weight: number;
  topic_id: string | null;
  topic_name: string | null;
  activity: ActivityType;
  minutes: number;
};

/**
 * Gera os blocos de um ciclo.
 *
 * Estratégia:
 * 1. Divide a meta semanal entre as matérias proporcionalmente ao peso.
 * 2. Dentro de cada matéria, ordena os tópicos por prioridade (nunca
 *    estudado > esquecido > em andamento > revisado > concluído).
 * 3. Quebra o tempo de cada matéria em blocos de no máximo `maxBlockMin`,
 *    alternando entre os tópicos prioritários.
 * 4. Distribui os blocos nos dias com round-robin ponderado, evitando o mesmo
 *    tópico duas vezes no mesmo dia e variando as matérias de cada dia.
 */
export function generateCycleBlocks(input: GenerationInput): GeneratedBlock[] {
  const {
    subjects,
    weeklyGoalMin,
    daysPerWeek,
    maxBlockMin = 90,
    minBlockMin = 20,
    today,
  } = input;

  if (subjects.length === 0) return [];
  if (weeklyGoalMin < minBlockMin) return [];

  const days = Math.min(7, Math.max(1, Math.floor(daysPerWeek)));
  const todayMs = toTimestamp(today ?? new Date()) ?? Date.now();

  // 1. Pesos e minutos por matéria
  const weighted = subjects.map((s) => ({
    ...s,
    weight: effectiveWeight(s),
  }));

  const totalWeight = weighted.reduce((acc, s) => acc + s.weight, 0);
  if (totalWeight <= 0) return [];

  const allocated = weighted.map((s) => {
    const raw = (weeklyGoalMin * s.weight) / totalWeight;
    return { ...s, minutes: Math.max(minBlockMin, Math.round(raw)) };
  });

  // 2. Ajusta o total para bater com a meta
  reconcileTotal(allocated, weeklyGoalMin, minBlockMin);

  // 3. Quebra cada matéria em blocos menores, alternando os tópicos
  const queue: QueueItem[] = [];

  // Matérias de maior peso primeiro — a distribuição por carga equilibra os dias.
  const ordered = [...allocated].sort((a, b) => b.weight - a.weight);

  for (const subject of ordered) {
    const units = buildTopicUnits(subject, todayMs);
    let remaining = subject.minutes;

    const chunks = Math.max(1, Math.ceil(remaining / maxBlockMin));
    const perChunk = Math.min(
      maxBlockMin,
      Math.max(minBlockMin, Math.round(remaining / chunks / 5) * 5),
    );

    for (let i = 0; i < chunks; i += 1) {
      const isLast = i === chunks - 1;
      const minutes = isLast ? remaining : Math.min(perChunk, remaining);
      if (minutes <= 0) break;

      const unit = units[i % units.length];

      queue.push({
        subject_id: subject.id,
        subject_name: subject.name,
        weight: subject.weight,
        topic_id: unit.topic_id,
        topic_name: unit.topic_name,
        activity: unit.activity,
        minutes,
      });
      remaining -= minutes;
    }
  }

  // 4. Distribui nos dias, equilibrando a carga
  const perDay: GeneratedBlock[][] = Array.from({ length: days }, () => []);
  const dayLoad = Array.from({ length: days }, () => 0);

  let order = 0;
  for (const item of queue) {
    let bestDay = 0;
    let bestScore: DayScore | null = null;

    for (let d = 0; d < days; d += 1) {
      const blocks = perDay[d];
      const sameTopic =
        item.topic_id !== null &&
        blocks.some((b) => b.topic_id === item.topic_id);
      // Quantos blocos da mesma matéria o dia já tem — espalha a variedade.
      const sameSubject = blocks.filter(
        (b) =>
          item.subject_id !== null
            ? b.subject_id === item.subject_id
            : b.subject_name === item.subject_name,
      ).length;

      // Ordem de preferência: sem tópico repetido, menor carga, mais variedade.
      const score: DayScore = [
        sameTopic ? 1 : 0,
        dayLoad[d],
        sameSubject,
        d,
      ];

      if (!bestScore || isLowerScore(score, bestScore)) {
        bestScore = score;
        bestDay = d;
      }
    }

    perDay[bestDay].push({
      subject_id: item.subject_id,
      subject_name: item.subject_name,
      topic_id: item.topic_id,
      topic_name: item.topic_name,
      activity: item.activity,
      minutes: item.minutes,
      day_of_cycle: bestDay,
      sort_order: 0,
    });
    dayLoad[bestDay] += item.minutes;
  }

  const blocks: GeneratedBlock[] = [];
  for (let d = 0; d < days; d += 1) {
    for (const block of perDay[d]) {
      blocks.push({ ...block, sort_order: order++ });
    }
  }

  return blocks;
}

type DayScore = readonly [number, number, number, number];

function isLowerScore(a: DayScore, b: DayScore): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * Ajusta os minutos alocados até somarem `target`, distribuindo a diferença
 * nas matérias de menor peso (respeitando o mínimo por matéria).
 */
function reconcileTotal(
  allocated: { minutes: number; weight: number }[],
  target: number,
  minBlockMin: number,
): void {
  const current = allocated.reduce((acc, s) => acc + s.minutes, 0);
  let diff = target - current;
  if (diff === 0) return;

  const step = Math.min(minBlockMin, 5);
  const byLightest = [...allocated].sort((a, b) => a.weight - b.weight);

  let guard = 0;
  while (Math.abs(diff) >= step && guard < 5000) {
    guard += 1;
    let changed = false;

    for (const subject of byLightest) {
      if (Math.abs(diff) < step) break;

      if (diff > 0) {
        subject.minutes += step;
        diff -= step;
        changed = true;
      } else if (subject.minutes - step >= minBlockMin) {
        subject.minutes -= step;
        diff += step;
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Diferença residual vai para a matéria de maior peso.
  if (diff !== 0) {
    const heaviest = allocated.reduce((a, b) => (a.weight >= b.weight ? a : b));
    heaviest.minutes = Math.max(minBlockMin, heaviest.minutes + diff);
  }
}

/** Total de minutos de um conjunto de blocos. */
export function totalCycleMinutes(
  blocks: { minutes: number }[],
): number {
  return blocks.reduce((acc, b) => acc + b.minutes, 0);
}

/** Minutos por dia de um conjunto de blocos. */
export function minutesByDay(
  blocks: { minutes: number; day_of_cycle: number }[],
  periodDays: number,
): number[] {
  const days = Array.from({ length: Math.max(1, periodDays) }, () => 0);
  for (const b of blocks) {
    const day = Math.min(Math.max(0, b.day_of_cycle), days.length - 1);
    days[day] += b.minutes;
  }
  return days;
}
