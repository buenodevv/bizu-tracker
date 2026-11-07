"use client";

import { useTransition } from "react";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteQuestion } from "@/app/(app)/questions/actions";
import { Button } from "@/components/ui/button";

export function DeleteQuestionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Excluir questão"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteQuestion(id);
          if (res?.error) toast.error(res.error);
          else toast.success("Questão excluída.");
        })
      }
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
