"use client";

import { useActionState } from "react";

import { updateProfile, type SettingsState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Cuiaba", label: "Cuiabá (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
];

const TIMEZONE_ITEMS = Object.fromEntries(
  TIMEZONES.map((t) => [t.value, t.label]),
);

export function ProfileForm({
  name,
  weeklyGoalMin,
  timezone,
}: {
  name: string;
  weeklyGoalMin: number;
  timezone: string;
}) {
  const [state, formAction, isPending] = useActionState<
    SettingsState,
    FormData
  >(updateProfile, undefined);

  // Exibe a meta em horas com uma casa decimal (ex.: 20,5).
  const goalHours = (weeklyGoalMin / 60).toFixed(1).replace(".", ",");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="weekly_goal_min">Meta semanal (horas)</Label>
          <Input
            id="weekly_goal_min"
            name="weekly_goal_min"
            type="number"
            step="0.5"
            min="0.5"
            max="100"
            defaultValue={goalHours}
            required
          />
          <p className="text-muted-foreground text-xs">
            Atual: {goalHours}h por semana.
          </p>
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="timezone">Fuso horário</Label>
          <Select
            name="timezone"
            defaultValue={timezone}
            items={TIMEZONE_ITEMS}
          >
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Usado para agrupar suas sessões por dia corretamente.
          </p>
        </div>
      </div>

      {state?.error ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          {state.success}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar preferências"}
      </Button>
    </form>
  );
}
