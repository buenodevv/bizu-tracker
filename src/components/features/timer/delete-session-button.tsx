"use client";

import { useTransition } from "react";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteStudySession } from "@/app/(app)/timer/actions";
import { Button } from "@/components/ui/button";

export function DeleteSessionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Excluir sessão"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteStudySession(id);
          if (res?.error) toast.error(res.error);
          else toast.success("Sessão excluída.");
        })
      }
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
