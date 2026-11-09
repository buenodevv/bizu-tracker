"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMinutes } from "@/lib/format";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 32, top: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
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
        <Bar dataKey="minutes" radius={[0, 6, 6, 0]} name="Minutos">
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickFormatter={(v: string) => {
            const [, m, d] = v.split("-");
            return `${d}/${m}`;
          }}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickFormatter={(v: number) => formatMinutes(v)}
        />
        <Tooltip content={<ChartTooltip formatter={(v) => formatMinutes(Number(v))} />} />
        <Line
          type="monotone"
          dataKey="minutes"
          name="Minutos"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
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

function accuracyColor(accuracy: number): string {
  if (accuracy >= 70) return "var(--chart-1)";
  if (accuracy >= 50) return "var(--chart-3)";
  return "var(--destructive)";
}

export function AccuracyChart({ data }: { data: AccuracyDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart message="Nenhuma questão resolvida no período." />;
  }

  const sorted = [...data].sort((a, b) => a.accuracy - b.accuracy);
  const height = Math.max(200, sorted.length * 44);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ left: 8, right: 48, top: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
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
        <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} name="Acurácia">
          {sorted.map((d, i) => (
            <Cell key={i} fill={accuracyColor(d.accuracy)} />
          ))}
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
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
            ? (() => {
                const [, m, d] = label.split("-");
                return `${d}/${m}`;
              })()
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

// ---------------------------------------------------------------------------
// Horas por tópico (barras horizontais, agrupadas visualmente por disciplina)
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
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={top}
        layout="vertical"
        margin={{ left: 8, right: 40, top: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
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
        <Bar dataKey="minutes" radius={[0, 6, 6, 0]} name="Minutos">
          {top.map((d, i) => (
            <Cell
              key={i}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
