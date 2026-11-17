import { paginaConAdministracionDeUsuarios } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { UsuariosAdmin } from "@/components/usuarios-admin";
import { administraGlobal, esAccesoTotal, esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { cargarDatosDeUsuarios } from "@/lib/ajustes/usuarios/cargar-datos";

export const dynamic = "force-dynamic";

/**
 * Pantalla de administracion de usuarios y closers (ticket 015, ADR 0012), solo
 * gerente. El guard corre primero: un closer nunca llega a leer la base.
 *
 * Los usuarios y los programas activos salen de la base; los checkboxes de programa
 * se arman con los programas activos, sin ningun literal en el codigo. Las
 * mutaciones viven en `./acciones.ts`.
 */
export default async function UsuariosPage() {
  const session = await paginaConAdministracionDeUsuarios();
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) return null;
  const puedeEditarAlcance = administraGlobal({
    rol,
    alcanceLimitado: session.user.alcanceLimitado,
  });

  const { vista, programas } = await cargarDatosDeUsuarios(db, { userId: session.user.id, rol });

  return (
    <PageShell
      titulo="Usuarios"
      descripcion="Quién puede entrar, con qué rol y en qué programas. La cuenta de Calendly de cada closer se vincula en la tab Programa."
      volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
      fija
    >
      <PantallaFija>
        <UsuariosAdmin
          usuarios={vista}
          usuarioActualId={session.user.id}
          programas={programas}
          puedeEditarAlcance={puedeEditarAlcance}
          alcanceLimitado={!puedeEditarAlcance}
          puedeCrearDeveloper={esAccesoTotal(rol)}
        />
      </PantallaFija>
    </PageShell>
  );
}
