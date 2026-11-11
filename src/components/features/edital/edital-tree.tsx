"use client";

import { useMemo, useState, useTransition } from "react";

import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  Check,
  FolderInput,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createSubject,
  deleteSubject,
  moveSubject,
  reorderSubject,
  updateSubject,
} from "@/app/(app)/edital/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IMPORTANCE_LABELS } from "@/lib/format";
import type { Importance } from "@/types/database";

export type SubjectNode = {
  id: string;
  parent_id: string | null;
  name: string;
  importance: Importance;
  weight: number | null;
  sort_order: number;
  progress_studied: number;
};

type Props = {
  editalId: string;
  subjects: SubjectNode[];
  readOnly?: boolean;
};

/** Monta a árvore a partir da lista plana. */
function buildTree(nodes: SubjectNode[]) {
  const byParent = new Map<string | null, SubjectNode[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parent_id) ?? [];
    list.push(n);
    byParent.set(n.parent_id, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
  return byParent;
}

/** Conta descendentes de um nó (para aviso de exclusão). */
function countDescendants(
  byParent: Map<string | null, SubjectNode[]>,
  id: string,
): number {
  const children = byParent.get(id) ?? [];
  return children.reduce(
    (acc, c) => acc + 1 + countDescendants(byParent, c.id),
    0,
  );
}

/** Nós de um determinado nível (0 = raízes). */
function nodesAtDepth(
  byParent: Map<string | null, SubjectNode[]>,
  depth: number,
): SubjectNode[] {
  const result: SubjectNode[] = [];

  function walk(parentId: string | null, currentDepth: number) {
    for (const node of byParent.get(parentId) ?? []) {
      if (currentDepth === depth) result.push(node);
      else if (currentDepth < depth) walk(node.id, currentDepth + 1);
    }
  }

  walk(null, 0);
  return result;
}

/**
 * Ids visíveis para o filtro de busca: nós que casam com o texto e todos
 * os seus ancestrais (para manter o caminho visível).
 */
function visibleForQuery(
  subjects: SubjectNode[],
  query: string,
): Set<string> | null {
  if (!query) return null;

  const byId = new Map(subjects.map((s) => [s.id, s]));
  const visible = new Set<string>();
  const normalized = query.toLowerCase();

  for (const node of subjects) {
    if (!node.name.toLowerCase().includes(normalized)) continue;

    let current: SubjectNode | undefined = node;
    const seen = new Set<string>();

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      visible.add(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
  }

  return visible;
}

export function EditalTree({ editalId, subjects, readOnly = false }: Props) {
  const byParent = useMemo(() => buildTree(subjects), [subjects]);
  const byId = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => visibleForQuery(subjects, query.trim()),
    [subjects, query],
  );

  const roots = (byParent.get(null) ?? []).filter(
    (node) => !visible || visible.has(node.id),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar disciplina ou tópico..."
          aria-label="Buscar na árvore do edital"
          className="h-8 pl-8"
        />
      </div>

      {roots.length === 0 ? (
        visible ? (
          <p className="text-muted-foreground px-1 text-sm">
            Nenhum resultado para “{query.trim()}”.
          </p>
        ) : (
          <EmptyState
            icon={BookOpenCheck}
            title="Nenhuma disciplina ainda"
            description="Adicione a primeira disciplina abaixo."
            className="py-6"
          />
        )
      ) : (
        <div className="flex flex-col divide-y rounded-xl border">
          {roots.map((node) => (
            <SubjectRow
              key={node.id}
              node={node}
              byParent={byParent}
              byId={byId}
              editalId={editalId}
              depth={0}
              readOnly={readOnly}
              visible={visible}
            />
          ))}
        </div>
      )}

      {!readOnly ? (
        <AddSubjectForm
          editalId={editalId}
          parentId={null}
          placeholder="Nova disciplina (ex.: Direito Constitucional)"
        />
      ) : null}
    </div>
  );
}

function SubjectRow({
  node,
  byParent,
  byId,
  editalId,
  depth,
  readOnly,
  visible,
}: {
  node: SubjectNode;
  byParent: Map<string | null, SubjectNode[]>;
  byId: Map<string, SubjectNode>;
  editalId: string;
  depth: number;
  readOnly: boolean;
  visible: Set<string> | null;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(node.name);
  const [moveOpen, setMoveOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const allChildren = byParent.get(node.id) ?? [];
  const children = visible
    ? allChildren.filter((child) => visible.has(child.id))
    : allChildren;
  const hasChildren = children.length > 0;
  const descendants = countDescendants(byParent, node.id);

  // Busca força a expansão dos caminhos encontrados.
  const showChildren = (expanded || Boolean(visible)) && hasChildren;

  const siblings = byParent.get(node.parent_id) ?? [];
  const position = siblings.findIndex((s) => s.id === node.id);
  const canMoveUp = position > 0;
  const canMoveDown = position >= 0 && position < siblings.length - 1;

  const moveTargets = useMemo(() => {
    if (depth === 0) return [];
    return nodesAtDepth(byParent, depth - 1)
      .filter((candidate) => candidate.id !== node.parent_id)
      .map((candidate) => {
        const parent = candidate.parent_id
          ? byId.get(candidate.parent_id)
          : undefined;
        return {
          id: candidate.id,
          label: parent ? `${parent.name} › ${candidate.name}` : candidate.name,
        };
      });
  }, [byParent, byId, depth, node.parent_id]);

  const saveName = () => {
    const name = draftName.trim();
    if (!name || name === node.name) {
      setEditing(false);
      setDraftName(node.name);
      return;
    }
    startTransition(async () => {
      const res = await updateSubject({ id: node.id, name });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Nome atualizado.");
        setEditing(false);
      }
    });
  };

  const handleReorder = (direction: "up" | "down") => {
    startTransition(async () => {
      const res = await reorderSubject({ id: node.id, direction });
      if (res?.error) toast.error(res.error);
    });
  };

  const handleMove = (parentId: string) => {
    startTransition(async () => {
      const res = await moveSubject({ id: node.id, parent_id: parentId });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tópico movido.");
      setMoveOpen(false);
    });
  };

  return (
    <div>
      <div
        className="hover:bg-muted/40 flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-2"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <div className="flex min-w-0 items-center gap-2 sm:flex-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={expanded ? "Recolher" : "Expandir"}
            onClick={() => setExpanded((v) => !v)}
            disabled={!hasChildren}
            className={hasChildren ? "shrink-0" : "invisible shrink-0"}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </Button>

          {editing ? (
            <Input
              autoFocus
              className="h-7 min-w-0 flex-1 sm:max-w-sm"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setDraftName(node.name);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 text-left text-sm break-words sm:truncate"
              onClick={() => !readOnly && setEditing(true)}
              title={readOnly ? node.name : "Clique para renomear"}
            >
              {node.name}
              {descendants > 0 ? (
                <span className="text-muted-foreground ml-2 text-xs">
                  ({descendants})
                </span>
              ) : null}
            </button>
          )}
        </div>

        {node.progress_studied > 0 ? (
          <div className="hidden w-24 shrink-0 sm:block">
            <Progress value={node.progress_studied} className="h-1.5" />
          </div>
        ) : null}

        <div className="flex min-w-0 items-center gap-1 pl-7 sm:shrink-0 sm:pl-0">
          <div className="min-w-0 flex-1 sm:w-32 sm:flex-none">
            <ImportanceSelect
              id={node.id}
              value={node.importance}
              disabled={readOnly || isPending}
            />
          </div>

          {!readOnly ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Mais ações"
                disabled={isPending}
                className="hover:bg-accent focus-visible:ring-ring inline-flex size-6 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!canMoveUp || isPending}
                  onClick={() => handleReorder("up")}
                >
                  <ArrowUp className="size-3.5" />
                  Mover para cima
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canMoveDown || isPending}
                  onClick={() => handleReorder("down")}
                >
                  <ArrowDown className="size-3.5" />
                  Mover para baixo
                </DropdownMenuItem>
                {moveTargets.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setMoveOpen(true)}>
                      <FolderInput className="size-3.5" />
                      Mover para...
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Excluir"
              disabled={isPending}
              onClick={() => {
                const msg =
                  descendants > 0
                    ? `Excluir "${node.name}" e seus ${descendants} subtópicos?`
                    : `Excluir "${node.name}"?`;
                if (!window.confirm(msg)) return;

                startTransition(async () => {
                  const res = await deleteSubject(node.id);
                  if (res?.error) toast.error(res.error);
                  else toast.success("Tópico excluído.");
                });
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>

            <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Mover “{node.name}”</DialogTitle>
                  <DialogDescription>
                    Escolha o novo destino. Só é possível mover para um nó do
                    mesmo nível.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {moveTargets.map((target) => (
                    <Button
                      key={target.id}
                      variant="ghost"
                      className="h-auto justify-start py-2 text-left"
                      disabled={isPending}
                      onClick={() => handleMove(target.id)}
                    >
                      <FolderInput className="size-3.5 shrink-0" />
                      <span className="min-w-0 truncate">{target.label}</span>
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
        </div>
      </div>

      {showChildren ? (
        <div>
          {children.map((child) => (
            <SubjectRow
              key={child.id}
              node={child}
              byParent={byParent}
              byId={byId}
              editalId={editalId}
              depth={depth + 1}
              readOnly={readOnly}
              visible={visible}
            />
          ))}
        </div>
      ) : null}

      {expanded && !readOnly ? (
        <div style={{ paddingLeft: `${32 + depth * 20}px` }} className="pb-2 pr-3">
          <AddSubjectForm
            editalId={editalId}
            parentId={node.id}
            placeholder="Novo tópico..."
            compact
          />
        </div>
      ) : null}
    </div>
  );
}

function ImportanceSelect({
  id,
  value,
  disabled,
}: {
  id: string;
  value: Importance;
  disabled?: boolean;
}) {
  const [optimistic, setOptimistic] = useState<Importance>(value);
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={optimistic}
      items={IMPORTANCE_LABELS}
      disabled={disabled || isPending}
      onValueChange={(next) => {
        if (!next) return;
        const importance = next as Importance;
        setOptimistic(importance);
        startTransition(async () => {
          const res = await updateSubject({ id, importance });
          if (res?.error) {
            setOptimistic(value);
            toast.error(res.error);
          }
        });
      }}
    >
      <SelectTrigger
        size="sm"
        className="w-full shrink-0 sm:w-32"
        aria-label="Importância"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(IMPORTANCE_LABELS) as Importance[]).map((k) => (
          <SelectItem key={k} value={k}>
            {IMPORTANCE_LABELS[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddSubjectForm({
  editalId,
  parentId,
  placeholder,
  compact = false,
}: {
  editalId: string;
  parentId: string | null;
  placeholder: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const name = value.trim();
    if (!name) return;

    startTransition(async () => {
      const res = await createSubject({
        edital_id: editalId,
        name,
        parent_id: parentId,
      });
      if (res?.error) toast.error(res.error);
      else {
        setValue("");
        toast.success("Tópico adicionado.");
      }
    });
  };

  return (
    <div
      className={
        compact
          ? "flex items-center gap-2"
          : "flex flex-col gap-2 sm:flex-row sm:items-center"
      }
    >
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        disabled={isPending}
        className={compact ? "h-7 text-xs" : "h-8"}
        aria-label={placeholder}
      />
      <Button
        size={compact ? "icon-xs" : "sm"}
        className={compact ? undefined : "w-full sm:w-auto"}
        onClick={submit}
        disabled={!value.trim() || isPending}
        aria-label="Adicionar tópico"
      >
        <Plus className={compact ? "size-3.5" : "size-4"} />
        {!compact ? "Adicionar" : null}
      </Button>
    </div>
  );
}

/** Resumo do edital: totais e distribuição por importância. */
export function EditalSummary({ subjects }: { subjects: SubjectNode[] }) {
  const roots = subjects.filter((s) => s.parent_id === null);
  const topics = subjects.filter((s) => s.parent_id !== null);

  const byImportance = (["CAI_MUITO", "CAI_MEDIO", "CAI_POUCO"] as Importance[])
    .map((k) => ({
      key: k,
      label: IMPORTANCE_LABELS[k],
      count: subjects.filter((s) => s.importance === k).length,
    }))
    .filter((x) => x.count > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{roots.length} disciplinas</Badge>
      <Badge variant="secondary">{topics.length} tópicos</Badge>
      {byImportance.map((b) => (
        <Badge key={b.key} variant="outline" className="text-muted-foreground">
          {b.label}: {b.count}
        </Badge>
      ))}
    </div>
  );
}

/** Botão para marcar um tópico como estudado (avança o progresso em 25%). */
export function ProgressControls({ node }: { node: SubjectNode }) {
  const [isPending, startTransition] = useTransition();

  const bump = (delta: number) => {
    const next = Math.min(100, Math.max(0, node.progress_studied + delta));
    startTransition(async () => {
      const res = await updateSubject({
        id: node.id,
        progress_studied: next,
        status:
          next >= 100
            ? "DONE"
            : next > 0
              ? "IN_PROGRESS"
              : "NOT_STARTED",
      });
      if (res?.error) toast.error(res.error);
    });
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-xs"
        disabled={isPending || node.progress_studied <= 0}
        onClick={() => bump(-25)}
        aria-label="Reduzir progresso"
      >
        −
      </Button>
      <span className="w-10 text-center text-xs tabular-nums">
        {node.progress_studied}%
      </span>
      <Button
        variant="outline"
        size="icon-xs"
        disabled={isPending || node.progress_studied >= 100}
        onClick={() => bump(25)}
        aria-label="Aumentar progresso"
      >
        <Check className="size-3" />
      </Button>
    </div>
  );
}
