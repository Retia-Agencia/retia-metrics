import { and, asc, eq, sql } from "drizzle-orm";
import { abonos, changeLog, cohorts, dealLineas, deals, productos, programs, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearConRastro, editarConRastro, type OrigenOperativo } from "@/lib/crm/rastro";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { ETAPAS_VENDIDAS, type EtapaDeal } from "./etapas";

type FilaDeal = typeof deals.$inferSelect;
type Actor = {
  actorId: string | null;
  etiqueta: string;
  origen?: OrigenOperativo;
  reversionId?: string;
};

/** Única definición de línea vendida (ADR 0137 puntos 7, 14 y 15). */
export function esLineaVendida(entrada: {
  etapa: EtapaDeal;
  cortesia: boolean;
  cuentaComoCupo: boolean;
  abonosVigentes: number;
  abonosVigentesDelDeal: number;
}): boolean {
  if (entrada.cortesia) return false;
  if (entrada.abonosVigentesDelDeal > 0) return entrada.abonosVigentes > 0;
  return entrada.cuentaComoCupo
    && (ETAPAS_VENDIDAS as readonly EtapaDeal[]).includes(entrada.etapa);
}

export async function skuConCupoDeCohorte(tx: Db, programId: string, cohortId: string) {
  const filas = await tx.select({ sku: skus })
    .from(skus)
    .where(and(
      eq(skus.programId, programId), eq(skus.cohortId, cohortId), eq(skus.activo, true),
      eq(skus.cuentaComoCupo, true),
    ));
  if (filas.length !== 1) {
    throw new ErrorDeApp(
      `La cohorte debe tener exactamente un SKU activo que cuente como cupo; tiene ${filas.length}.`,
      409,
    );
  }
  return filas[0].sku;
}

export async function lineaVigente(tx: Db, dealId: string, lineaId: string) {
  const [linea] = await tx.select().from(dealLineas)
    .where(and(eq(dealLineas.id, lineaId), eq(dealLineas.dealId, dealId), vigente(dealLineas)));
  if (!linea) throw new ErrorDeApp("La línea no existe, está anulada o no pertenece a este deal.", 400);
  return linea;
}

export async function lineaConCupoVigente(tx: Db, dealId: string) {
  const filas = await lineasConCupoVigentes(tx, dealId);
  return filas.length === 1 ? filas[0] : null;
}

export async function lineasConCupoVigentes(tx: Db, dealId: string) {
  const filas = await tx.select({ linea: dealLineas })
    .from(dealLineas)
    .innerJoin(skus, and(eq(skus.id, dealLineas.skuId), eq(skus.programId, dealLineas.programId)))
    .where(and(eq(dealLineas.dealId, dealId), vigente(dealLineas), eq(skus.activo, true), eq(skus.cuentaComoCupo, true)))
    .orderBy(asc(dealLineas.asignadaEn), asc(dealLineas.id));
  return filas.map((fila) => fila.linea);
}

async function escribirDerivados(tx: Db, dealId: string, actor: Actor): Promise<void> {
  // Un deal anulado también conserva sus derivados al día: anularlo anula sus abonos y eso recalcula.
  const [deal] = await tx.select().from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
  const filas = await tx.select({
    linea: dealLineas,
    cohortId: skus.cohortId,
    codigoSku: skus.codigo,
    codigoCohorte: cohorts.codigo,
    cuentaComoCupo: skus.cuentaComoCupo,
    abonosVigentes: sql<number>`count(${abonos.id})::int`,
  }).from(dealLineas)
    .innerJoin(skus, and(eq(skus.id, dealLineas.skuId), eq(skus.programId, dealLineas.programId)))
    .innerJoin(cohorts, and(eq(cohorts.id, skus.cohortId), eq(cohorts.programId, skus.programId)))
    .leftJoin(abonos, and(eq(abonos.lineaId, dealLineas.id), vigente(abonos)))
    .where(and(eq(dealLineas.dealId, dealId), vigente(dealLineas)))
    .groupBy(dealLineas.id, skus.cohortId, skus.cuentaComoCupo, skus.codigo, cohorts.codigo)
    .orderBy(asc(dealLineas.asignadaEn), asc(dealLineas.id));

  const abonosVigentesDelDeal = filas.reduce((total, fila) => total + Number(fila.abonosVigentes), 0);
  const vendidas = filas.filter((fila) => esLineaVendida({
    etapa: deal.etapa,
    cortesia: deal.cortesia,
    cuentaComoCupo: fila.cuentaComoCupo,
    abonosVigentes: Number(fila.abonosVigentes),
    abonosVigentesDelDeal,
  }));
  const porDesempate = (a: typeof filas[number], b: typeof filas[number]) => {
    const porFecha = a.linea.asignadaEn.getTime() - b.linea.asignadaEn.getTime();
    if (porFecha !== 0) return porFecha;
    const numero = (codigo: string) => Number(/^C(\d+)$/.exec(codigo)?.[1] ?? Number.MAX_SAFE_INTEGER);
    const porCohorte = numero(a.codigoCohorte) - numero(b.codigoCohorte);
    return porCohorte !== 0 ? porCohorte : a.codigoSku.localeCompare(b.codigoSku);
  };
  const cupos = filas.filter((f) => f.cuentaComoCupo).sort(porDesempate);
  vendidas.sort(porDesempate);
  const cohorte = vendidas.find((f) => f.cuentaComoCupo) ?? cupos[0];
  const cambios: Record<string, unknown> = {};
  if (!deal.cortesia) {
    cambios.valorVendidoUsd = vendidas.length === 0
      ? null
      : (vendidas.reduce((centavos, f) => centavos + Math.round(Number(f.linea.valorVendidoUsd) * 100), 0) / 100).toFixed(2);
  }
  // Un deal sin líneas de cupo conserva la cohorte (p. ej. próxima cohorte).
  if (cupos.length > 0) cambios.cohortId = cohorte!.cohortId;
  await editarConRastro(
    {
      db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.actorId,
      etiqueta: actor.etiqueta, origen: actor.origen ?? "app", reversionId: actor.reversionId,
    },
    dealId,
    cambios,
  );
}

export async function asignarLinea(tx: Db, entrada: {
  deal: FilaDeal; skuId: string; valorVendidoUsd?: number; asignadaEn?: Date;
} & Actor) {
  const [sku] = await tx.select().from(skus).where(and(
    eq(skus.id, entrada.skuId), eq(skus.programId, entrada.deal.programId), eq(skus.activo, true),
  ));
  if (!sku) throw new ErrorDeApp("El SKU no existe, está inactivo o pertenece a otro programa.", 409);
  const valor = entrada.valorVendidoUsd ?? Number(sku.precioListaUsd);
  if (!Number.isFinite(valor) || valor < 0) throw new ErrorDeApp("El valor vendido de la línea no es válido.", 422);
  const id = await crearConRastro(
    {
      db: tx, tabla: dealLineas, nombreTabla: "deal_lineas", actorId: entrada.actorId,
      etiqueta: entrada.etiqueta, origen: entrada.origen ?? "app", reversionId: entrada.reversionId,
    },
    {
      dealId: entrada.deal.id, programId: entrada.deal.programId, skuId: sku.id,
      precioListaUsd: sku.precioListaUsd, valorVendidoUsd: String(valor),
      asignadaPor: entrada.actorId, ...(entrada.asignadaEn ? { asignadaEn: entrada.asignadaEn } : {}),
    },
  );
  await escribirDerivados(tx, entrada.deal.id, entrada);
  return (await lineaVigente(tx, entrada.deal.id, id));
}

/** Asigna, en orden estable, todas las propuestas predeterminadas activas del programa. */
export async function asignarLineasPredeterminadas(tx: Db, entrada: { deal: FilaDeal } & Actor) {
  const filas = await tx.select({ sku: skus, codigoCohorte: cohorts.codigo })
    .from(skus)
    .innerJoin(cohorts, and(eq(cohorts.id, skus.cohortId), eq(cohorts.programId, skus.programId)))
    .where(and(eq(skus.programId, entrada.deal.programId), eq(skus.activo, true), eq(skus.predeterminado, true)))
    .orderBy(asc(skus.codigo));
  filas.sort((a, b) => {
    const numero = (codigo: string) => Number(/^C(\d+)$/.exec(codigo)?.[1] ?? Number.MAX_SAFE_INTEGER);
    return numero(a.codigoCohorte) - numero(b.codigoCohorte) || a.sku.codigo.localeCompare(b.sku.codigo);
  });
  const asignadas = [];
  for (const fila of filas) asignadas.push(await asignarLinea(tx, { ...entrada, skuId: fila.sku.id }));
  return asignadas;
}

export async function asegurarLineaConCupo(tx: Db, entrada: {
  deal: FilaDeal; cohortId: string; valorVendidoUsd?: number; asignadaEn?: Date;
} & Actor) {
  const [existente] = await tx.select({ linea: dealLineas }).from(dealLineas)
    .innerJoin(skus, and(eq(skus.id, dealLineas.skuId), eq(skus.programId, dealLineas.programId)))
    .where(and(
      eq(dealLineas.dealId, entrada.deal.id), vigente(dealLineas), eq(skus.activo, true),
      eq(skus.cuentaComoCupo, true), eq(skus.cohortId, entrada.cohortId),
    ))
    .orderBy(asc(dealLineas.asignadaEn), asc(dealLineas.id));
  if (existente) return existente.linea;
  const sku = await skuConCupoDeCohorte(tx, entrada.deal.programId, entrada.cohortId);
  return asignarLinea(tx, { ...entrada, skuId: sku.id });
}

/** Compatibilidad del corte 1: cada adicional nace en su propia línea sin clasificar. */
export async function crearLineaSinClasificar(tx: Db, entrada: {
  deal: FilaDeal; montoUsd: number; cohortId: string;
} & Actor) {
  if (!entrada.actorId) throw new Error("Crear el catálogo sin clasificar exige un actor.");
  let [producto] = await tx.select().from(productos).where(and(
    eq(productos.programId, entrada.deal.programId), eq(productos.slug, "sin_clasificar"),
  ));
  if (!producto) {
    const id = crypto.randomUUID();
    [producto] = await tx.insert(productos).values({
      id, programId: entrada.deal.programId, nombre: "Sin clasificar", slug: "sin_clasificar",
    }).onConflictDoNothing().returning();
    if (producto) {
      await tx.insert(changeLog).values(["programId", "nombre", "slug"].map((campo) => ({
        tabla: "productos", registroId: id, etiqueta: "Sin clasificar", campo,
        valorAnterior: null,
        valorNuevo: campo === "programId" ? entrada.deal.programId : campo === "nombre" ? "Sin clasificar" : "sin_clasificar",
        origen: entrada.origen ?? "app", userId: entrada.actorId,
      })));
    } else {
      [producto] = await tx.select().from(productos).where(and(
        eq(productos.programId, entrada.deal.programId), eq(productos.slug, "sin_clasificar"),
      ));
    }
  }
  if (!producto) throw new Error("No se pudo crear el producto sin clasificar.");

  let [sku] = await tx.select().from(skus).where(and(
    eq(skus.productoId, producto.id), eq(skus.cohortId, entrada.cohortId),
  ));
  if (!sku) {
    const [datos] = await tx.select({ slug: programs.slug, codigo: cohorts.codigo })
      .from(programs).innerJoin(cohorts, and(eq(cohorts.id, entrada.cohortId), eq(cohorts.programId, programs.id)))
      .where(eq(programs.id, entrada.deal.programId));
    if (!datos) throw new ErrorDeApp("La cohorte no existe o pertenece a otro programa.", 409);
    const codigo = `${datos.slug.replaceAll("-", "_")}_sin_clasificar_${datos.codigo.toLowerCase()}`;
    const id = crypto.randomUUID();
    [sku] = await tx.insert(skus).values({
      id, programId: entrada.deal.programId, nombre: producto.nombre, slug: producto.slug, productoId: producto.id,
      cohortId: entrada.cohortId, codigo, precioListaUsd: "0", cuentaComoCupo: false, comisionPorcentaje: "0",
    }).onConflictDoNothing().returning();
    if (sku) {
      const valores = { programId: entrada.deal.programId, nombre: producto.nombre, slug: producto.slug, productoId: producto.id, cohortId: entrada.cohortId, codigo, precioListaUsd: "0", cuentaComoCupo: "false", comisionPorcentaje: "0" };
      await tx.insert(changeLog).values(Object.entries(valores).map(([campo, valor]) => ({
        tabla: "skus", registroId: id, etiqueta: codigo, campo,
        valorAnterior: null, valorNuevo: valor, origen: entrada.origen ?? "app", userId: entrada.actorId,
      })));
    } else {
      [sku] = await tx.select().from(skus).where(and(
        eq(skus.productoId, producto.id), eq(skus.cohortId, entrada.cohortId),
      ));
    }
  }
  if (!sku) throw new Error("No se pudo crear el SKU sin clasificar.");
  return asignarLinea(tx, { ...entrada, skuId: sku.id, valorVendidoUsd: entrada.montoUsd });
}

export async function editarValorDeLinea(tx: Db, entrada: {
  deal: FilaDeal; lineaId: string; valorVendidoUsd: number;
} & Actor) {
  const linea = await lineaVigente(tx, entrada.deal.id, entrada.lineaId);
  if (!Number.isFinite(entrada.valorVendidoUsd) || entrada.valorVendidoUsd < 0) {
    throw new ErrorDeApp("El valor vendido de la línea no es válido.", 422);
  }
  await editarConRastro(
    {
      db: tx, tabla: dealLineas, nombreTabla: "deal_lineas", actorId: entrada.actorId,
      etiqueta: entrada.etiqueta, origen: entrada.origen ?? "app", reversionId: entrada.reversionId,
    },
    linea.id, { valorVendidoUsd: String(entrada.valorVendidoUsd) },
  );
  await escribirDerivados(tx, entrada.deal.id, entrada);
}

export async function cambiarSkuDeLineaConCupo(tx: Db, entrada: {
  deal: FilaDeal; cohortId: string;
} & Actor) {
  const linea = await lineaConCupoVigente(tx, entrada.deal.id);
  if (!linea) return asegurarLineaConCupo(tx, entrada);
  const [origen] = await tx.select({ productoId: skus.productoId }).from(skus).where(eq(skus.id, linea.skuId));
  const [mismoProducto] = origen?.productoId
    ? await tx.select({ sku: skus }).from(skus)
      .innerJoin(productos, and(eq(productos.id, skus.productoId), eq(productos.programId, skus.programId)))
      .where(and(
        eq(skus.programId, entrada.deal.programId), eq(skus.cohortId, entrada.cohortId),
        eq(skus.productoId, origen.productoId), eq(skus.activo, true),
        eq(productos.activo, true), eq(skus.cuentaComoCupo, true),
      ))
    : [];
  const sku = mismoProducto?.sku ?? await skuConCupoDeCohorte(tx, entrada.deal.programId, entrada.cohortId);
  await editarConRastro(
    {
      db: tx, tabla: dealLineas, nombreTabla: "deal_lineas", actorId: entrada.actorId,
      etiqueta: entrada.etiqueta, origen: entrada.origen ?? "app", reversionId: entrada.reversionId,
    },
    linea.id, { skuId: sku.id, precioListaUsd: sku.precioListaUsd },
  );
  await escribirDerivados(tx, entrada.deal.id, entrada);
  return { ...linea, skuId: sku.id, precioListaUsd: sku.precioListaUsd };
}

export async function anularLinea(tx: Db, entrada: { deal: FilaDeal; lineaId: string } & Actor) {
  if (!entrada.actorId) throw new Error("Anular una línea exige un actor.");
  const linea = await lineaVigente(tx, entrada.deal.id, entrada.lineaId);
  await editarConRastro(
    {
      db: tx, tabla: dealLineas, nombreTabla: "deal_lineas", actorId: entrada.actorId,
      etiqueta: entrada.etiqueta, origen: entrada.origen ?? "app", reversionId: entrada.reversionId,
    },
    linea.id, { anuladaEn: new Date(), anuladaPor: entrada.actorId },
  );
  await escribirDerivados(tx, entrada.deal.id, entrada);
  await recalcularEtapaTrasAnularAbono(tx, entrada.deal, entrada.origen ?? "app");
}

export async function quitarLinea(tx: Db, entrada: { deal: FilaDeal; lineaId: string } & Actor) {
  const { saldosDeLineas } = await import("@/lib/queries/saldo");
  const saldo = (await saldosDeLineas(tx, [entrada.deal.id])).get(entrada.lineaId);
  if (saldo && saldo.abonosVigentes > 0) {
    throw new ErrorDeApp("Una línea con abonos no se puede quitar; anúlala.", 409);
  }
  return anularLinea(tx, entrada);
}

export async function recalcularDealPorLineas(tx: Db, dealId: string, actor: Actor) {
  await escribirDerivados(tx, dealId, actor);
}

export async function estadoDePagoPorLineas(tx: Db, dealId: string): Promise<{
  saldo: number;
  vendidas: number;
  destino: Extract<EtapaDeal, "ganado_parcial" | "ganado_completo"> | null;
}> {
  const { saldosDeLineas } = await import("@/lib/queries/saldo");
  const saldos = [...(await saldosDeLineas(tx, [dealId])).values()].filter((linea) => linea.vendida);
  if (saldos.some((linea) => linea.saldo === null)) {
    throw new ErrorDeApp("No se puede calcular el saldo de las líneas: hay monedas distintas.", 409);
  }
  const saldo = Math.round(saldos.reduce((total, linea) => total + linea.saldo!, 0) * 100) / 100;
  return {
    saldo,
    vendidas: saldos.length,
    destino: saldos.length === 0 ? null : saldos.some((linea) => linea.saldo! > 0) ? "ganado_parcial" : "ganado_completo",
  };
}

/** Recalcula la reversión D15 después de anular, conservando A2 → A1 del motor. */
export async function recalcularEtapaTrasAnularAbono(
  tx: Db,
  deal: FilaDeal,
  origen: OrigenOperativo = "app",
): Promise<EtapaDeal> {
  if (deal.anuladoEn || deal.etapa === "cierre_perdido") return deal.etapa;
  const [conteo] = await tx.select({ total: sql<number>`count(*)::int` }).from(abonos)
    .where(and(eq(abonos.dealId, deal.id), vigente(abonos)));
  // La venta sin abono de D15 no debe ocultar A1 al anular el último pago.
  const destino = Number(conteo?.total ?? 0) === 0
    ? null
    : (await estadoDePagoPorLineas(tx, deal.id)).destino;
  const { etapaALaQueVuelve, moverEtapa } = await import("./mover-etapa");
  const sistema = { tipo: "sistema" } as const;
  let etapa: EtapaDeal = deal.etapa;
  if (destino === null) {
    if (etapa === "ganado_completo") {
      await moverEtapa(tx, { dealId: deal.id, a: "ganado_parcial", actor: sistema, origen });
      etapa = "ganado_parcial";
    }
    if (etapa === "ganado_parcial") {
      const previa = await etapaALaQueVuelve(tx, deal.id);
      await moverEtapa(tx, { dealId: deal.id, a: previa, actor: sistema, origen });
      etapa = previa;
    }
    await escribirDerivados(tx, deal.id, { actorId: null, etiqueta: deal.id, origen });
    return etapa;
  }
  if (etapa !== destino) {
    await moverEtapa(tx, { dealId: deal.id, a: destino, actor: sistema, origen });
    etapa = destino;
  }
  return etapa;
}
