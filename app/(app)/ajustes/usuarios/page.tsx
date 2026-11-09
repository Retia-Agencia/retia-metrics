import { paginaConAdministracionDeUsuarios } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { UsuariosAdmin, type UsuarioVista } from "@/components/usuarios-admin";
import { listarUsuarios } from "@/lib/catalogo/usuarios";
import { administraGlobal, esAccesoTotal, esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { programasVisibles } from "@/lib/auth/alcance";
import { listarConexionesOauthDeUsuarios } from "@/lib/oauth/conexiones";
import { ETIQUETA_MCP_SCOPE } from "@/lib/mcp/token";
import { fecha, fechaDeInstanteEnBogota, fechaHoraEnBogota } from "@/lib/format";

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
  const actor = { id: session.user.id, rol };
  const puedeEditarAlcance = administraGlobal({
    rol,
    alcanceLimitado: session.user.alcanceLimitado,
  });

  const [usuarios, programas] = await Promise.all([
    listarUsuarios(db, actor),
    programasVisibles(session.user.id, rol, db),
  ]);
  const conexiones = await listarConexionesOauthDeUsuarios(db, usuarios.map((usuario) => usuario.id));
  const conexionesPorUsuario = new Map<string, typeof conexiones>();
  for (const conexion of conexiones) {
    const lista = conexionesPorUsuario.get(conexion.userId) ?? [];
    lista.push(conexion);
    conexionesPorUsuario.set(conexion.userId, lista);
  }

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
    whatsapps: u.whatsapps,
    creadoEn: u.creadoEn.toISOString(),
    conexionesIa: (conexionesPorUsuario.get(u.id) ?? []).map((conexion) => ({
      id: conexion.id,
      clienteNombre: conexion.clienteNombre,
      scopeEtiqueta: ETIQUETA_MCP_SCOPE[conexion.scope],
      creado: fechaHoraEnBogota(conexion.creadoEn),
      ultimoUso: conexion.ultimoUsoEn ? fechaHoraEnBogota(conexion.ultimoUsoEn) : "—",
      vence: conexion.refreshVenceEn
        ? `Vence el ${fecha(fechaDeInstanteEnBogota(conexion.refreshVenceEn))}`
        : "Sin vencimiento",
    })),
  }));

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
