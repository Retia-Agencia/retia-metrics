import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calls, changeLog, dealActividades, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearConRastro } from "@/lib/crm/rastro";
import { abrirDeal, moverEtapa } from "@/lib/deals/mover-etapa";
import {
  filtroDeLaUrl,
  paginaDeBitacora,
  POR_PAGINA,
  TABLA_MOVIMIENTOS,
  USUARIO_SISTEMA,
  type EntradaBitacora,
} from "@/lib/queries/bitacora";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 076: la bitacora de Nerd Stats junta `change_log` y `deal_etapa_historial`, con
 * quien y cuando, sin duplicar el movimiento de etapa, y sin un dato personal.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let closerId: string;
let otroId: string;
let leadId: string;

const NOMBRE_LEAD = "Lead Secreto";
const CORREO_LEAD = "secreto@correo.co";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "A", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [c, o] = await db
    .insert(users)
    .values([
      { email: "ana@retia.co", rol: "closer", closerId: "Ana" },
      { email: "gerente@retia.co", rol: "gerente" },
    ])
    .returning();
  closerId = c.id;
  otroId = o.id;
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: CORREO_LEAD, nombre: NOMBRE_LEAD })
    .returning();
  leadId = l.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

const actor = () => ({ tipo: "usuario" as const, userId: closerId, rol: "closer" as const });

async function todas(filtro: Record<string, string> = {}): Promise<EntradaBitacora[]> {
  return (await paginaDeBitacora(filtroDeLaUrl(filtro), db)).entradas;
}

describe("paginaDeBitacora", () => {
  it("una escritura de la app y un movimiento de etapa salen juntos, con quien y cuando", async () => {
    const dealId = await abrirDeal(db, { leadId, programId, etapa: "en_gestion", actor: actor() });
    // Calificar pide un contacto con fecha y canal: se registra como lo haria la app.
    await crearConRastro(
      { db, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: closerId, etiqueta: "contacto" },
      { dealId, tipo: "contacto", canal: "whatsapp", userId: closerId, fecha: new Date() },
    );
    await moverEtapa(db, { dealId, a: "calificado", actor: actor() });
    await crearConRastro(
      { db, tabla: calls, nombreTabla: "calls", actorId: closerId, etiqueta: "llamada" },
      { programId, dealId, origen: "app" },
    );

    const entradas = await todas();
    const movimientos = entradas.filter((e) => e.tipo === "movimiento");
    // El nacimiento y el movimiento: los dos del historial.
    expect(movimientos.map((m) => (m.tipo === "movimiento" ? [m.de, m.a] : null))).toEqual([
      ["en_gestion", "calificado"],
      [null, "en_gestion"],
    ]);
    for (const e of entradas) {
      expect(e.quien).toBe("ana@retia.co");
      expect(e.cuando).toBeInstanceOf(Date);
    }
    // La llamada, la actividad y los campos del deal, de change_log.
    expect(entradas.some((e) => e.tipo === "cambio" && e.tabla === "deal_actividades")).toBe(true);
    expect(entradas.some((e) => e.tipo === "cambio" && e.tabla === "calls" && e.campo === "dealId")).toBe(true);
    expect(entradas.some((e) => e.tipo === "cambio" && e.tabla === "deals" && e.campo === "leadId")).toBe(true);
    // El registro de un deal lleva el programa para enlazar su ficha.
    expect(movimientos[0].programaSlug).toBe("programa-a");
  });

  it("el movimiento de etapa NO se duplica: deals.etapa y deals.pendiente de change_log no salen", async () => {
    await abrirDeal(db, { leadId, programId, etapa: "en_gestion", actor: actor() });
    // abrirDeal SI deja `etapa` en change_log (crearConRastro escribe todos los campos)...
    const crudas = await db.select().from(changeLog);
    expect(crudas.some((c) => c.tabla === "deals" && c.campo === "etapa")).toBe(true);
    // ...y la bitacora la cuenta una vez, desde el historial.
    const entradas = await todas();
    expect(entradas.filter((e) => e.tipo === "cambio" && e.tabla === "deals" && ["etapa", "pendiente"].includes(e.campo))).toEqual([]);
    expect(entradas.filter((e) => e.tipo === "movimiento")).toHaveLength(1);
    // Otra tabla con un campo llamado `etapa` no se toca.
    await db.insert(changeLog).values({ tabla: "cohorts", campo: "etapa", origen: "app" });
    expect((await todas()).some((e) => e.tipo === "cambio" && e.tabla === "cohorts")).toBe(true);
  });

  it("filtra por usuario, por el sistema, por tabla y por movimientos", async () => {
    await abrirDeal(db, { leadId, programId, etapa: "en_gestion", actor: actor() });
    await db.insert(changeLog).values([
      { tabla: "motivos", campo: "nombre", origen: "app", userId: otroId },
      { tabla: "leads", campo: "nombre", origen: "sync" },
    ]);

    const delOtro = await todas({ usuario: otroId });
    expect(delOtro.map((e) => (e.tipo === "cambio" ? e.tabla : "mov"))).toEqual(["motivos"]);

    const delSistema = await todas({ usuario: USUARIO_SISTEMA });
    expect(delSistema.map((e) => (e.tipo === "cambio" ? e.tabla : "mov"))).toEqual(["leads"]);

    const soloMotivos = await todas({ tabla: "motivos" });
    expect(soloMotivos).toHaveLength(1);

    const soloMovimientos = await todas({ tabla: TABLA_MOVIMIENTOS });
    expect(soloMovimientos.every((e) => e.tipo === "movimiento")).toBe(true);
    expect(soloMovimientos).toHaveLength(1);
  });

  it("filtra por rango de dias de Bogota, no de UTC", async () => {
    await db.insert(changeLog).values([
      // 1-oct 22:00 en Bogota = 2-oct 03:00 UTC: es del 1-oct.
      { tabla: "motivos", campo: "a", origen: "app", detectadoEn: new Date("2026-10-02T03:00:00Z") },
      { tabla: "motivos", campo: "b", origen: "app", detectadoEn: new Date("2026-10-02T15:00:00Z") },
    ]);
    const primero = await todas({ desde: "2026-10-01", hasta: "2026-10-01" });
    expect(primero.map((e) => (e.tipo === "cambio" ? e.campo : ""))).toEqual(["a"]);
    expect((await todas({ desde: "2026-10-02" })).map((e) => (e.tipo === "cambio" ? e.campo : ""))).toEqual(["b"]);
    expect((await todas({ hasta: "2026-10-01" })).map((e) => (e.tipo === "cambio" ? e.campo : ""))).toEqual(["a"]);
  });

  it("pagina los dos rastros mezclados, del mas nuevo al mas viejo", async () => {
    await db.insert(changeLog).values(
      Array.from({ length: POR_PAGINA + 5 }, (_, i) => ({
        tabla: "motivos",
        campo: `c${i}`,
        origen: "app" as const,
        detectadoEn: new Date(Date.UTC(2026, 8, 1, 0, i)),
      })),
    );
    const p1 = await paginaDeBitacora(filtroDeLaUrl({}), db);
    const p2 = await paginaDeBitacora(filtroDeLaUrl({ pagina: "2" }), db);
    expect(p1).toMatchObject({ total: POR_PAGINA + 5, paginas: 2 });
    expect(p1.entradas).toHaveLength(POR_PAGINA);
    expect(p2.entradas).toHaveLength(5);
    expect(p1.entradas[0].tipo === "cambio" && p1.entradas[0].campo).toBe(`c${POR_PAGINA + 4}`);
    const ultima = p2.entradas.at(-1);
    expect(ultima?.tipo === "cambio" ? ultima.campo : null).toBe("c0");
  });

  it("NUNCA devuelve el nombre ni el correo de un lead, aunque change_log los guarde", async () => {
    await abrirDeal(db, { leadId, programId, etapa: "en_gestion", actor: actor() });
    await db.insert(changeLog).values({
      tabla: "leads",
      registroId: leadId,
      etiqueta: NOMBRE_LEAD,
      campo: "nombre",
      valorNuevo: CORREO_LEAD,
      origen: "app",
    });
    const serializada = JSON.stringify(await todas());
    expect(serializada).not.toContain(NOMBRE_LEAD);
    expect(serializada).not.toContain(CORREO_LEAD);
  });
});

describe("filtroDeLaUrl", () => {
  it("descarta lo invalido en vez de adivinarlo", () => {
    expect(
      filtroDeLaUrl({ usuario: "no-es-uuid", tabla: "deals; drop", desde: "2026-13-40", hasta: "ayer", pagina: "-3" }),
    ).toEqual({ pagina: 1 });
  });

  it("toma el primer valor de un parametro repetido y acepta los validos", () => {
    expect(
      filtroDeLaUrl({ usuario: [USUARIO_SISTEMA, "x"], tabla: "deals", desde: "2026-09-01", hasta: "2026-09-30", pagina: "3" }),
    ).toEqual({ usuario: USUARIO_SISTEMA, tabla: "deals", desde: "2026-09-01", hasta: "2026-09-30", pagina: 3 });
  });
});
