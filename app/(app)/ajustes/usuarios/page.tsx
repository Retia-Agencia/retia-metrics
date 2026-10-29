import { paginaConAdministracionGlobal } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { UsuariosAdmin, type UsuarioVista } from "@/components/usuarios-admin";
import { listarUsuarios } from "@/lib/catalogo/usuarios";
import { esAccesoTotal } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { programasActivos } from "@/lib/queries/programas";

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
  const session = await paginaConAdministracionGlobal();
  const puedeEditarAlcance = esAccesoTotal(await rolDeVista(session));

  const [usuarios, programas] = await Promise.all([listarUsuarios(db), programasActivos()]);

  const vista: UsuarioVista[] = usuarios.map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    operaComoCloser: u.operaComoCloser,
    closerId: u.closerId,
    calendlyEmail: u.calendlyEmail,
    activo: u.activo,
    programas: u.programas,
    programasQueVe: u.programasQueVe,
    creadoEn: u.creadoEn.toISOString(),
  }));

  return (
    <PageShell
      titulo="Usuarios"
      descripcion="Quién puede entrar y con qué rol. Las membresías y las cuentas de Calendly se administran en la tab Programa."
      volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
      fija
    >
      <PantallaFija>
        <UsuariosAdmin
          usuarios={vista}
          usuarioActualId={session.user.id}
          programas={programas}
          puedeEditarAlcance={puedeEditarAlcance}
        />
      </PantallaFija>
    </PageShell>
  );
}
