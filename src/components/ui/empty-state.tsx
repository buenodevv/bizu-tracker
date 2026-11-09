import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

/**
 * Estado vazio compacto e consistente: ícone, título, explicação curta e
 * (opcionalmente) uma ação.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-8 text-center",
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-xs text-xs">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
