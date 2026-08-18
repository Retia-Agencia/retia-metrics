"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  nombre: string;
  email: string;
  imagen?: string | null;
  rol: "gerente" | "closer";
};

export function UserMenu({ nombre, email, imagen, rol }: Props) {
  const iniciales = nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-2" />}
      >
        <Avatar className="size-7">
          {imagen ? <AvatarImage src={imagen} alt="" /> : null}
          <AvatarFallback className="text-xs">{iniciales || "?"}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium">{nombre}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {rol === "gerente" ? "Gerencia comercial" : "Closer"}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{nombre}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
          <Badge variant="secondary" className="mt-2">
            {rol}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ redirectTo: "/login" })}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
