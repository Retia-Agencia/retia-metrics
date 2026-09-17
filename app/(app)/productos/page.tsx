import { paginaConRol } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { ProductosAdmin, type ProgramaConProductos } from "@/components/productos-admin";
import { listarProductos } from "@/lib/catalogo/productos";
import { programasGestionablesPorUsuario } from "@/lib/queries/programas";

export const dynamic = "force-dynamic";

/**
 * Pantalla de productos por programa (ticket 017, ADR 0016).
 *
 * Abierta a gerentes y closers (unica config que un closer administra). El guard de
 * rol corre primero. Un gerente ve los productos de todos los programas activos; un
 * closer solo los de programas donde tiene membresia activa (se resuelve contra la
 * base, no en la UI). Cada escritura vuelve a validar rol y acceso en el servidor.
 */
export default async function ProductosPage() {
  const session = await paginaConRol("gerente", "closer");
  const rol = session.user.rol === "gerente" ? "gerente" : "closer";

  const programasBase = await programasGestionablesPorUsuario(session.user.id, rol, db);

  const programas: ProgramaConProductos[] = await Promise.all(
    programasBase.map(async (p) => {
      const items = await listarProductos(db, p.id);
      return {
        id: p.id,
        nombre: p.nombre,
        productos: items.map((i) => ({
          id: i.id,
          programId: String(i.programId),
          nombre: String(i.nombre),
          precioLista: String(i.precioLista),
          moneda: String(i.moneda),
          activo: i.activo,
        })),
      };
    }),
  );

  return (
    <PageShell
      titulo="Productos"
      descripcion="Lo que se vende dentro de cada programa, con su precio de lista y su moneda."
    >
      <ProductosAdmin programas={programas} />
    </PageShell>
  );
}
