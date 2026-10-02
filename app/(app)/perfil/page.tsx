import { paginaConSesion } from "@/lib/auth/page-guards";
import { esAdministrador, trabajaLeads } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PerfilPropio } from "@/components/perfil-propio";
import { CalendlyMembresias } from "@/components/calendly-membresias";
import { membresiasConCalendlyDe, usuarioPorId } from "@/lib/catalogo/usuarios";
import { cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { programasActivos } from "@/lib/queries/programas";
import { asignarMiCalendlyAccion } from "./acciones";

export const dynamic = "force-dynamic";

/**
 * Perfil propio (ticket 031). Cualquier usuario con sesion ve aca su `closerId`; solo
 * quien `esAdministrador` (gerente o developer, ADR 0025) puede editarlo. El closer lo
 * ve en modo LECTURA, con la indicacion de a quien pedirlo.
 *
 * Esto NO reemplaza a `/ajustes/usuarios`: alla se administra a TERCEROS (y sigue
 * siendo solo de gerente). Aca uno solo toca su propia fila.
 *
 * `puedeEditar` se decide con el ROL DE VISTA (ticket 028), no con el rol crudo: un
 * developer en vista `closer` lo ve en lectura, como un closer. Esconder el input no
 * es seguridad — la server action reenforza `esAdministrador` en el servidor.
 */
export default async function PerfilPage() {
  const session = await paginaConSesion();
  const rol = await rolDeVista(session);
  const puedeEditar = esAdministrador(rol);

  const usuario = await usuarioPorId(session.user.id, db);
  const membresias = trabajaLeads(rol)
    ? await membresiasConCalendlyDe(db, session.user.id)
    : [];
  const programIds = membresias.map((m) => m.programId);
  const programas = trabajaLeads(rol)
    ? (await programasActivos()).filter((p) => programIds.includes(p.id))
    : [];
  const cuentas = trabajaLeads(rol) ? await cuentasPorPrograma(db, programIds) : {};

  return (
    <PageShell
      titulo="Mi perfil"
      descripcion="Tu identidad en la app y con qué closer_id se cruzan tus llamadas y ventas."
    >
      <PerfilPropio
        nombre={session.user.name ?? session.user.email ?? "Usuario"}
        email={session.user.email ?? ""}
        closerId={usuario?.closerId ?? null}
        puedeEditar={puedeEditar}
      />
      {membresias.length > 0 ? (
        <div className="mt-6">
          <CalendlyMembresias
            membresias={membresias}
            programas={programas}
            cuentas={cuentas}
            accion={asignarMiCalendlyAccion}
          />
        </div>
      ) : null}
    </PageShell>
  );
}
