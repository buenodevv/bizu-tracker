"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type RangeKey = "7d" | "30d" | "90d" | "365d";

export const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "365d": "Último ano",
};

export function RangeSelector({ value }: { value: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        items={RANGE_LABELS}
        onValueChange={(next) => {
          if (!next) return;
          const params = new URLSearchParams(searchParams.toString());
          params.set("range", next);
          startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, {
              scroll: false,
            });
          });
        }}
        disabled={isPending}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {RANGE_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending ? (
        <span className="text-muted-foreground text-xs">Atualizando…</span>
      ) : null}
    </div>
  );
}

export function ResetRangeButton() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.replace(pathname, { scroll: false })}
    >
      Limpar
    </Button>
  );
}
