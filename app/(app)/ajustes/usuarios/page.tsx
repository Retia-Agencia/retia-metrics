import { paginaConRol } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { UsuariosAdmin, type UsuarioVista } from "@/components/usuarios-admin";
import { CalendlyMembresias } from "@/components/calendly-membresias";
import { listarUsuarios, membresiasConCalendly } from "@/lib/catalogo/usuarios";
import { cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { trabajaLeads } from "@/lib/auth/roles";
import { programasActivos } from "@/lib/queries/programas";
import { asignarCalendlyDeMembresiaAccion } from "./acciones";

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

  const [usuarios, programas, todasLasMembresias] = await Promise.all([
    listarUsuarios(db),
    programasActivos(),
    membresiasConCalendly(db),
  ]);

  // La cuenta de Calendly es de quien trabaja leads (ticket 096). Las cuentas de cada
  // programa se leen de Calendly con su token, que nunca sale del servidor.
  const trabajan = new Set(usuarios.filter((u) => trabajaLeads(u.rol)).map((u) => u.id));
  const membresias = todasLasMembresias.filter((m) => trabajan.has(m.userId));
  const cuentas = await cuentasPorPrograma(db, [...new Set(membresias.map((m) => m.programId))]);

  const vista: UsuarioVista[] = usuarios.map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    closerId: u.closerId,
    calendlyEmail: u.calendlyEmail,
    activo: u.activo,
  }));

  return (
    <PageShell
      titulo="Usuarios"
      descripcion="Quién puede entrar y con qué rol. Las membresías se administran en la tab Programa."
    >
      <UsuariosAdmin
        usuarios={vista}
        usuarioActualId={session.user.id}
      />
      {membresias.length > 0 ? (
        <div className="mt-6">
          <CalendlyMembresias
            membresias={membresias}
            programas={programas}
            cuentas={cuentas}
            accion={asignarCalendlyDeMembresiaAccion}
          />
        </div>
      ) : null}
    </PageShell>
  );
}
