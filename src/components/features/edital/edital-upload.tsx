"use client";

import { useRef, useState, useTransition } from "react";

import { FileUp, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { extractFromPdf } from "@/app/(app)/edital/extract-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function EditalUpload({
  editalId,
  aiConfigured,
}: {
  editalId: string;
  aiConfigured: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "error" | "success" | "info"; text: string } | null
  >(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie um arquivo PDF.");
      return;
    }

    setFileName(file.name);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const res = await extractFromPdf(editalId, formData);

      if (res?.error) {
        setMessage({ kind: "error", text: res.error });
        toast.error("Não foi possível extrair o edital.");
        return;
      }

      setMessage({
        kind: "success",
        text: `${res?.success ?? "Edital extraído."}${res?.info ? ` ${res.info}` : ""}`,
      });
      toast.success("Edital extraído! Revise a estrutura abaixo.");
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  if (!aiConfigured) {
    return (
      <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
        <Sparkles className="text-muted-foreground size-4" />
        <p className="text-muted-foreground text-xs">
          Extração automática por IA desativada. Adicione{" "}
          <code className="bg-background rounded px-1">GEMINI_API_KEY</code> no{" "}
          <code className="bg-background rounded px-1">.env.local</code> para
          enviar o PDF — enquanto isso, use o editor manual abaixo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FileUp className="size-3.5" />
          )}
          {isPending ? "Extraindo com IA..." : "Enviar PDF do edital"}
        </Button>

        <Badge variant="outline" className="text-muted-foreground">
          <Wand2 className="size-3" />
          IA: Gemini
        </Badge>

        {fileName && !isPending ? (
          <span className="text-muted-foreground max-w-50 truncate text-xs">
            {fileName}
          </span>
        ) : null}
      </div>

      {isPending ? (
        <p className="text-muted-foreground text-xs">
          Lendo o PDF e identificando disciplinas e tópicos… pode levar alguns
          segundos.
        </p>
      ) : null}

      {message ? (
        <p
          className={
            message.kind === "error"
              ? "bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs"
              : "rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400"
          }
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
