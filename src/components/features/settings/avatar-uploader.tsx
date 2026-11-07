"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  removeAvatar,
  uploadAvatar,
} from "@/app/(app)/settings/avatar-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AvatarUploader({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const send = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }

    // Pré-visualização imediata enquanto o upload acontece.
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.append("avatar", file);

    startTransition(async () => {
      const res = await uploadAvatar(formData);
      if (res?.error) {
        toast.error(res.error);
        setPreview(avatarUrl);
        return;
      }
      toast.success("Foto atualizada!");
      if (res?.url) setPreview(res.url);
    });
  }, [avatarUrl]);

  const handleRemove = () => {
    startTransition(async () => {
      const res = await removeAvatar();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Foto removida.");
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Avatar com anel de destaque e overlay ao passar o mouse */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        aria-label="Alterar foto de perfil"
        className="group relative size-20 shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar className="size-20 ring-2 ring-border transition-all duration-200 group-hover:ring-primary/50">
          {preview ? <AvatarImage src={preview} alt={name} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>

        <span className="bg-foreground/60 absolute inset-0 flex items-center justify-center rounded-full opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
          {isPending ? (
            <Loader2 className="text-background size-5 animate-spin" />
          ) : (
            <Camera className="text-background size-5" />
          )}
        </span>
      </button>

      <div
        className={`flex flex-1 flex-col gap-2 rounded-xl border border-dashed p-3 transition-colors duration-200 ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) send(file);
        }}
      >
        <p className="text-sm font-medium">
          {isDragging ? "Solte a imagem aqui" : "Foto de perfil"}
        </p>
        <p className="text-muted-foreground text-xs">
          Arraste uma imagem ou escolha um arquivo. PNG, JPG, WEBP ou GIF até
          2 MB.
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) send(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="size-3.5" />
            {isPending ? "Enviando..." : "Escolher imagem"}
          </Button>

          {preview ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRemove}
              disabled={isPending}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Remover
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
