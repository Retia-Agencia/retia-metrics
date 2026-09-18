import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { paginaConSesion } from "@/lib/auth/page-guards";
import { esAccesoTotal } from "@/lib/auth/roles";
import { rolDeVista, vistaActual } from "@/lib/auth/vista";
import { programasActivos } from "@/lib/queries/programas";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await paginaConSesion();
  const programas = await programasActivos();

  // El nav y la etiqueta del menu se pintan con el ROL DE VISTA (ticket 028): un
  // developer en vista `closer` ve la nav de un closer. El selector de "ver como", en
  // cambio, se decide por el rol REAL de la sesion (`esAccesoTotal`): solo el developer
  // lo ve, y siempre —es la unica salida de la vista `closer`—.
  const rolVista = await rolDeVista(session);
  const puedeCambiarVista = esAccesoTotal(session.user.rol);
  const vista = await vistaActual();

  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar
        rol={rolVista}
        nombre={session.user.name ?? session.user.email ?? "Usuario"}
        email={session.user.email ?? ""}
        imagen={session.user.image}
        programas={programas}
        puedeCambiarVista={puedeCambiarVista}
        vista={vista}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
