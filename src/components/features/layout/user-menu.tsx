"use client";

import { useTransition } from "react";

import Link from "next/link";

import { LogOut, Settings, UserRound } from "lucide-react";

import { logout } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string | null;
  avatarUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Menu do usuário"
          />
        }
      >
        <Avatar className="size-8 ring-2 ring-border transition-all duration-200 group-hover/button:ring-primary/40">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {initials || <UserRound className="size-4" />}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <Avatar className="size-8">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials || <UserRound className="size-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate">{name}</span>
              {email ? (
                <span className="text-muted-foreground truncate text-xs font-normal">
                  {email}
                </span>
              ) : null}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/settings" />}
          nativeButton={false}
        >
          <Settings className="size-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isPending}
          onClick={() => startTransition(() => logout())}
        >
          <LogOut className="size-4" />
          {isPending ? "Saindo..." : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
