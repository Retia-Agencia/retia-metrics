import { paginaConRol } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { UsuariosAdmin, type UsuarioVista } from "@/components/usuarios-admin";
import { listarUsuarios } from "@/lib/catalogo/usuarios";
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
  const session = await paginaConRol("gerente");

  const [usuarios, programas] = await Promise.all([
    listarUsuarios(db),
    programasActivos(),
  ]);

  const vista: UsuarioVista[] = usuarios.map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    closerId: u.closerId,
    calendlyEmail: u.calendlyEmail,
    activo: u.activo,
    programas: u.programas,
  }));

  return (
    <PageShell
      titulo="Usuarios"
      descripcion="Quién puede entrar, con qué rol y en qué programas vende cada closer."
    >
      <UsuariosAdmin
        usuarios={vista}
        programas={programas}
        usuarioActualId={session.user.id}
      />
    </PageShell>
  );
}
