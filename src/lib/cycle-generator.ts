import type { Importance } from "@/types/database";

export type GenerationInput = {
  subjects: {
    id: string | null;
    name: string;
    weight: number | null;
    importance: Importance;
  }[];
  weeklyGoalMin: number;
  daysPerWeek: number;
  /** Tamanho máximo desejado de um bloco (min). Default 90. */
  maxBlockMin?: number;
  /** Tamanho mínimo de um bloco (min). Default 20. */
  minBlockMin?: number;
};

export type GeneratedBlock = {
  subject_id: string | null;
  subject_name: string;
  minutes: number;
  day_of_cycle: number;
  sort_order: number;
};

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

/**
 * Gera os blocos de um ciclo.
 *
 * Estratégia:
 * 1. Divide a meta semanal entre as matérias proporcionalmente ao peso.
 * 2. Quebra o tempo de cada matéria em blocos de no máximo `maxBlockMin`.
 * 3. Distribui os blocos nos dias com round-robin (a matéria de maior peso
 *    sai na frente na fila), equilibrando a carga diária.
 */
export function generateCycleBlocks(input: GenerationInput): GeneratedBlock[] {
  const {
    subjects,
    weeklyGoalMin,
    daysPerWeek,
    maxBlockMin = 90,
    minBlockMin = 20,
  } = input;

  if (subjects.length === 0) return [];
  if (weeklyGoalMin < minBlockMin) return [];

  const days = Math.min(7, Math.max(1, Math.floor(daysPerWeek)));

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

  // 3. Quebra cada matéria em blocos menores
  const queue: { subject: (typeof allocated)[number]; minutes: number }[] = [];

  // Embaralhamento determinístico: ordena por peso, menor bloco primeiro,
  // para que a distribuição fique equilibrada ao longo dos dias.
  const ordered = [...allocated].sort((a, b) => b.weight - a.weight);

  for (const subject of ordered) {
    let remaining = subject.minutes;
    // Quantidade de blocos: o suficiente para nenhum passar de maxBlockMin
    const chunks = Math.max(1, Math.ceil(remaining / maxBlockMin));
    const perChunk = Math.round(remaining / chunks / 5) * 5;

    for (let i = 0; i < chunks; i += 1) {
      const isLast = i === chunks - 1;
      const minutes = isLast ? remaining : Math.max(minBlockMin, perChunk);
      const use = Math.min(minutes, remaining);
      if (use <= 0) break;

      queue.push({ subject, minutes: use });
      remaining -= use;
    }
  }

  // 4. Round-robin nos dias, equilibrando a carga diária
  const perDay: GeneratedBlock[][] = Array.from({ length: days }, () => []);
  const dayLoad = Array.from({ length: days }, () => 0);

  let order = 0;
  for (const item of queue) {
    // Escolhe o dia com menor carga (estável: menor índice em empate)
    let bestDay = 0;
    for (let d = 1; d < days; d += 1) {
      if (dayLoad[d] < dayLoad[bestDay]) bestDay = d;
    }

    perDay[bestDay].push({
      subject_id: item.subject.id,
      subject_name: item.subject.name,
      minutes: item.minutes,
      day_of_cycle: bestDay,
      sort_order: order++,
    });
    dayLoad[bestDay] += item.minutes;
  }

  return perDay.flat().sort((a, b) => {
    if (a.day_of_cycle !== b.day_of_cycle) return a.day_of_cycle - b.day_of_cycle;
    return a.sort_order - b.sort_order;
  });
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
