"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChartNoAxesColumn, Contact, GraduationCap, Inbox, KanbanSquare, Layers, Library, LineChart, Menu, Settings, Target, UserCircle, X } from "lucide-react";
import { navParaRol, programaDeRuta, type ItemNav } from "@/lib/nav";
import type { Rol } from "@/lib/auth/roles";
import type { Vista } from "@/lib/auth/vista";
import type { CloserActivo } from "@/lib/catalogo/usuarios";
import { cn } from "@/lib/utils";
import { Marca } from "@/components/marca";
import { ProgramSwitcher } from "@/components/program-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { elegirPrograma } from "@/lib/programa-preferido";

const ICONOS: Record<ItemNav["icono"], typeof LineChart> = {
  dashboard: LineChart,
  metas: Target,
  deals: KanbanSquare,
  inbox: Inbox,
  calls: ChartNoAxesColumn,
  recursos: Library,
  ajustes: Settings,
  miespacio: UserCircle,
  nerdstats: Activity,
  students: GraduationCap,
  leads: Contact,
  programa: Layers,
};

type Props = {
  /** El rol DE VISTA (ya proyectado): la nav se estrecha con el (ticket 028). */
  rol: Rol | null;
  nombre: string;
  email: string;
  imagen?: string | null;
  /** Los programas que ESTA sesion ve (ADR 0048), ya acotados en el servidor. */
  programas: readonly { slug: string; nombre: string }[];
  preferido: string | null;
  inactivos: readonly { slug: string; nombre: string }[];
  puedeCrear: boolean;
  /** Si el usuario REAL es developer: solo el ve el selector de "ver como". */
  puedeCambiarVista: boolean;
  /** La vista marcada hoy en la cookie. */
  vista: Vista;
  /** Las vistas del radio: llegan por props porque `lib/auth/vista` carga la base. */
  vistas: readonly Vista[];
  /** Los closers activos que el developer puede suplantar (ticket 172). */
  closers: readonly CloserActivo[];
};

/**
 * El MARCO de la app (sistema "Tinta", docs/structure.md §9): oscuro en los dos temas,
 * para que la navegacion se lea como el marco y el trabajo como la hoja. Declara
 * `data-zona="marco"`, que redefine los tokens (`app/globals.css`), asi que lo que viva
 * aqui dentro se ve bien sin estilos propios.
 *
 * Arriba, el selector de programa; abajo, una tab por objeto (ADR 0050, ticket 097). El
 * programa elegido sale de la URL (`/p/<programa>/...`), nunca de la sesion (ADR 0023);
 * fuera de una ruta de programa, las tabs abren el ultimo visible recordado o el primero.
 *
 * En celular el marco es un cajon: una barra arriba con el boton que lo abre. Queda
 * abierto solo en la ruta donde se abrio, asi que navegar lo cierra sin un efecto.
 */
export function AppSidebar({
  rol,
  nombre,
  email,
  imagen,
  programas,
  preferido,
  inactivos,
  puedeCrear,
  puedeCambiarVista,
  vista,
  vistas,
  closers,
}: Props) {
  const pathname = usePathname();
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;
  const cerrar = () => setAbiertoEn(null);

  // Un slug en la URL que no esta en la lista (inexistente o ajeno) no se elige: la
  // pagina ya responde 404 y el selector no tiene por que nombrarlo.
  const deLaRuta = programaDeRuta(pathname);
  // El layout NO se vuelve a renderizar en una navegacion del cliente, asi que `preferido`
  // (la cookie) se queda con el valor de la primera carga. El ultimo programa visto en la
  // ruta se recuerda aqui, para que ir a Ajustes no salte de vuelta al primero.
  const [recordado, setRecordado] = useState(preferido);
  if (deLaRuta && deLaRuta !== recordado && programas.some((p) => p.slug === deLaRuta)) {
    setRecordado(deLaRuta);
  }
  const respaldo = elegirPrograma(programas, recordado)?.slug ?? null;
  const programa = programas.find((p) => p.slug === deLaRuta)?.slug ?? respaldo;
  const actual =
    programas.find((p) => p.slug === deLaRuta)?.slug ??
    inactivos.find((p) => p.slug === deLaRuta)?.slug ??
    respaldo;

  // La lista viene filtrada por el ROL DE VISTA. Esconder no es seguridad: cada ruta
  // valida en servidor, tambien contra el rol de vista (ticket 028).
  const items = navParaRol(rol, programa);

  return (
    <>
      <div
        data-zona="marco"
        className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden"
      >
        <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Marca />
        </Link>
        <button
          type="button"
          onClick={() => setAbiertoEn(pathname)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="grid size-9 place-items-center rounded-lg text-sidebar-foreground transition-colors duration-150 outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {abierto ? (
        <div aria-hidden className="fixed inset-0 z-30 bg-velo md:hidden" onClick={cerrar} />
      ) : null}

      <aside
        data-zona="marco"
        onKeyDown={(e) => {
          if (e.key === "Escape") cerrar();
        }}
        className={cn(
          "top-0 h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:sticky md:flex",
          // Por debajo de los popups (z-50): el selector y el menu abren en un portal ENCIMA del cajon.
          abierto ? "fixed inset-y-0 left-0 z-40 flex shadow-flotante" : "hidden",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Marca subtitulo="Gerencia comercial" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {abierto ? (
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar menú"
                className="grid size-8 place-items-center rounded-lg text-sidebar-foreground transition-colors duration-150 outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {actual || puedeCrear ? (
          <div className="px-4 pb-2">
            <p className="pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Programa
            </p>
            <ProgramSwitcher
              programas={programas}
              inactivos={inactivos}
              puedeCrear={puedeCrear}
              actual={actual}
            />
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Principal">
          <div className="grid gap-0.5">
            {items.map((item) => {
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
                      ? "bg-marca-suave font-medium text-marca"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  {/* El fondo y la raya lila marcan DONDE estas. */}
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
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <UserMenu
            nombre={nombre}
            email={email}
            imagen={imagen}
            rol={rol}
            puedeCambiarVista={puedeCambiarVista}
            vista={vista}
            vistas={vistas}
            closers={closers}
          />
        </div>
      </aside>
    </>
  );
}
