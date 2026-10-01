import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { abonos, calls, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cajaRecaudada, embudoDelRango, leadsDelRango } from "@/lib/queries/dashboard";
import { desglosesDelResumen, listaDeMetrica, resumenDeMetrica, TAMANO_PAGINA, type Metrica, type FilaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { codigoDeCloser, vistaDeLista, urlDeLista } from "@/lib/queries/vista-metrica";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
const rango = { desde: "2026-06-01", hasta: "2026-10-02" };
const hoy = "2026-10-01";
const metricas: Metrica[] = ["caja", "agendas", "shows", "cierres", "leads"];

beforeAll(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "prueba-a", nombre: "A" },
    { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "prueba-b", nombre: "B" },
  ]).returning();
  [programaA, programaB] = programas.map((p) => p.id);
  const [owner] = await db.insert(users).values({ email: "test@example.test", rol: "closer", closerId: "Ana" }).returning();
  for (const programId of [programaA, programaB]) {
    for (let i = 0; i < 56; i += 1) {
      const anulada = i === 53;
      const fuera = i === 54;
      const manual = i === 55;
      const dia = fuera ? "2026-01-01" : ["2026-06-01", "2026-08-15", "2026-09-15", "2026-09-30", "2026-10-02"][i % 5];
      const fecha = new Date(`${dia}T23:30:00-05:00`);
      const [lead] = await db.insert(leads).values({
        programId,
        emailNormalizado: `lead-${i}@example.test`,
        entrada: manual ? "crm" : "formulario",
        fechaPrimeraAplicacion: fecha,
      }).returning();
      if (manual) continue;
      const [deal] = await db.insert(deals).values({
        programId,
        leadId: lead.id,
        ownerUserId: owner.id,
        etapa: "completo",
        anuladoEn: anulada ? fecha : null,
        anuladoPor: anulada ? owner.id : null,
        motivoAnulacion: anulada ? "Prueba de corrección" : null,
      }).returning();
      await db.insert(dealEtapaHistorial).values([
        { dealId: deal.id, a: "abonado", fecha },
        { dealId: deal.id, de: "abonado", a: "completo", fecha: new Date("2026-10-02T23:30:00-05:00") },
      ]);
      await db.insert(abonos).values({
        programId,
        dealId: deal.id,
        fecha: dia,
        monto: programId === programaA ? "10.25" : "30.50",
        moneda: i % 2 ? "USD" : "COP",
        closerId: i % 2 ? "Ana" : "  ANA  ",
        anuladoEn: anulada ? fecha : null,
        anuladoPor: anulada ? owner.id : null,
        motivoAnulacion: anulada ? "Prueba de corrección" : null,
      });
      await db.insert(calls).values({
        programId,
        dealId: i % 2 ? deal.id : null,
        fechaAgenda: i % 2 ? fecha : null,
        fechaLlamada: fecha,
        resultado: i % 3 && !anulada ? "agendada" : "show",
        closerId: i % 2 ? "Ana" : "  ANA  ",
        anuladoEn: anulada ? fecha : null,
        anuladoPor: anulada ? owner.id : null,
        motivoAnulacion: anulada ? "Prueba de corrección" : null,
      });
    }
  }
}, 60_000);

afterAll(async () => cerrar());

async function todas(metrica: Metrica, programId: string, closerId?: string) {
  const filas: FilaDeMetrica[] = [];
  let pagina = 1;
  let total = 0;
  do {
    const [seccion] = await listaDeMetrica(metrica, { programId, rango, hoy, closerId }, pagina, db);
    expect(seccion.filas.length).toBeLessThanOrEqual(TAMANO_PAGINA);
    total = seccion.subtotal.cantidad;
    filas.push(...seccion.filas);
    pagina += 1;
  } while (filas.length < total);
  expect(new Set(filas.map((f) => f.id)).size).toBe(total);
  return filas;
}

function suma(filas: FilaDeMetrica[]) {
  const resultado: Record<string, number> = {};
  for (const f of filas) {
    if (f.moneda && f.monto !== null) resultado[f.moneda] = (resultado[f.moneda] ?? 0) + f.monto;
  }
  return resultado;
}

async function cifra(metrica: Metrica, programId: string, closerId?: string) {
  const alcance = { programId, rango, closerId };
  if (metrica === "caja") return Object.fromEntries((await cajaRecaudada(alcance, db)).map((c) => [c.moneda, c.total]));
  if (metrica === "leads") return (await leadsDelRango(alcance, db)).leads;
  const embudo = await embudoDelRango(alcance, db);
  return metrica === "shows" ? embudo.llamadasConShow : embudo[metrica];
}

describe("137: la cifra, el resumen y todas las páginas cuentan exactamente lo mismo", () => {
  it.each(metricas)("%s conserva programa, fecha y vigencia", async (metrica) => {
    const filas = await todas(metrica, programaA);
    const [resumen] = await resumenDeMetrica(metrica, { programId: programaA, rango, hoy }, db);
    expect(metrica === "caja" ? suma(filas) : filas.length).toEqual(await cifra(metrica, programaA));
    expect(resumen.subtotal.cantidad).toBe(filas.length);
    expect(filas.length).toBe(metrica === "leads" ? 54 : metrica === "shows" ? 18 : 53);
    expect(resumen.grupos.reduce((n, g) => n + g.cantidad, 0)).toBe(filas.length);
    expect(filas.map((f) => f.fecha)).toEqual(filas.map((f) => f.fecha).sort());
    if (metrica === "caja") expect(Object.fromEntries(resumen.subtotal.caja.map((c) => [c.moneda, c.total]))).toEqual(suma(filas));
    if (metrica === "leads" || metrica === "agendas") expect(filas.some((f) => f.dealId === null)).toBe(true);
  });

  it.each(metricas)("%s secciona varios programas sin mezclar filas ni subtotales", async (metrica) => {
    const secciones = await listaDeMetrica(metrica, { programId: [programaA, programaB], rango, hoy }, 1, db);
    expect(secciones.map((s) => s.programId)).toEqual([programaA, programaB]);
    for (const s of secciones) {
      expect(metrica === "caja" ? Object.fromEntries(s.subtotal.caja.map((c) => [c.moneda, c.total])) : s.subtotal.cantidad).toEqual(await cifra(metrica, s.programId));
      const individuales = await todas(metrica, s.programId);
      expect(s.filas.map((f) => f.id)).toEqual(individuales.slice(0, TAMANO_PAGINA).map((f) => f.id));
    }
    expect(secciones[0].filas.some((f) => secciones[1].filas.some((otra) => otra.id === f.id))).toBe(false);
  });

  it("limita y pagina en el servidor con un total independiente de la página", async () => {
    const filtros = { programId: programaA, rango, hoy };
    const [primera] = await listaDeMetrica("agendas", filtros, 1, db);
    const [segunda] = await listaDeMetrica("agendas", filtros, 2, db);
    expect(primera.filas).toHaveLength(50);
    expect(segunda.filas).toHaveLength(3);
    expect(primera.subtotal.cantidad).toBe(53);
    expect(segunda.subtotal).toEqual(primera.subtotal);
  });

  it.each(["caja", "agendas", "shows", "cierres"] as const)("%s conserva la identidad normalizada del closer", async (metrica) => {
    const filas = await todas(metrica, programaA, "ana");
    expect(metrica === "caja" ? suma(filas) : filas.length).toEqual(await cifra(metrica, programaA, "ana"));
    expect(filas.length).toBeGreaterThan(0);
    expect(await todas(metrica, programaA, "Otro")).toEqual([]);
  });

  it("leads no inventa atribución por closer; un deal anulado no elimina al lead", async () => {
    const [resumen] = await resumenDeMetrica("leads", { programId: programaA, rango, hoy, closerId: "Ana" }, db);
    expect(resumen.disponible).toBe(false);
    expect(await cifra("leads", programaA, "Ana")).toBeNull();
    expect(await todas("leads", programaA, "Ana")).toEqual([]);
  });

  it("los cuatro buckets usan fecha de Bogotá y las agendas futuras tienen cero días", async () => {
    const filas = await todas("agendas", programaA);
    expect(new Set(filas.map((f) => f.bucket))).toEqual(new Set(["0-7", "8-30", "31-90", ">90"]));
    expect(filas.find((f) => f.fecha === "2026-10-02")?.antiguedad).toBe(0);
    expect(filas.find((f) => f.fecha === "2026-09-30")?.antiguedad).toBe(1);
  });

  it("la URL fija A y B, lleva código opaco y lo resuelve sin ensanchar filtros", async () => {
    const periodo = { preset: "custom" as const, a: rango, b: { desde: "2026-01-01", hasta: "2026-01-02" } };
    const href = urlDeLista("prueba-a", "caja", periodo, "Ana", "USD");
    expect(href).not.toContain("Ana");
    const busqueda = Object.fromEntries(new URL(href, "https://example.test").searchParams);
    expect(busqueda.closer).toBe(codigoDeCloser(" ANA "));
    const vista = await vistaDeLista({ programId: programaA, metrica: "caja", busqueda, hoy, codigoCloser: busqueda.closer, moneda: "USD", pagina: 1 }, db);
    expect(vista?.periodo).toMatchObject({ a: rango, b: periodo.b });
    expect(vista?.lista.filas.every((f) => f.moneda === "USD")).toBe(true);
    expect(await vistaDeLista({ programId: programaA, metrica: "caja", busqueda, hoy, codigoCloser: "a".repeat(64), pagina: 1 }, db)).toBeNull();
  });

  it.each(metricas)("%s: cada desglose del resumen (closer, etapa, antigüedad) suma el subtotal", async (metrica) => {
    const [resumen] = await resumenDeMetrica(metrica, { programId: programaA, rango, hoy }, db);
    const desgloses = desglosesDelResumen(resumen.grupos, (etapa) => etapa.toUpperCase());
    for (const lineas of [desgloses.porCloser, desgloses.porEtapa, desgloses.porAntiguedad]) {
      expect(lineas.reduce((n, l) => n + l.cantidad, 0)).toBe(resumen.subtotal.cantidad);
    }
    // "Ana" y "  ANA  " son el mismo closer (ADR 0030): una sola línea.
    expect(desgloses.porCloser.filter((l) => l.etiqueta.toLowerCase() === "ana").length).toBeLessThanOrEqual(1);
    expect(desgloses.porAntiguedad.map((l) => l.etiqueta)).toEqual(
      ["0-7", "8-30", "31-90", ">90"].filter((b) => desgloses.porAntiguedad.some((l) => l.etiqueta === b)),
    );
  });
});
