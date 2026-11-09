"use client";

import { useTransition, type ComponentProps } from "react";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { duplicateCycle } from "@/app/(app)/cycles/actions";
import { Button } from "@/components/ui/button";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

/** Copia um ciclo compartilhado para a conta do usuário logado. */
export function DuplicateCycleButton({
  cycleId,
  label = "Copiar ciclo",
  variant = "default",
  size = "sm",
}: {
  cycleId: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const res = await duplicateCycle(cycleId);
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Ciclo copiado para a sua conta!");
          router.push("/cycles");
        });
      }}
    >
      <Copy className="size-4" />
      {isPending ? "Copiando..." : label}
    </Button>
  );
}
