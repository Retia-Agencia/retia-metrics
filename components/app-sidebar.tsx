"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarCheck, Library, LineChart, Settings, Tag, Users } from "lucide-react";
import { navParaRol, type ItemNav } from "@/lib/nav";
import type { Rol } from "@/lib/auth/roles";
import type { Vista } from "@/lib/auth/vista";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
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

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Retia Metrics</span>
          <span className="text-xs text-muted-foreground">Gerencia comercial</span>
        </Link>
        <ThemeToggle />
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => {
          const Icono = ICONOS[item.icono];
          const activo = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                activo
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icono className="size-4" />
              {item.etiqueta}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-2">
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
