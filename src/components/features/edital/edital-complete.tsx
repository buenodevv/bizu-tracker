"use client";

import { useState, useTransition } from "react";

import { ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  applyNewTopics,
  suggestMissingTopics,
} from "@/app/(app)/edital/complete-actions";
import { SuggestionReason, SuggestionRow } from "@/components/features/edital/suggestion-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { NewTopicSuggestion } from "@/lib/ai/complete-types";

/**
 * Sugestões de tópicos ausentes com base na banca. O usuário escolhe o que
 * adicionar — nada é gravado sem confirmação.
 */
export function EditalComplete({
  editalId,
  aiConfigured,
}: {
  editalId: string;
  aiConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<NewTopicSuggestion[] | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isApplying, startApplying] = useTransition();

  const load = () => {
    setError(null);
    setSuggestions(null);

    startLoading(async () => {
      const res = await suggestMissingTopics(editalId);

      if (res.error) {
        setError(res.error);
        return;
      }

      const next = res.suggestions ?? [];
      setSuggestions(next);
      setSelected(new Set(next.map((_, i) => i)));
    });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Só consulta a IA na primeira abertura; reabrir não gasta cota.
    if (next && !suggestions && !isLoading) load();
  };

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const apply = () => {
    if (!suggestions) return;

    const topics = suggestions
      .filter((_, index) => selected.has(index))
      .map((suggestion) => ({
        subjectId: suggestion.subjectId,
        name: suggestion.name,
      }));

    if (topics.length === 0) {
      toast.info("Selecione ao menos um tópico.");
      return;
    }

    startApplying(async () => {
      const res = await applyNewTopics(editalId, { topics });

      if (res.error) toast.error(res.error);
      if (res.applied) {
        toast.success(
          `${res.applied} ${res.applied === 1 ? "tópico adicionado" : "tópicos adicionados"}.`,
        );
        setSuggestions(null);
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        size="sm"
        disabled={!aiConfigured}
        title={
          aiConfigured
            ? "Sugerir tópicos ausentes com IA"
            : "Configure GEMINI_API_KEY para usar a IA"
        }
        onClick={() => handleOpenChange(true)}
      >
        <ListPlus className="size-3.5" />
        Completar com IA
      </Button>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="size-4" />
            Completar tópicos
          </DialogTitle>
          <DialogDescription>
            A IA compara sua árvore com o programa típico da banca e sugere
            apenas o que parece faltar. Você escolhe o que adicionar.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Procurando lacunas no conteúdo programático...
          </div>
        ) : error ? (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : suggestions && suggestions.length === 0 ? (
          <EmptyState
            icon={ListPlus}
            title="Nenhuma lacuna evidente"
            description="A árvore já cobre o programa típico desta banca, ou não há informação suficiente para sugerir com segurança."
          />
        ) : suggestions ? (
          <div className="flex flex-col gap-2">
            {suggestions.map((suggestion, index) => (
              <SuggestionRow
                key={`${suggestion.subjectId}:${suggestion.name}`}
                checked={selected.has(index)}
                onChange={() => toggle(index)}
              >
                <span>
                  Adicionar <strong>{suggestion.name}</strong> em{" "}
                  <strong>{suggestion.subjectName}</strong>
                </span>
                {suggestion.reason ? (
                  <SuggestionReason>{suggestion.reason}</SuggestionReason>
                ) : null}
              </SuggestionRow>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isApplying}
          >
            Fechar
          </Button>
          <Button
            onClick={apply}
            disabled={
              isApplying || isLoading || !suggestions || selected.size === 0
            }
          >
            {isApplying
              ? "Adicionando..."
              : `Adicionar selecionados (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
