"use client";

import Image from "next/image";

import { Maximize2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Screenshot clicável com lightbox acessível (abre/fecha com animação). */
export function ScreenshotFrame({
  src,
  alt,
  title,
  width,
  height,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Ampliar: ${title}`}
        className="group bg-card relative block w-full cursor-zoom-in overflow-hidden rounded-xl text-left ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          className="h-auto w-full"
        />
        <span className="bg-background/90 text-foreground pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-100 shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
          <Maximize2 className="size-3.5" />
          Ampliar
        </span>
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-1rem)] max-w-6xl p-1.5 pt-9 sm:max-w-6xl [&_[data-slot=dialog-close]]:bg-background/90 [&_[data-slot=dialog-close]]:ring-1 [&_[data-slot=dialog-close]]:ring-foreground/10 [&_[data-slot=dialog-close]]:backdrop-blur">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="100vw"
          className="h-auto w-full rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
}
