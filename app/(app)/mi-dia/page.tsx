import { paginaConRol } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { MiDiaRegistro, type ContextoMiDia } from "@/components/mi-dia-registro";
import { programasGestionablesPorUsuario } from "@/lib/queries/programas";
import { productosActivos } from "@/lib/catalogo/productos";
import { motivos } from "@/lib/catalogo/motivos";
import { origenes } from "@/lib/catalogo/origenes";
import { plataformasDePago } from "@/lib/catalogo/plataformas";

export const dynamic = "force-dynamic";

/**
 * Pantalla `/mi-dia` del closer (ticket 003, ADR 0003, 0015, 0016, 0021).
 *
 * Guard de servidor primero: es del closer y el gerente NO entra (ADR 0003). Carga
 * en el servidor el contexto que la pantalla necesita —los programas donde el closer
 * vende, y por programa sus productos activos, mas los motivos, origenes y
 * plataformas ACTIVOS— y lo pasa por props al componente cliente. Solo se ofrecen
 * valores activos: es un criterio del "Done cuando". La UI no consulta ni calcula
 * nada; toda escritura pasa por las server actions, que revalidan rol y acceso.
 */
export default async function MiDiaPage() {
  const session = await paginaConRol("closer");

  const programasBase = await programasGestionablesPorUsuario(session.user.id, "closer", db);

  // Solo VALORES ACTIVOS: un producto, motivo, origen o plataforma desactivado no se
  // ofrece para un registro nuevo (criterio del "Done cuando").
  const programas: ContextoMiDia["programas"] = await Promise.all(
    programasBase.map(async (p) => {
      const items = await productosActivos(db, p.id);
      return {
        id: p.id,
        nombre: p.nombre,
        productos: items.map((i) => ({
          id: i.id,
          nombre: String(i.nombre),
          precioLista: String(i.precioLista),
          moneda: String(i.moneda),
        })),
      };
    }),
  );

  const [motivosActivos, origenesActivos, plataformasActivas] = await Promise.all([
    motivos(db).listar({ soloActivos: true }),
    origenes(db).listar({ soloActivos: true }),
    plataformasDePago(db).listar({ soloActivos: true }),
  ]);

  const contexto: ContextoMiDia = {
    programas,
    motivos: motivosActivos.map((m) => ({ id: m.id, nombre: String(m.nombre) })),
    origenes: origenesActivos.map((o) => ({ id: o.id, nombre: String(o.nombre) })),
    plataformas: plataformasActivas.map((p) => ({ id: p.id, nombre: String(p.nombre) })),
  };

  return (
    <PageShell
      titulo="Mi día"
      descripcion="Busca a la persona, registra el resultado de la llamada y, si cerró, la venta con su primer abono."
    >
      <MiDiaRegistro contexto={contexto} />
    </PageShell>
  );
}
