"use client";

import { LogOut, Eye, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cambiarVista } from "@/app/(app)/acciones-vista";
import { VISTAS, type Vista } from "@/lib/auth/vista";

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

/** Como se nombra cada VISTA del "ver como" (ticket 028). */
const ETIQUETA_VISTA: Record<Vista, string> = {
  todo: "Todo (desarrollo)",
  gerente: "Como gerente",
  closer: "Como closer",
};

type Props = {
  nombre: string;
  email: string;
  imagen?: string | null;
  rol: Rol | null;
  /**
   * Si el usuario REAL es developer (por rol de sesion, no por vista): solo el
   * developer ve el selector de "ver como". Se decide en el servidor con
   * `esAccesoTotal` y llega como prop.
   */
  puedeCambiarVista: boolean;
  /** La vista marcada hoy en la cookie, para pintar el radio. */
  vista: Vista;
};

export function UserMenu({
  nombre,
  email,
  imagen,
  rol,
  puedeCambiarVista,
  vista,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  const iniciales = nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  /**
   * Cambia la vista: escribe la cookie (server action) y luego `router.refresh()`,
   * porque la vista cambia lo que TODA pantalla proyecta y `revalidatePath` no
   * refresca la pantalla actual (AGENTS.md).
   */
  function elegirVista(valor: string) {
    if (valor === vista) return;
    iniciar(async () => {
      await cambiarVista(valor as Vista);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-2"
          />
        }
      >
        <Avatar className="size-7">
          {imagen ? <AvatarImage src={imagen} alt="" /> : null}
          <AvatarFallback className="text-xs">
            {iniciales || "?"}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium">{nombre}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {rol ? ETIQUETA_ROL[rol] : "Sin rol"}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {/*
         * `DropdownMenuLabel` es `Menu.GroupLabel` de Base UI, y Base UI EXIGE que viva
         * dentro de un `Menu.Group` o un `Menu.RadioGroup`: fuera de uno lanza
         * "MenuGroupContext is missing" y el error tumba el layout entero, porque este
         * menu vive en el sidebar. No es cosmetico y no lo ve ningun test: solo aparece
         * al ABRIR el menu en un navegador. Estuvo roto desde antes del ticket 028 y se
         * descubrio el 18-sep, la primera vez que alguien lo abrio.
         */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium">{nombre}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {email}
            </span>
            <Badge variant="secondary" className="mt-2">
              {rol ?? "sin rol"}
            </Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {/*
         * El selector de "ver como" se renderiza SIEMPRE que el usuario sea developer,
         * independiente de la vista activa: es la unica salida cuando la vista `closer`
         * esconde Ajustes y Nerd Stats (ticket 028). No depende del nav.
         */}
        {puedeCambiarVista ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={vista} onValueChange={elegirVista}>
              {/* El label va DENTRO del RadioGroup, que es uno de los dos contenedores
                  que Base UI acepta para un GroupLabel. */}
              <DropdownMenuLabel className="flex items-center gap-1.5 text-muted-foreground">
                <Eye className="size-3.5" />
                Ver como
              </DropdownMenuLabel>
              {VISTAS.map((v) => (
                <DropdownMenuRadioItem key={v} value={v} disabled={pendiente}>
                  {ETIQUETA_VISTA[v]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        {/*
         * "Mi perfil" (ticket 031): todo usuario ve su closerId; solo un administrador
         * lo edita. La guarda real esta en la pagina y la server action, no aca. Base UI
         * quiere `render` para que el item sea un enlace, no `asChild`.
         */}
        <DropdownMenuItem render={<Link href="/perfil" />}>
          <User className="size-4" />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut({ redirectTo: "/login" })}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
