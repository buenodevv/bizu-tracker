import type { Importance } from "@/types/database";

/** Nó da árvore enviado à IA (mínimo necessário para julgar a organização). */
export type RefineNode = {
  id: string;
  parent_id: string | null;
  name: string;
  importance: Importance;
};

/**
 * Sugestões já validadas contra a árvore atual. Nada aqui é aplicado
 * automaticamente: a UI mostra cada item para o usuário decidir.
 */
export type RefineSuggestions = {
  merges: {
    keepId: string;
    keepName: string;
    mergeIds: string[];
    mergeNames: string[];
    reason: string;
  }[];
  renames: {
    id: string;
    currentName: string;
    newName: string;
    reason: string;
  }[];
  moves: {
    id: string;
    name: string;
    parentId: string;
    parentName: string;
    reason: string;
  }[];
};

export function emptySuggestions(): RefineSuggestions {
  return { merges: [], renames: [], moves: [] };
}

export function countSuggestions(s: RefineSuggestions): number {
  return s.merges.length + s.renames.length + s.moves.length;
}
