import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { abonos, cohorts, dealLineas, deals, leads, programs, skus, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { recolgarAbonos } from "@/lib/deals/recolgar-abonos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db, cerrar: () => Promise<void>, vaciar: () => Promise<void>;
beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => vaciar());
afterAll(async () => cerrar());

it("reporta ambigüedad con dos líneas anuladas pagadas y dos vigentes del mismo SKU, y el flag desempata", async () => {
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "recolgado", nombre: "Recolgado", ticketUsd: "100" }).returning();
  const [actor] = await db.insert(users).values({ email: "recolgado@test.local", rol: "developer" }).returning();
  const [cohorte] = await db.insert(cohorts).values({ programId: programa.id, codigo: "C1", metaCupos: 10, precioUsd: "100" }).returning();
  const [sku] = await db.insert(skus).values({ programId: programa.id, nombre: "Virtual", slug: "virtual", cohortId: cohorte.id, codigo: "VIRTUAL-C1", precioListaUsd: "100" }).returning();
  const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: "recolgado@test.local", entrada: "crm", fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning();
  const [deal] = await db.insert(deals).values({ leadId: lead.id, programId: programa.id, etapa: "ganado_parcial", ownerUserId: actor.id }).returning();
  const ahora = new Date();
  const lineas = await db.insert(dealLineas).values([
    { dealId: deal.id, programId: programa.id, skuId: sku.id, precioListaUsd: "100", valorVendidoUsd: "100", anuladaEn: ahora, anuladaPor: actor.id },
    { dealId: deal.id, programId: programa.id, skuId: sku.id, precioListaUsd: "100", valorVendidoUsd: "100", anuladaEn: ahora, anuladaPor: actor.id },
    { dealId: deal.id, programId: programa.id, skuId: sku.id, precioListaUsd: "100", valorVendidoUsd: "100", asignadaEn: new Date("2026-11-19") },
    { dealId: deal.id, programId: programa.id, skuId: sku.id, precioListaUsd: "100", valorVendidoUsd: "100", asignadaEn: new Date("2026-11-20") },
  ]).returning();
  await db.insert(abonos).values(lineas.slice(0, 2).map((linea, i) => ({ dealId: deal.id, lineaId: linea.id, programId: programa.id, fecha: `2026-11-${18 + i}`, monto: "10", moneda: "USD" })));
  const simulacion = await recolgarAbonos(db);
  expect(simulacion).toHaveLength(2);
  expect(simulacion.every((fila) => fila.motivo === "ambiguo" && !fila.mover)).toBe(true);
  const desempate = await recolgarAbonos(db, { lineaVigenteMasAntigua: true });
  expect(desempate.every((fila) => fila.a === lineas[2].id && fila.mover)).toBe(true);
});
