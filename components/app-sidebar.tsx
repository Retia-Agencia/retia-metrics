"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarCheck, Library, LineChart, Settings, Tag, Users } from "lucide-react";
import { navParaRol, type ItemNav } from "@/lib/nav";
import type { Rol } from "@/lib/auth/roles";
import type { Vista } from "@/lib/auth/vista";
import { cn } from "@/lib/utils";
import { Marca } from "@/components/marca";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const ICONOS: Record<ItemNav["icono"], typeof LineChart> = {
  programa: LineChart,
  recursos: Library,
  ajustes: Settings,
  midia: CalendarCheck,
  productos: Tag,
  nerdstats: Activity,
  personas: Users,
};

type Props = {
  /** El rol DE VISTA (ya proyectado): la nav se estrecha con el (ticket 028). */
  rol: Rol | null;
  nombre: string;
  email: string;
  imagen?: string | null;
  programas: readonly { slug: string; nombre: string }[];
  /** Si el usuario REAL es developer: solo el ve el selector de "ver como". */
  puedeCambiarVista: boolean;
  /** La vista marcada hoy en la cookie. */
  vista: Vista;
};

/**
 * El MARCO de la app (sistema "Tinta", docs/design-system.md): oscuro en los dos temas,
 * para que la navegacion se lea como el marco y el trabajo como la hoja. Declara
 * `data-zona="marco"`, que redefine los tokens (`app/globals.css`), asi que lo que viva
 * aqui dentro se ve bien sin estilos propios.
 *
 * Los programas van en su propio grupo: son fronteras (ADR 0043), no un filtro, y se
 * navega de uno a otro.
 */
export function AppSidebar({
  rol,
  nombre,
  email,
  imagen,
  programas,
  puedeCambiarVista,
  vista,
}: Props) {
  const pathname = usePathname();
  // La lista viene filtrada por el ROL DE VISTA. Esconder no es seguridad: cada ruta
  // valida en servidor, tambien contra el rol de vista (ticket 028).
  const items = navParaRol(rol, programas);
  const deProgramas = items.filter((i) => i.icono === "programa");
  const deTrabajo = items.filter((i) => i.icono !== "programa");

  const grupo = (titulo: string, lista: ItemNav[]) =>
    lista.length === 0 ? null : (
      <div className="grid gap-0.5">
        <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {titulo}
        </p>
        {lista.map((item) => {
          const Icono = ICONOS[item.icono];
          const activo = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activo
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              {/* El punto verde marca DONDE estas: es el unico uso de la marca en el marco. */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-marca transition-opacity",
                  activo ? "opacity-100" : "opacity-0",
                )}
              />
              <Icono
                className={cn(
                  "size-4 shrink-0",
                  activo ? "text-marca" : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
                )}
              />
              <span className="truncate">{item.etiqueta}</span>
            </Link>
          );
        })}
      </div>
    );

  return (
    <aside
      data-zona="marco"
      className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Marca subtitulo="Gerencia comercial" />
        </Link>
        <ThemeToggle />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-3" aria-label="Principal">
        {grupo("Programas", deProgramas)}
        {grupo("Trabajo", deTrabajo)}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <UserMenu
          nombre={nombre}
          email={email}
          imagen={imagen}
          rol={rol}
          puedeCambiarVista={puedeCambiarVista}
          vista={vista}
        />
      </div>
    </aside>
  );
}
