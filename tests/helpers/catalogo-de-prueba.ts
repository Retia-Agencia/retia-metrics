import { and, asc, eq } from "drizzle-orm";
import { abonos, cohorts, deals, productos, programs, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { asegurarLineaConCupo, crearLineaSinClasificar, recalcularDealPorLineas } from "@/lib/deals/lineas";

type AbonoDePrueba = typeof abonos.$inferInsert;

async function cohorteParaDealSinCohorte(db: Db, programId: string) {
  const existentes = await db.select().from(cohorts)
    .where(eq(cohorts.programId, programId))
    .orderBy(asc(cohorts.fechaInicioVentas), asc(cohorts.id));
  if (existentes.length > 0) return existentes[0];

  const [programa] = await db.select({ ticketUsd: programs.ticketUsd }).from(programs)
    .where(eq(programs.id, programId));
  if (!programa) throw new Error(`No existe el programa de prueba ${programId}.`);
  const [creada] = await db.insert(cohorts).values({
    programId, codigo: "C0", metaCupos: 0, precioUsd: programa.ticketUsd ?? "0",
  }).returning();
  if (!creada) throw new Error("No se pudo crear la cohorte C0 de prueba.");
  return creada;
}

export async function skuVirtualDePrueba(db: Db, cohortId: string) {
  const [cohorte] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId));
  if (!cohorte) throw new Error(`No existe la cohorte de prueba ${cohortId}.`);

  let [producto] = await db.select().from(productos).where(and(
    eq(productos.programId, cohorte.programId), eq(productos.slug, "programa_virtual"),
  ));
  if (!producto) {
    [producto] = await db.insert(productos).values({
      programId: cohorte.programId, nombre: "Programa virtual",
      slug: "programa_virtual",
    }).onConflictDoNothing().returning();
    if (!producto) {
      [producto] = await db.select().from(productos).where(and(
        eq(productos.programId, cohorte.programId), eq(productos.slug, "programa_virtual"),
      ));
    }
  }
  if (!producto) throw new Error("No se pudo crear el producto virtual de prueba.");

  let [sku] = await db.select().from(skus).where(and(
    eq(skus.productoId, producto.id), eq(skus.cohortId, cohorte.id),
  ));
  if (!sku) {
    const [programa] = await db.select({ slug: programs.slug }).from(programs)
      .where(eq(programs.id, cohorte.programId));
    if (!programa) throw new Error("No existe el programa de la cohorte de prueba.");
    [sku] = await db.insert(skus).values({
      programId: cohorte.programId, productoId: producto.id, cohortId: cohorte.id,
      codigo: `${programa.slug.replaceAll("-", "_")}_programa_virtual_${cohorte.codigo.toLowerCase()}`,
      precioListaUsd: cohorte.precioUsd, cuentaComoCupo: true,
    }).onConflictDoNothing().returning();
    if (!sku) {
      [sku] = await db.select().from(skus).where(and(
        eq(skus.productoId, producto.id), eq(skus.cohortId, cohorte.id),
      ));
    }
  }
  if (!sku) throw new Error("No se pudo crear el SKU virtual de prueba.");
  return sku;
}

/** Completa el modelo B1 de un deal sembrado directamente como venta sin abono. */
export async function lineaConCupoDePrueba(db: Db, dealId: string) {
  return (db as { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> })
    .transaction(async (tx) => {
      const [deal] = await tx.select().from(deals).where(eq(deals.id, dealId));
      if (!deal) throw new Error(`No existe el deal de prueba ${dealId}.`);
      const cohorte = deal.cohortId
        ? (await tx.select().from(cohorts).where(eq(cohorts.id, deal.cohortId)))[0]
        : await cohorteParaDealSinCohorte(tx, deal.programId);
      if (!cohorte) throw new Error("No existe la cohorte del deal de prueba.");
      await skuVirtualDePrueba(tx, cohorte.id);
      return asegurarLineaConCupo(tx, {
        deal,
        cohortId: cohorte.id,
        valorVendidoUsd: Number(deal.valorVendidoUsd ?? cohorte.precioUsd),
        actorId: deal.ownerUserId,
        etiqueta: "Fixture de venta sin abono",
      });
    });
}

export async function abonoDePrueba(
  db: Db,
  valores: AbonoDePrueba | AbonoDePrueba[],
) {
  const entradas = Array.isArray(valores) ? valores : [valores];
  const insertados: Array<typeof abonos.$inferSelect> = [];
  for (const entrada of entradas) {
    const filas = await (db as { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> })
      .transaction(async (tx) => {
        if (entrada.lineaId) return tx.insert(abonos).values(entrada).returning();
        const [deal] = await tx.select().from(deals).where(eq(deals.id, entrada.dealId));
        if (!deal) throw new Error(`No existe el deal de prueba ${entrada.dealId}.`);
        const cohorteId = deal.cohortId
          ?? (await cohorteParaDealSinCohorte(tx, deal.programId)).id;
        const actorId = entrada.registradoPorUserId ?? deal.ownerUserId;
        const actor = { actorId, etiqueta: "Fixture de abono" };
        let linea;
        if ((entrada.concepto ?? "ticket") === "adicional") {
          linea = await crearLineaSinClasificar(tx, {
            deal, cohortId: cohorteId, montoUsd: Number(entrada.monto), ...actor,
          });
        } else {
          await skuVirtualDePrueba(tx, cohorteId);
          const [cohorte] = await tx.select().from(cohorts).where(eq(cohorts.id, cohorteId));
          if (!cohorte) throw new Error("No existe la cohorte del deal de prueba.");
          linea = await asegurarLineaConCupo(tx, {
            deal, cohortId: cohorteId,
            valorVendidoUsd: Number(deal.valorVendidoUsd ?? cohorte.precioUsd), ...actor,
          });
        }
        const insertados = await tx.insert(abonos).values({ ...entrada, lineaId: linea.id }).returning();
        await recalcularDealPorLineas(tx, deal.id, actor);
        return insertados;
      });
    insertados.push(...filas);
  }
  return insertados;
}
