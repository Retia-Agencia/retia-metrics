import type { Db } from "@/lib/db/tipos";
import { rarezasDelPrograma } from "@/lib/migracion/rarezas";
import { elegirPrograma } from "@/lib/programa-preferido";
import { programasActivos } from "@/lib/queries/programas";

export async function cargarDatosDeMigracion(db: Db, entrada: { slugPedido?: string; tipoPedido?: string; programaPreferido?: string | null }) {
  const programas = await programasActivos(db);
  if (programas.length === 0) return { programas, programa: null, rarezas: null };
  const programa = programas.find((fila) => fila.slug === entrada.slugPedido) ?? elegirPrograma(programas, entrada.programaPreferido ?? null)!;
  const rarezas = await rarezasDelPrograma(programa.id, entrada.tipoPedido || null, db);
  return { programas, programa, rarezas };
}
