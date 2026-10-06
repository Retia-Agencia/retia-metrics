import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calls, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { banderasDelPulso, ETAPAS_QUE_EXIGEN_VALOR } from "@/lib/queries/banderas-del-pulso";
import { listaDeMetrica, resumenDeMetrica } from "@/lib/queries/metricas-con-filas";
import { esAtendidaSinGrain } from "@/lib/queries/sin-grain";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 191: "atendido sin valor" y "atendido sin Grain" son una foto de hoy de los deals en
 * Atendido o más adelante. La cifra del Pulso y su lista tienen que dar lo mismo, con anulados,
 * cortesías, otro programa y el filtro de closer.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let ana: string;
let beto: string;
const ahora = new Date("2026-10-05T12:00:00-05:00");
const hoy = "2026-10-05";
// Un rango que no contiene ningún deal: las banderas no dependen del periodo.
const rango = { desde: "2020-01-01", hasta: "2020-01-31" };
let n = 0;

async function deal(datos: Partial<typeof deals.$inferInsert> & { programId?: string } = {}) {
  n += 1;
  const programa = datos.programId ?? programId;
  const [lead] = await db.insert(leads).values({ programId: programa, emailNormalizado: `l${n}@example.test` }).returning();
  const [fila] = await db.insert(deals).values({
    programId: programa,
    leadId: lead.id,
    ownerUserId: ana,
    etapa: "atendido",
    ...datos,
  }).returning();
  return fila;
}

async function llamada(dealId: string, datos: Partial<typeof calls.$inferInsert> = {}) {
  const [fila] = await db.insert(calls).values({
    programId,
    dealId,
    fechaAgenda: new Date("2026-09-15T10:00:00-05:00"),
    resultado: "show",
    origen: "app",
    ...datos,
  }).returning();
  return fila;
}

const anulado = () => ({ anuladoEn: ahora, anuladoPor: ana, motivoAnulacion: "Error de prueba" });

const esperado = { sinValor: new Set<string>(), sinGrain: new Set<string>(), atendidos: new Set<string>() };

beforeAll(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000" },
  ]).returning();
  [programId, otroProgramId] = programas.map((p) => p.id);
  [ana, beto] = (await db.insert(users).values([
    { email: "ana@example.test", rol: "closer", closerId: "Ana" },
    { email: "beto@example.test", rol: "closer", closerId: "Beto" },
  ]).returning()).map((u) => u.id);

  // Cuenta en las dos: ganado parcial, sin valor y con un show sin Grain.
  const ambas = await deal({ etapa: "ganado_parcial" });
  await llamada(ambas.id);
  // Sin valor (cero cuenta como sin valor) y con Grain.
  const soloValor = await deal({ etapa: "ganado_completo", valorVendidoUsd: "0" });
  await llamada(soloValor.id, { linkGrain: "https://grain.com/share/uno" });
  // Con valor y con un Grain en blanco: solo sin Grain. Es de Beto.
  const soloGrain = await deal({ etapa: "ganado_parcial", valorVendidoUsd: "800", ownerUserId: beto });
  await llamada(soloGrain.id, { resultado: "cerrada", linkGrain: "   " });
  // Atendido completo: con valor y con Grain. Entra al denominador y a ninguna bandera.
  const completo = await deal({ etapa: "ganado_completo", valorVendidoUsd: "1000" });
  await llamada(completo.id, { linkGrain: "https://grain.com/share/dos" });

  // Atendido y Compromiso verbal sin valor, con Grain: entran al denominador y a ninguna bandera,
  // porque el 128 no les exige el valor vendido (antes de ganar es 0 por defecto).
  const atendidoSinValor = await deal();
  await llamada(atendidoSinValor.id, { linkGrain: "https://grain.com/share/cuatro" });
  const verbalSinValor = await deal({ etapa: "compromiso_verbal", valorVendidoUsd: "0" });
  await llamada(verbalSinValor.id, { linkGrain: "https://grain.com/share/cinco" });

  esperado.atendidos = new Set([ambas.id, soloValor.id, soloGrain.id, completo.id, atendidoSinValor.id, verbalSinValor.id]);
  esperado.sinValor = new Set([ambas.id, soloValor.id]);
  esperado.sinGrain = new Set([ambas.id, soloGrain.id]);

  // Nada de esto cuenta:
  // un deal anulado, sin valor y con show sin Grain;
  const deAnulado = await deal(anulado());
  await llamada(deAnulado.id);
  // una cortesía (no lleva valor vendido);
  await deal({ etapa: "ganado_completo", cortesia: true });
  // un deal perdido y uno que todavía no llega a Atendido;
  await llamada((await deal({ etapa: "cierre_perdido" })).id);
  await llamada((await deal({ etapa: "agendado" })).id, { resultado: "agendada" });
  // un deal del otro programa;
  await deal({ programId: otroProgramId, etapa: "ganado_parcial" });
  // y la llamada sin Grain anulada no prende la bandera de un deal con valor.
  const conAnulada = await deal({ valorVendidoUsd: "500" });
  await llamada(conAnulada.id, anulado());
  await llamada(conAnulada.id, { linkGrain: "https://grain.com/share/tres" });
  esperado.atendidos.add(conAnulada.id);
});

afterAll(async () => cerrar());

const filtros = (claveCloser: string | null = null) => ({ programId, rango, hoy, ahora, claveCloser });

describe("banderas rojas del Pulso (191)", () => {
  it("cuenta atendidos, sin valor y sin Grain, con su %", async () => {
    expect(await banderasDelPulso({ programId }, db)).toEqual({
      atendidos: 7,
      sinValor: { cantidad: 2, pct: 2 / 7 },
      sinGrain: { cantidad: 2, pct: 2 / 7 },
    });
  });

  it.each([
    ["atendidos_sin_valor", "sinValor"],
    ["atendidos_sin_grain", "sinGrain"],
  ] as const)("la cifra de %s es su lista, deal por deal", async (metrica, campo) => {
    const cifra = (await banderasDelPulso({ programId }, db))[campo].cantidad;
    const [resumen] = await resumenDeMetrica(metrica, filtros(), db);
    const [lista] = await listaDeMetrica(metrica, filtros(), 1, db);
    expect(resumen.subtotal.cantidad).toBe(cifra);
    expect(new Set(lista.filas.map((f) => f.dealId))).toEqual(esperado[campo]);
  });

  it.each([
    ["atendidos_sin_valor", "sinValor"],
    ["atendidos_sin_grain", "sinGrain"],
  ] as const)("con closer, %s se acota al dueño del deal igual en la cifra y la lista", async (metrica, campo) => {
    for (const clave of [ana, beto]) {
      const cifra = (await banderasDelPulso({ programId, claveCloser: clave }, db))[campo].cantidad;
      const [lista] = await listaDeMetrica(metrica, filtros(clave), 1, db);
      expect(lista.subtotal.cantidad).toBe(cifra);
      expect(lista.filas).toHaveLength(cifra);
    }
    const deBeto = await banderasDelPulso({ programId, claveCloser: beto }, db);
    expect(deBeto).toEqual({ atendidos: 1, sinValor: { cantidad: 0, pct: 0 }, sinGrain: { cantidad: 1, pct: 1 } });
  });

  it("sin valor solo mira las etapas donde la ficha exige el valor vendido (128)", async () => {
    expect([...ETAPAS_QUE_EXIGEN_VALOR].sort()).toEqual(["ganado_completo", "ganado_parcial"]);
    const [lista] = await listaDeMetrica("atendidos_sin_valor", filtros(), 1, db);
    expect(lista.filas.every((f) => f.dealId !== null && esperado.sinValor.has(f.dealId))).toBe(true);
    expect(lista.filas).toHaveLength(esperado.sinValor.size);
  });

  it("sin Grain usa la regla de la ficha del deal (ADR 0066)", async () => {
    const filas = await db.select().from(calls);
    const conAlerta = new Set(filas.filter(esAtendidaSinGrain).map((c) => c.dealId));
    for (const id of esperado.sinGrain) expect(conAlerta.has(id)).toBe(true);
  });

  it("el otro programa tiene su propia foto", async () => {
    expect(await banderasDelPulso({ programId: otroProgramId }, db)).toEqual({
      atendidos: 1,
      sinValor: { cantidad: 1, pct: 1 },
      sinGrain: { cantidad: 0, pct: 0 },
    });
  });
});
