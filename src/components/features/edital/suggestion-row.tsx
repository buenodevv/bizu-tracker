/** Linha de sugestão de IA com checkbox — compartilhada por refinar/completar. */
export function SuggestionRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-primary mt-0.5 size-4 shrink-0"
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export function SuggestionReason({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
      {children}
    </span>
  );
}
