"use client";

import { useState, useTransition } from "react";

import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import {
  applyRefinements,
  suggestRefinements,
  type RefineSelection,
} from "@/app/(app)/edital/refine-actions";
import {
  SuggestionReason,
  SuggestionRow,
} from "@/components/features/edital/suggestion-row";
import { Badge } from "@/components/ui/badge";
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
import {
  countSuggestions,
  emptySuggestions,
  type RefineSuggestions,
} from "@/lib/ai/refine-types";

/**
 * Sugestões de organização da árvore por IA. Nada é aplicado sem confirmação:
 * cada sugestão vem marcada, mas o usuário escolhe o que aplicar.
 */
export function EditalRefine({
  editalId,
  aiConfigured,
}: {
  editalId: string;
  aiConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<RefineSuggestions | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isApplying, startApplying] = useTransition();

  const load = () => {
    setError(null);
    setSuggestions(null);

    startLoading(async () => {
      const res = await suggestRefinements(editalId);

      if (res.error) {
        setError(res.error);
        return;
      }

      const next = res.suggestions ?? emptySuggestions();
      setSuggestions(next);
      setSelected(
        new Set([
          ...next.merges.map((_, i) => `merge:${i}`),
          ...next.renames.map((_, i) => `rename:${i}`),
          ...next.moves.map((_, i) => `move:${i}`),
        ]),
      );
    });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Só consulta a IA na primeira abertura; reabrir não gasta cota.
    if (next && !suggestions && !isLoading) load();
  };

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = () => {
    if (!suggestions) return;

    const selection: RefineSelection = {
      merges: suggestions.merges
        .filter((_, i) => selected.has(`merge:${i}`))
        .map((m) => ({ keepId: m.keepId, mergeIds: m.mergeIds })),
      renames: suggestions.renames
        .filter((_, i) => selected.has(`rename:${i}`))
        .map((r) => ({ id: r.id, newName: r.newName })),
      moves: suggestions.moves
        .filter((_, i) => selected.has(`move:${i}`))
        .map((m) => ({ id: m.id, parentId: m.parentId })),
    };

    const total =
      selection.merges.length + selection.renames.length + selection.moves.length;

    if (total === 0) {
      toast.info("Selecione ao menos uma sugestão.");
      return;
    }

    startApplying(async () => {
      const res = await applyRefinements(editalId, selection);

      if (res.error) toast.error(res.error);
      if (res.applied) {
        toast.success(
          `${res.applied} ${res.applied === 1 ? "ajuste aplicado" : "ajustes aplicados"}.`,
        );
        setSuggestions(null);
        setOpen(false);
      }
    });
  };

  const total = suggestions ? countSuggestions(suggestions) : 0;
  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        size="sm"
        disabled={!aiConfigured}
        title={
          aiConfigured
            ? "Revisar a organização da árvore com IA"
            : "Configure GEMINI_API_KEY para usar a IA"
        }
        onClick={() => handleOpenChange(true)}
      >
        <Sparkles className="size-3.5" />
        Refinar com IA
      </Button>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4" />
            Refinar organização
          </DialogTitle>
          <DialogDescription>
            A IA aponta duplicidades, nomes inconsistentes e erros de
            granularidade. Nada é alterado sem a sua confirmação.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Analisando a árvore do edital...
          </div>
        ) : error ? (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : suggestions && total === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Nada claro para ajustar"
            description="A árvore parece consistente. Nenhuma sugestão de alta confiança foi encontrada."
          />
        ) : suggestions ? (
          <div className="flex flex-col gap-5">
            {suggestions.merges.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  Mesclagens
                  <Badge variant="secondary">{suggestions.merges.length}</Badge>
                </h3>
                {suggestions.merges.map((merge, i) => (
                  <SuggestionRow
                    key={`merge:${i}`}
                    checked={selected.has(`merge:${i}`)}
                    onChange={() => toggle(`merge:${i}`)}
                  >
                    <span>
                      Manter <strong>{merge.keepName}</strong> e mesclar{" "}
                      <strong>{merge.mergeNames.join(", ")}</strong>
                    </span>
                    {merge.reason ? <SuggestionReason>{merge.reason}</SuggestionReason> : null}
                  </SuggestionRow>
                ))}
              </section>
            ) : null}

            {suggestions.renames.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  Renomeações
                  <Badge variant="secondary">{suggestions.renames.length}</Badge>
                </h3>
                {suggestions.renames.map((rename, i) => (
                  <SuggestionRow
                    key={`rename:${i}`}
                    checked={selected.has(`rename:${i}`)}
                    onChange={() => toggle(`rename:${i}`)}
                  >
                    <span>
                      <span className="text-muted-foreground line-through">
                        {rename.currentName}
                      </span>{" "}
                      → <strong>{rename.newName}</strong>
                    </span>
                    {rename.reason ? <SuggestionReason>{rename.reason}</SuggestionReason> : null}
                  </SuggestionRow>
                ))}
              </section>
            ) : null}

            {suggestions.moves.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  Movimentos
                  <Badge variant="secondary">{suggestions.moves.length}</Badge>
                </h3>
                {suggestions.moves.map((move, i) => (
                  <SuggestionRow
                    key={`move:${i}`}
                    checked={selected.has(`move:${i}`)}
                    onChange={() => toggle(`move:${i}`)}
                  >
                    <span>
                      Mover <strong>{move.name}</strong> para{" "}
                      <strong>{move.parentName}</strong>
                    </span>
                    {move.reason ? <SuggestionReason>{move.reason}</SuggestionReason> : null}
                  </SuggestionRow>
                ))}
              </section>
            ) : null}
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
            disabled={isApplying || isLoading || !suggestions || selectedCount === 0}
          >
            {isApplying
              ? "Aplicando..."
              : `Aplicar selecionadas (${selectedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
