import { and, eq } from "drizzle-orm";
import { sinTildes } from "@/lib/busqueda-sin-tildes";
import { inArray } from "drizzle-orm";
import { cohorts, miembrosPrograma, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { duenosConDealsDelPrograma, type OpcionCatalogo } from "@/lib/queries/kanban";

export interface FiltroAplicado {
  campo: string;
  id: string | null;
  nombre: string;
  origen: "pedido" | "por_defecto";
  como_quitarlo?: string;
}

function resolverCatalogo(valor: string, opciones: readonly OpcionCatalogo[], tipo: string, programa: string): OpcionCatalogo {
  const porId = opciones.find((opcion) => opcion.id === valor);
  if (porId) return porId;
  const buscado = sinTildes(valor.trim());
  const exactos = opciones.filter((opcion) => sinTildes(opcion.nombre) === buscado);
  const candidatos = exactos.length > 0 ? exactos : opciones.filter((opcion) => sinTildes(opcion.nombre).includes(buscado));
  if (candidatos.length === 1) return candidatos[0];
  if (candidatos.length > 1) {
    throw new ErrorDeApp(`"${valor}" es ambiguo: ${candidatos.map((c) => `${c.nombre} (${c.id})`).join(", ")}. Usa el id.`, 422);
  }
  throw new ErrorDeApp(`No hay ningún ${tipo} "${valor}" en ${programa}. Opciones: ${opciones.map((o) => o.nombre).join(", ")}`, 422);
}

async function duenosPosiblesDelPrograma(db: Db, programId: string): Promise<OpcionCatalogo[]> {
  const [miembros, conDeals] = await Promise.all([
    db.selectDistinct({ id: users.id, nombre: users.nombre })
      .from(miembrosPrograma)
      .innerJoin(users, eq(users.id, miembrosPrograma.userId))
      .where(and(eq(miembrosPrograma.programId, programId), eq(miembrosPrograma.activo, true), eq(users.activo, true))),
    duenosConDealsDelPrograma(db, programId),
  ]);
  return [...new Map([...miembros, ...conDeals].map((fila) => [fila.id, {
    id: fila.id,
    nombre: fila.nombre ?? "Sin nombre",
  }])).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function resolverDueno(db: Db, programId: string, programaNombre: string, valor: string): Promise<FiltroAplicado> {
  const elegido = resolverCatalogo(valor, await duenosPosiblesDelPrograma(db, programId), "dueño", programaNombre);
  return { campo: "dueno", id: elegido.id, nombre: elegido.nombre, origen: "pedido" };
}

export async function resolverCohorte(db: Db, programId: string, programaNombre: string, valor: string): Promise<FiltroAplicado> {
  if (sinTildes(valor.trim()) === "todas") return { campo: "cohorte", id: null, nombre: "Todas", origen: "pedido" };
  const filas = await db.select({ id: cohorts.id, nombre: cohorts.codigo }).from(cohorts).where(eq(cohorts.programId, programId));
  const elegido = resolverCatalogo(valor, filas, "cohorte", programaNombre);
  return { campo: "cohorte", id: elegido.id, nombre: elegido.nombre, origen: "pedido" };
}

export async function nombresDeUsuariosYCohortes(db: Db, userIds: readonly string[], cohorteIds: readonly string[]) {
  const [usuarios, cohortes] = await Promise.all([
    userIds.length ? db.select({ id: users.id, nombre: users.nombre }).from(users).where(inArray(users.id, [...userIds])) : [],
    cohorteIds.length ? db.select({ id: cohorts.id, nombre: cohorts.codigo }).from(cohorts).where(inArray(cohorts.id, [...cohorteIds])) : [],
  ]);
  return {
    usuarios: new Map(usuarios.map((fila) => [fila.id, fila.nombre ?? "Sin nombre"])),
    cohortes: new Map(cohortes.map((fila) => [fila.id, fila.nombre])),
  };
}
