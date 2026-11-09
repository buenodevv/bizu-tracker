"use client";

import { useId, useState } from "react";

import { Plus } from "lucide-react";
import { cn } from "cn";

/** Item de FAQ com abertura animada e acessível. */
export function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className="py-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-md text-left text-sm font-medium outline-none focus-visible:ring-2"
      >
        {question}
        <Plus
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-45",
          )}
        />
      </button>

      <div
        id={contentId}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <p className="text-muted-foreground mt-2 pr-8 text-sm">{answer}</p>
        </div>
      </div>
    </div>
  );
}
