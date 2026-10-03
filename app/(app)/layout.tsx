import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { BarraSuplantacion } from "@/components/barra-suplantacion";
import { paginaConSesion } from "@/lib/auth/page-guards";
import { requireSesionReal } from "@/lib/auth/guards";
import { esAccesoTotal, esAdministrador } from "@/lib/auth/roles";
import { rolDeVista, vistaActual } from "@/lib/auth/vista";
import { programasInactivosParaAdministrar, programasVisibles } from "@/lib/auth/alcance";
import { closersActivos } from "@/lib/catalogo/usuarios";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // La sesión EFECTIVA (ya suplantada si el developer está "viendo como"): con ella se
  // proyecta la nav y el alcance de los programas. La sesión REAL decide quién ve el
  // selector de vista y carga los closers que puede suplantar.
  const session = await paginaConSesion();
  const real = await requireSesionReal();

  // El nav y la etiqueta del menu se pintan con el ROL DE VISTA (ticket 028): un
  // developer en vista `closer` ve la nav de un closer. El selector de "ver como", en
  // cambio, se decide por el rol REAL de la sesion (`esAccesoTotal`): solo el developer
  // lo ve, y siempre —es la unica salida de la vista `closer`—.
  const rolVista = await rolDeVista(session);
  // La nav lista SOLO los programas que esta sesion ve (ADR 0048, ticket 094): un
  // closer no ve el link del otro programa en el sidebar. La misma funcion de alcance
  // que el dashboard y el selector, no `programasActivos`.
  const programas = await programasVisibles(session.user.id, rolVista);
  const inactivos = await programasInactivosParaAdministrar(rolVista);
  const puedeCrear = esAdministrador(rolVista);
  const puedeCambiarVista = esAccesoTotal(real.user.rol);
  const vista = await vistaActual();
  // Los closers que el developer puede suplantar (ticket 172). Solo se cargan si de
  // verdad puede cambiar de vista; para los demás, lista vacía.
  const closers = puedeCambiarVista ? await closersActivos() : [];

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <AppSidebar
        rol={rolVista}
        nombre={session.user.name ?? session.user.email ?? "Usuario"}
        email={session.user.email ?? ""}
        imagen={session.user.image}
        programas={programas}
        inactivos={inactivos}
        puedeCrear={puedeCrear}
        puedeCambiarVista={puedeCambiarVista}
        vista={vista}
        closers={closers}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {session.user.suplantadoPor ? (
          <BarraSuplantacion nombre={session.user.name ?? session.user.email ?? "este closer"} />
        ) : null}
        {children}
      </div>
    </div>
  );
}
