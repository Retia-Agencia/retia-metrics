"use client";

import { Check, LogOut, Eye, UserCircle, Users } from "lucide-react";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cambiarVista, verComoUsuario } from "@/app/(app)/acciones-vista";
import type { Vista } from "@/lib/auth/vista";
import type { UsuarioSuplantable } from "@/lib/catalogo/usuarios";

import { ETIQUETA_ROL, ROLES, type Rol } from "@/lib/auth/roles";

/** Como se nombra cada VISTA del "ver como" (ticket 028). */
const ETIQUETA_VISTA: Record<Vista, string> = {
  todo: "Todo (desarrollo)",
  gerente: "Como gerente",
  closer: "Como closer",
  paid_trafficker: "Como paid trafficker",
  customer_success: "Como Customer Success",
  media: "Como Media",
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
  /**
   * Las vistas del radio. Llegan por props: `lib/auth/vista` carga la base desde el
   * 172, y un import de VALOR de ahí mete el driver al navegador (AGENTS.md).
   */
  vistas: readonly Vista[];
  /**
   * Las personas activas que el developer puede suplantar ("Ver como persona →", ticket
   * 172). Se cargan en el servidor (layout) y entran por props: este componente es
   * cliente y NUNCA importa `lib/db` (solo el `type`).
   */
  personas: readonly UsuarioSuplantable[];
  /** La persona que se está viendo ahora (para marcarla), o `null`. */
  suplantadoId: string | null;
};

export function UserMenu({
  nombre,
  email,
  imagen,
  rol,
  puedeCambiarVista,
  vista,
  vistas,
  personas,
  suplantadoId,
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

  /** Las personas agrupadas por rol, en el orden de `ROLES`; los roles sin nadie no salen. */
  const porRol = ROLES.map((r) => ({
    rol: r,
    gente: personas.filter((p) => p.rol === r),
  })).filter((g) => g.gente.length > 0);

  /** Suplanta a una persona de verdad: escribe la cookie y refresca (ticket 172). */
  function elegirPersona(userId: string) {
    if (userId === suplantadoId) return;
    iniciar(async () => {
      await verComoUsuario(userId);
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
              {vistas.map((v) => (
                <DropdownMenuRadioItem key={v} value={v} disabled={pendiente}>
                  {ETIQUETA_VISTA[v]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {/*
             * "Ver como persona →" (ticket 172, ampliado a todos los roles): suplanta a
             * alguien de VERDAD, con sus membresías, deals y alcance, en SOLO LECTURA. Es
             * otra cosa que el radio (que solo estrecha el rol del developer): aquí cambia
             * la identidad con la que se leen los datos. La lista sale de `users`, así que
             * una persona o un rol nuevo aparece sin tocar este archivo.
             */}
            {porRol.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Users className="size-3.5" />
                  Ver como persona
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
                  {porRol.map((g) => (
                    <DropdownMenuGroup key={g.rol}>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {ETIQUETA_ROL[g.rol]}
                      </DropdownMenuLabel>
                      {g.gente.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => elegirPersona(p.id)}
                          disabled={pendiente}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{p.nombre}</span>
                            <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                          </span>
                          {p.id === suplantadoId ? <Check className="size-4 shrink-0" /> : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
          </>
        ) : null}
        <DropdownMenuSeparator />
        {/*
         * "Mi espacio" (ticket 172): todo lo del usuario —perfil, pendientes, deals,
         * llamadas y students por programa— en una ruta. Reemplaza el enlace a "Mi
         * perfil". Base UI quiere `render` para que el item sea un enlace, no `asChild`.
         */}
        <DropdownMenuItem render={<Link href="/mi-espacio" />}>
          <UserCircle className="size-4" />
          Mi espacio
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut({ redirectTo: "/login" })}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
