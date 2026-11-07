"use client";

import { usePathname } from "next/navigation";

/**
 * Aplica uma animação de entrada leve a cada mudança de rota.
 *
 * A `key` no `pathname` força a remontagem do wrapper, reiniciando a animação
 * a cada navegação — sem dependências externas.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
