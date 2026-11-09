"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMinutes } from "@/lib/format";

// Cor única por gráfico (uma série = uma cor). Texto e eixos usam tokens de
// texto; a cor fica só nos marks.
const SERIES_COLOR = "var(--chart-1)";
const GRID_COLOR = "var(--border)";

// ---------------------------------------------------------------------------
// Acessibilidade: tabela equivalente (visualmente oculta) para leitores de tela
// ---------------------------------------------------------------------------

function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Horas por matéria (barras horizontais)
// ---------------------------------------------------------------------------

export type HoursBySubjectDatum = { subject_name: string; minutes: number };

export function HoursBySubjectChart({ data }: { data: HoursBySubjectDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart message="Nenhuma sessão no período." />;
  }

  const height = Math.max(200, data.length * 44);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 32, top: 8, bottom: 8 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatMinutes(v)}
            stroke="var(--muted-foreground)"
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="subject_name"
            width={140}
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => formatMinutes(Number(v))} />}
          />
          <Bar
            dataKey="minutes"
            fill={SERIES_COLOR}
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            name="Minutos"
          />
        </BarChart>
      </ResponsiveContainer>
      <ChartTable
        caption="Tempo estudado por matéria"
        columns={["Matéria", "Tempo"]}
        rows={data.map((d) => [d.subject_name, formatMinutes(d.minutes)])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horas por dia (linha)
// ---------------------------------------------------------------------------

export type HoursByDayDatum = { day: string; minutes: number };

export function HoursByDayChart({ data }: { data: HoursByDayDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart message="Nenhuma sessão no período." />;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ left: 0, right: 16, top: 8, bottom: 8 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="day"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v: string) => shortDay(v)}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v: number) => formatMinutes(v)}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => formatMinutes(Number(v))} />}
          />
          <Line
            type="monotone"
            dataKey="minutes"
            name="Minutos"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <ChartTable
        caption="Tempo estudado por dia"
        columns={["Dia", "Tempo"]}
        rows={data.map((d) => [shortDay(d.day), formatMinutes(d.minutes)])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acurácia por matéria (barras horizontais, menor acurácia primeiro)
// ---------------------------------------------------------------------------

export type AccuracyDatum = {
  subject_name: string;
  accuracy: number;
  total: number;
};

export function AccuracyChart({ data }: { data: AccuracyDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart message="Nenhuma questão resolvida no período." />;
  }

  const sorted = [...data].sort((a, b) => a.accuracy - b.accuracy);
  const height = Math.max(200, sorted.length * 44);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ left: 8, right: 48, top: 8, bottom: 8 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="subject_name"
            width={140}
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
          />
          <Tooltip
            content={
              <ChartTooltip
                formatter={(v) => `${Number(v).toFixed(1)}%`}
                labelSuffix={(payload) => {
                  const total = (payload?.[0] as { total?: number } | undefined)
                    ?.total;
                  return total != null ? ` (${total} questões)` : "";
                }}
              />
            }
          />
          <Bar
            dataKey="accuracy"
            fill={SERIES_COLOR}
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            name="Acurácia"
          >
            <LabelList
              dataKey="accuracy"
              position="right"
              fontSize={11}
              fill="var(--muted-foreground)"
              formatter={(value) => `${Math.round(Number(value))}%`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartTable
        caption="Acurácia por matéria"
        columns={["Matéria", "Acurácia", "Questões"]}
        rows={sorted.map((d) => [
          d.subject_name,
          `${d.accuracy.toFixed(1)}%`,
          d.total,
        ])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horas por tópico (barras horizontais)
// ---------------------------------------------------------------------------

export type HoursByTopicDatum = {
  topic_name: string;
  subject_name: string;
  minutes: number;
};

export function HoursByTopicChart({ data }: { data: HoursByTopicDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart message="Nenhum tópico registrado no período." />;
  }

  // Limita a 12 tópicos para o gráfico ficar legível.
  const top = data.slice(0, 12);
  const height = Math.max(220, top.length * 38);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={top}
          layout="vertical"
          margin={{ left: 8, right: 40, top: 8, bottom: 8 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatMinutes(v)}
            stroke="var(--muted-foreground)"
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="topic_name"
            width={170}
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => formatMinutes(Number(v))} />}
          />
          <Bar
            dataKey="minutes"
            fill={SERIES_COLOR}
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            name="Minutos"
          />
        </BarChart>
      </ResponsiveContainer>
      <ChartTable
        caption="Tempo estudado por tópico"
        columns={["Tópico", "Disciplina", "Tempo"]}
        rows={top.map((d) => [
          d.topic_name,
          d.subject_name,
          formatMinutes(d.minutes),
        ])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortDay(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex h-56 items-center justify-center text-sm">
      {message}
    </div>
  );
}

type TooltipPayloadItem = {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelSuffix,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatter?: (value: number | string) => string;
  labelSuffix?: (payload?: Record<string, unknown>[]) => string;
}) {
  if (!active || !payload?.length) return null;

  const suffix = labelSuffix?.(payload.map((p) => p.payload ?? {})) ?? "";

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-sm shadow-md">
      {label ? (
        <p className="mb-1 font-medium">
          {typeof label === "string" && /^\d{4}-\d{2}-\d{2}/.test(label)
            ? shortDay(label)
            : label}
          {suffix}
        </p>
      ) : null}
      {payload.map((item, i) => (
        <p key={i} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-medium tabular-nums">
            {formatter && item.value != null
              ? formatter(item.value)
              : item.value}
          </span>
        </p>
      ))}
    </div>
  );
}
