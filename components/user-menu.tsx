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

import type { Rol } from "@/lib/auth/roles";

/**
 * Como se nombra cada rol en la interfaz. Es un `Record<Rol, string>` a proposito:
 * al sumar un rol a `ROLES`, el typecheck exige nombrarlo aca en vez de dejar que
 * caiga en silencio a "Sin rol".
 */
const ETIQUETA_ROL: Record<Rol, string> = {
  gerente: "Gerencia comercial",
  closer: "Closer",
  developer: "Desarrollo",
};

type Props = {
  nombre: string;
  email: string;
  imagen?: string | null;
  rol: Rol | null;
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
            {rol ? ETIQUETA_ROL[rol] : "Sin rol"}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{nombre}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
          <Badge variant="secondary" className="mt-2">
            {rol ?? "sin rol"}
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
