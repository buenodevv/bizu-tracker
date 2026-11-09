import Link from "next/link";

import { BookOpenCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
        <BookOpenCheck className="size-6" />
      </div>
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">
        Página não encontrada
      </h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        O link pode ter expirado, o conteúdo foi removido ou o endereço está
        incorreto.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button render={<Link href="/" />} nativeButton={false}>
          Ir para o início
        </Button>
        <Button
          variant="outline"
          render={<Link href="/login" />}
          nativeButton={false}
        >
          Entrar
        </Button>
      </div>
    </div>
  );
}
