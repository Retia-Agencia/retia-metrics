import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cohorts, dealEtapaHistorial, dealLineas, deals, leads, programs, skus, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { pagosDeStudents } from "@/lib/queries/pagos-de-students";
import { abonoDePrueba } from "./helpers/catalogo-de-prueba";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 376 / 462 paso 4: Students agrupa por nombre de SKU (`app/(app)/p/[programa]/students/page.tsx`).
 * El grupo sale de `lineas` de `pagosDeStudents` (clave `skuSlug`): una persona con dos SKUs distintos aparece
 * en dos grupos, cada uno con lo pagado y el saldo de su línea; una línea o un abono anulado no cuentan.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let ownerUserId: string;
let skuVirtual: string;
let skuUnoAUno: string;
let skuIntensivo: string;
let n = 0;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "students-sku", nombre: "Students SKU" }).returning();
  programId = programa.id;
  [ownerUserId] = (await db.insert(users).values({ email: "students-sku@retia.test", rol: "closer", closerId: "Students Sku" }).returning()).map((u) => u.id);
  const [cohorte] = await db.insert(cohorts).values({ programId, codigo: "C3", metaCupos: 10, fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01" }).returning();
  const filas = await db.insert(skus).values([
    { programId, nombre: "Virtual", slug: "virtual", cohortId: cohorte.id, codigo: "VIRTUAL-C3", precioListaUsd: "1000", cuentaComoCupo: true, comisionPorcentaje: "10" },
    { programId, nombre: "Uno a uno", slug: "uno-a-uno", cohortId: cohorte.id, codigo: "UNO-C3", precioListaUsd: "200", comisionPorcentaje: "5" },
    { programId, nombre: "Intensivo", slug: "intensivo", cohortId: cohorte.id, codigo: "INT-C3", precioListaUsd: "300", comisionPorcentaje: "5" },
  ]).returning();
  [skuVirtual, skuUnoAUno, skuIntensivo] = filas.map((f) => f.id);
}, 60_000);

async function dealDeStudent() {
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `student-sku-${++n}@retia.test`, entrada: "crm" }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId, etapa: "ganado_parcial" }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial" });
  return deal.id;
}

async function linea(dealId: string, skuId: string, valor: string, anulada = false) {
  const [fila] = await db.insert(dealLineas).values({
    dealId, programId, skuId, precioListaUsd: valor, valorVendidoUsd: valor,
    ...(anulada ? { anuladaEn: new Date("2026-11-06T10:00:00-05:00"), anuladaPor: ownerUserId } : {}),
  }).returning();
  return fila.id;
}

const abono = (dealId: string, lineaId: string, monto: string, extra: Record<string, unknown> = {}) =>
  abonoDePrueba(db, { dealId, lineaId, programId, fecha: "2026-11-05", monto, comprobanteUrl: "https://drive.google.com/abono", ...extra });

/** La misma clave que la pantalla: un grupo por `skuSlug`. */
function gruposPorSku(lineas: Array<{ skuSlug: string }>) {
  return new Set(lineas.map((l) => l.skuSlug));
}

describe("Students agrupado por nombre de SKU (462 paso 4)", () => {
  it("una persona con dos SKUs distintos aparece en dos grupos con lo pagado y el saldo de cada línea", async () => {
    const dealId = await dealDeStudent();
    const virtual = await linea(dealId, skuVirtual, "1000");
    const unoAUno = await linea(dealId, skuUnoAUno, "200");
    await abono(dealId, virtual, "400");
    await abono(dealId, unoAUno, "200");

    const { lineas } = (await pagosDeStudents(db, programId, [dealId])).get(dealId)!;

    expect(gruposPorSku(lineas)).toEqual(new Set(["virtual", "uno-a-uno"]));
    const porSlug = new Map(lineas.map((l) => [l.skuSlug, l]));
    expect(porSlug.get("virtual")).toMatchObject({ skuNombre: "Virtual", valorVendidoUsd: 1000, abonadoUsd: 400, saldoUsd: 600 });
    expect(porSlug.get("uno-a-uno")).toMatchObject({ skuNombre: "Uno a uno", valorVendidoUsd: 200, abonadoUsd: 200, saldoUsd: 0 });
  });

  it("una línea anulada y un abono anulado no cuentan", async () => {
    const dealId = await dealDeStudent();
    const virtual = await linea(dealId, skuVirtual, "1000");
    const anulada = await linea(dealId, skuIntensivo, "300", true);
    await abono(dealId, virtual, "400");
    await abono(dealId, virtual, "100", { anuladoEn: new Date("2026-11-07T10:00:00-05:00"), anuladoPor: ownerUserId, motivoAnulacion: "Duplicado" });
    await abono(dealId, anulada, "300");

    const { lineas } = (await pagosDeStudents(db, programId, [dealId])).get(dealId)!;

    expect(gruposPorSku(lineas)).toEqual(new Set(["virtual"]));
    expect(lineas[0]).toMatchObject({ abonadoUsd: 400, saldoUsd: 600 });
  });
});
