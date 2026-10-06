import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { textoComisionPrograma } from "@/components/dashboard-programa";
import { editarPrograma } from "@/lib/catalogo/programas";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { esViolacionCheck } from "@/lib/db/errores";
import { hoyEnBogota } from "@/lib/format";
import {
  abonos,
  areas,
  changeLog,
  deals,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { comisionDeDeal } from "@/lib/queries/comision";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let gerente: string;
let closer: string;
let areaId: string;
let secuencia = 0;

// El dia real de Bogota y no una fecha fija: `moverEtapa` fecha la venta con `now()` en el historial, asi que
// una fecha escrita a mano saca la venta del rango "hoy" en cuanto pasa la medianoche (rojo el 2-oct).
const HOY = hoyEnBogota();
const sistema = { tipo: "sistema" } as const;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "1000.00" })
    .returning();
  programId = p.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  const [u] = await db
    .insert(users)
    .values({ email: "ana@retiagrowth.com", rol: "closer", closerId: "Ana" })
    .returning();
  closer = u.id;
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  areaId = area.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function dealAtendido(valorVendidoUsd: string | null = "1000") {
  const [lead] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: `lead-${++secuencia}@correo.co` })
    .returning();
  const [deal] = await db
    .insert(deals)
    .values({
      leadId: lead.id,
      programId,
      etapa: "atendido",
      ownerUserId: closer,
      areaDeclaradaId: areaId,
      valorVendidoUsd,
    })
    .returning();
  return deal.id;
}

async function vender(porcentaje: string | null, valor = "1000") {
  await db.update(programs).set({ comisionPorcentaje: porcentaje }).where(eq(programs.id, programId));
  const dealId = await dealAtendido(valor);
  await db
    .insert(abonos)
    .values({ dealId, programId, fecha: HOY, monto: "500", comprobanteUrl: "https://drive.google.com/abono" });
  await moverEtapa(db, { dealId, a: "ganado_parcial", actor: sistema });
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
  return deal;
}

const vista = () => armarVistaDelDashboard({ programId, hoy: HOY, preset: "hoy" }, db);

describe("comisionDeDeal", () => {
  it("calcula porcentaje y redondea a centavos; un dato ausente es null", () => {
    expect(comisionDeDeal("797", "10.04")).toBe(80.02);
    expect(comisionDeDeal("1500", "6.67")).toBe(100.05);
    expect(comisionDeDeal(null, "10")).toBeNull();
    expect(comisionDeDeal("1000", null)).toBeNull();
  });
});

describe("porcentaje congelado al vender", () => {
  it("una venta conserva el porcentaje anterior y una nueva toma el vigente", async () => {
    const primera = await vender("10.04");
    expect(primera.comisionPorcentaje).toBe("10.04");

    await db.update(programs).set({ comisionPorcentaje: "6.67" }).where(eq(programs.id, programId));
    const [sinCambiar] = await db.select().from(deals).where(eq(deals.id, primera.id));
    expect(sinCambiar.comisionPorcentaje).toBe("10.04");
    expect(comisionDeDeal(sinCambiar.valorVendidoUsd, sinCambiar.comisionPorcentaje)).toBe(100.4);

    const segunda = await vender("6.67");
    expect(segunda.comisionPorcentaje).toBe("6.67");
    expect((await vista()).comparativo[0]).toMatchObject({ cierres: 2, comisionUsd: 167.1, ventasSinComision: 0 });
  });

  it("salir de venta y volver no pisa el porcentaje congelado", async () => {
    const vendido = await vender("10.04");
    await db.update(programs).set({ comisionPorcentaje: "6.67" }).where(eq(programs.id, programId));
    await db
      .update(abonos)
      .set({ anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "corrección" })
      .where(eq(abonos.dealId, vendido.id));
    await moverEtapa(db, { dealId: vendido.id, a: "atendido", actor: sistema });
    await db
      .insert(abonos)
      .values({
        dealId: vendido.id,
        programId,
        fecha: HOY,
        monto: "500",
        comprobanteUrl: "https://drive.google.com/abono-nuevo",
      });
    await moverEtapa(db, { dealId: vendido.id, a: "ganado_parcial", actor: sistema });

    const [deVuelta] = await db.select().from(deals).where(eq(deals.id, vendido.id));
    expect(deVuelta.comisionPorcentaje).toBe("10.04");
  });

});

describe("comision del comparativo", () => {
  it("cuenta los mismos cierres, omite anulados y separa ventas incompletas", async () => {
    const completa = await vender("10");
    const sinPorcentaje = await vender(null);
    const anulada = await vender("10");
    await db
      .update(deals)
      .set({ anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "duplicado" })
      .where(eq(deals.id, anulada.id));

    const fila = (await vista()).comparativo[0];
    expect(fila).toMatchObject({ cierres: 2, comisionUsd: 100, ventasSinComision: 1 });
    expect(comisionDeDeal(completa.valorVendidoUsd, completa.comisionPorcentaje)).toBe(100);
    expect(sinPorcentaje.comisionPorcentaje).toBeNull();
  });

  it("sin porcentaje conserva null, marca la venta y muestra el texto del pie", async () => {
    const deal = await vender(null);
    const v = await vista();
    expect(deal.comisionPorcentaje).toBeNull();
    expect(v.comisionPorcentaje).toBeNull();
    expect(v.comparativo[0]).toMatchObject({ cierres: 1, comisionUsd: 0, ventasSinComision: 1 });
    expect(textoComisionPrograma(v.comisionPorcentaje)).toBe("Comisión: sin porcentaje cargado.");
  });

  it("un closer sin closer_id aparece por su users.id en caja y comisión", async () => {
    const venta = await vender("10");
    await db.update(users).set({ closerId: null }).where(eq(users.id, closer));
    await db
      .update(abonos)
      .set({ registradoPorUserId: closer, closerId: null })
      .where(eq(abonos.dealId, venta.id));

    const fila = (await vista()).comparativo.find((f) => f.closerId === "ana@retiagrowth.com");
    expect(fila).toMatchObject({
      caja: [{ moneda: "USD", total: 500 }],
      cierres: 1,
      comisionUsd: 100,
      ventasSinComision: 0,
    });
  });
});

describe("porcentaje editable del programa", () => {
  const entrada = (comisionPorcentaje: string) => ({
    nombre: "Programa A",
    slug: "programa-a",
    ticketUsd: "1000.00",
    comisionPorcentaje,
  });

  it("escribe change_log y convierte vacío en null", async () => {
    await editarPrograma(db, gerente, programId, entrada("10.04"));
    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, programId), eq(changeLog.campo, "comisionPorcentaje")));
    expect(rastro).toHaveLength(1);
    expect(rastro[0].userId).toBe(gerente);

    await editarPrograma(db, gerente, programId, entrada(""));
    const [programa] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(programa.comisionPorcentaje).toBeNull();
  });

  it("rechaza más de dos decimales, más de 100 y el CHECK rechaza negativos", async () => {
    await expect(editarPrograma(db, gerente, programId, entrada("10.041"))).rejects.toMatchObject({ status: 400 });
    await expect(editarPrograma(db, gerente, programId, entrada("100.01"))).rejects.toMatchObject({ status: 400 });
    const negativo = db.update(programs).set({ comisionPorcentaje: "-1" }).where(eq(programs.id, programId));
    await expect(negativo).rejects.toSatisfy(esViolacionCheck);
  });
});
