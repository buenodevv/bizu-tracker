"use client";

import { useState, useTransition } from "react";

import { Copy, Globe, Lock, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteCycle,
  duplicateCycle,
  setCycleVisibility,
} from "@/app/(app)/cycles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ACTIVITY_LABELS, formatMinutes } from "@/lib/format";
import type { ActivityType } from "@/types/database";

export type CycleBlockView = {
  id: string;
  subject_name: string;
  activity: ActivityType;
  minutes: number;
  day_of_cycle: number;
};

export type CycleView = {
  id: string;
  name: string;
  description: string | null;
  period_days: number;
  is_public: boolean;
  source_cycle_id: string | null;
  blocks: CycleBlockView[];
  isOwn: boolean;
};

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function CycleCard({ cycle }: { cycle: CycleView }) {
  const [isPublic, setIsPublic] = useState(cycle.is_public);
  const [isPending, startTransition] = useTransition();

  const total = cycle.blocks.reduce((acc, b) => acc + b.minutes, 0);

  const byDay = Array.from({ length: cycle.period_days }, (_, day) =>
    cycle.blocks.filter((b) => b.day_of_cycle === day),
  );

  const handleTogglePublic = (next: boolean) => {
    setIsPublic(next);
    startTransition(async () => {
      const res = await setCycleVisibility(cycle.id, next);
      if (res?.error) {
        setIsPublic(!next);
        toast.error(res.error);
      } else {
        toast.success(next ? "Ciclo público!" : "Ciclo privado.");
      }
    });
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/cycles/public/${cycle.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span className="truncate">{cycle.name}</span>
              {isPublic ? (
                <Badge variant="secondary" className="shrink-0">
                  <Globe className="size-3" />
                  público
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0">
                  <Lock className="size-3" />
                  privado
                </Badge>
              )}
              {cycle.source_cycle_id ? (
                <Badge variant="outline" className="shrink-0">
                  cópia
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              {cycle.blocks.length} blocos · {formatMinutes(total)} ·{" "}
              {cycle.period_days} dias
            </CardDescription>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {cycle.isOwn ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copiar link público"
                  onClick={handleCopyLink}
                  disabled={!isPublic}
                >
                  <Share2 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Excluir ciclo"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await deleteCycle(cycle.id);
                      if (res?.error) toast.error(res.error);
                      else toast.success("Ciclo excluído.");
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await duplicateCycle(cycle.id);
                    if (res?.error) toast.error(res.error);
                    else toast.success("Ciclo copiado para a sua conta!");
                  })
                }
              >
                <Copy className="size-3.5" />
                Copiar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {cycle.description ? (
          <p className="text-muted-foreground text-sm">{cycle.description}</p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {byDay.map((dayBlocks, day) => {
            const minutes = dayBlocks.reduce((acc, b) => acc + b.minutes, 0);
            return (
              <div key={day} className="rounded-lg border p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium">
                    {DAY_LABELS[day] ?? `Dia ${day + 1}`}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {minutes > 0 ? formatMinutes(minutes) : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {dayBlocks.map((b) => (
                    <div
                      key={b.id}
                      className="text-muted-foreground flex items-center justify-between gap-1 text-xs"
                    >
                      <span className="truncate">{b.subject_name}</span>
                      <span className="shrink-0 tabular-nums">
                        {b.minutes}min
                        <span className="text-muted-foreground/60">
                          {" "}
                          · {ACTIVITY_LABELS[b.activity]}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {cycle.isOwn ? (
          <>
            <Separator />
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <Globe className="text-muted-foreground size-4" />
                Compartilhar publicamente
              </span>
              <Switch
                checked={isPublic}
                onCheckedChange={handleTogglePublic}
                disabled={isPending}
                aria-label="Compartilhar ciclo publicamente"
              />
            </label>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
