import type { UsuarioVista } from "@/components/usuarios-admin";
import type { Rol } from "@/lib/auth/roles";
import { programasVisibles } from "@/lib/auth/alcance";
import { listarUsuarios } from "@/lib/catalogo/usuarios";
import type { Db } from "@/lib/db/tipos";
import { fecha, fechaDeInstanteEnBogota, fechaHoraEnBogota } from "@/lib/format";
import { ETIQUETA_MCP_SCOPE } from "@/lib/mcp/token";
import { listarConexionesOauthDeUsuarios } from "@/lib/oauth/conexiones";

export async function cargarDatosDeUsuarios(db: Db, entrada: { userId: string; rol: Rol }) {
  const actor = { id: entrada.userId, rol: entrada.rol };
  const [usuarios, programas] = await Promise.all([
    listarUsuarios(db, actor),
    programasVisibles(entrada.userId, entrada.rol, db),
  ]);
  const conexiones = await listarConexionesOauthDeUsuarios(db, usuarios.map((usuario) => usuario.id));
  const conexionesPorUsuario = new Map<string, typeof conexiones>();
  for (const conexion of conexiones) {
    const lista = conexionesPorUsuario.get(conexion.userId) ?? [];
    lista.push(conexion);
    conexionesPorUsuario.set(conexion.userId, lista);
  }
  const vista: UsuarioVista[] = usuarios.map((usuario) => ({
    ...usuario,
    creadoEn: usuario.creadoEn.toISOString(),
    conexionesIa: (conexionesPorUsuario.get(usuario.id) ?? []).map((conexion) => ({
      id: conexion.id,
      clienteNombre: conexion.clienteNombre,
      scopeEtiqueta: ETIQUETA_MCP_SCOPE[conexion.scope],
      creado: fechaHoraEnBogota(conexion.creadoEn),
      ultimoUso: conexion.ultimoUsoEn ? fechaHoraEnBogota(conexion.ultimoUsoEn) : "—",
      vence: conexion.refreshVenceEn ? `Vence el ${fecha(fechaDeInstanteEnBogota(conexion.refreshVenceEn))}` : "Sin vencimiento",
    })),
  }));
  return { programas, vista };
}
