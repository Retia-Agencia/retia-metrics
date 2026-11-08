import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { sinResultadoDelRango } from "@/lib/queries/dashboard";
import { agrupar as agruparAgendas } from "@/lib/queries/hechos/agenda";
import { inboxDelPrograma } from "@/lib/queries/inbox";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { cargarEscalera, filtrarEscalera, resumirEscalera } from "@/lib/queries/escalera";
import { pautaInterina } from "@/lib/queries/pauta-interina";
import { armarVistaDeHoy } from "@/lib/queries/vista-hoy";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";

/**
 * Ticket 353 (ADR 0115 N2): el mismo set de citas, la misma cifra en Hoy, Pauta, el grupo del embudo y la
 * escalera; la reagenda cuenta como otra agenda (DA-4) en las pantallas que la usan; Inbox y bandera dan lo mismo
 * con el criterio declarado.
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => vaciar());
afterAll(async () => cerrar());

const DIA = "2026-10-14";
const ahora = new Date(`${DIA}T23:59:59.999-05:00`);
const a = (hora: string) => new Date(`${DIA}T${hora}-05:00`);

async function sembrar() {
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "paridad", nombre: "Paridad", ticketUsd: "100" }).returning();
  const programId = programa!.id;
  const nuevoDeal = async (correo: string, etapa: "agendado" | "atendido" | "ganado_completo") => {
    const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `${correo}@retia.co` }).returning();
    const [deal] = await db.insert(deals).values({ programId, leadId: lead!.id, etapa, ownerUserId: await duenoDePrueba(db, programId) }).returning();
    return deal!;
  };
  const creada = { createdAt: a("08:00:00") };
  // A: un show y un no show el mismo día (una persona, dos citas).
  const dealA = await nuevoDeal("a", "atendido");
  await db.insert(calls).values([
    { programId, dealId: dealA.id, fechaAgenda: a("09:00:00"), resultado: "show", ...creada },
    { programId, dealId: dealA.id, fechaAgenda: a("11:00:00"), resultado: "no_show", ...creada },
  ]);
  // B: cita pasada sin resultado, negocio abierto.
  const dealB = await nuevoDeal("b", "agendado");
  await db.insert(calls).values({ programId, dealId: dealB.id, fechaAgenda: a("10:00:00"), resultado: "agendada", ...creada });
  // C: cita pasada sin resultado, pero el negocio ya está cerrado.
  const dealC = await nuevoDeal("c", "ganado_completo");
  await db.insert(calls).values({ programId, dealId: dealC.id, fechaAgenda: a("10:30:00"), resultado: "agendada", ...creada });
  // D: reagendó: la cita vieja queda reagendada y se crea otra (futura, por venir).
  const dealD = await nuevoDeal("d", "agendado");
  await db.insert(calls).values([
    { programId, dealId: dealD.id, fechaAgenda: a("09:30:00"), resultado: "reagendada", ...creada },
    { programId, dealId: dealD.id, fechaAgenda: new Date("2026-10-20T10:00:00-05:00"), resultado: "agendada", createdAt: a("08:30:00") },
  ]);
  return { programId, dealA, dealB, dealC, dealD };
}

describe("353: el mismo set de citas da el mismo show en cada pantalla", () => {
  it("Hoy (por cita y por deal), Pauta, el grupo del embudo y la escalera coinciden", async () => {
    const { programId, dealA } = await sembrar();

    const { vista, showPorCita } = await armarVistaDeHoy({ programId, dia: DIA, ahora }, db);
    // Por cita: 1 realizada de las debidas (A show, A no show, B y C sin marcar; D reagendada también es debida y viva).
    expect(showPorCita.realizadas).toBe(1);
    // Por deal: A tuvo show → 1 de 1 con resultado; B, C y D no tienen resultado.
    expect(vista.embudo.grupo.conShow).toBe(1);
    expect(vista.embudo.pctShow).toBe(1);

    const pauta = await pautaInterina(db, programId, { desde: DIA, hasta: DIA }, {}, DIA, ahora);
    expect(pauta.resumen.shows).toBe(showPorCita.realizadas);
    expect(pauta.resumen.noShows).toBe(1);

    const escalera = await cargarEscalera(db, { programId, rango: { desde: "2000-01-01", hasta: "2099-12-31" } }, ahora);
    const fila = escalera.deals.find((d) => d.dealId === dealA.id)!;
    expect(fila.escalon).toBe("atendio_no_compro");
  });
});

describe("353 (DA-4): la agenda es la cita creada y la reagenda es otra cita", () => {
  it("Pauta y la agenda del CRM cuentan las dos citas del deal reagendado", async () => {
    const { programId } = await sembrar();
    // 6 citas creadas ese día: A2 + B1 + C1 + D2 (la nueva de D se creó el mismo día).
    const [agendas] = await agruparAgendas(db, { programId, rango: { desde: DIA, hasta: DIA }, agruparPor: [] });
    expect(agendas!.agendas).toBe(6);
    const pauta = await pautaInterina(db, programId, { desde: DIA, hasta: DIA }, {}, DIA, ahora);
    expect(pauta.resumen.agendas).toBe(agendas!.agendas);
  });
});

describe("353: la cita pasada sin resultado es una sola", () => {
  it("Inbox y bandera dan la misma cifra con el mismo criterio (excluyen cerrados; la bandera con todo el periodo)", async () => {
    const { programId, dealB, dealC } = await sembrar();
    const inbox = await inboxDelPrograma(db, programId, "equipo", DIA, ahora);
    const bandera = await sinResultadoDelRango({ programId, rango: { desde: DIA, hasta: DIA } }, ahora, db);
    // Solo B: C tiene el negocio cerrado y D está por venir.
    expect(inbox.llamadasDeHoy.map((f) => f.dealId)).toEqual([dealB.id]);
    expect(bandera).toBe(inbox.llamadasDeHoy.length);
    expect(inbox.llamadasDeHoy.map((f) => f.dealId)).not.toContain(dealC.id);
  });

  it("la escalera la cuenta aparte del escalón y su lista la abre", async () => {
    const { programId, dealB } = await sembrar();
    const cargada = await cargarEscalera(db, { programId, rango: { desde: "2000-01-01", hasta: "2099-12-31" } }, ahora);
    const b = cargada.deals.find((d) => d.dealId === dealB.id)!;
    expect(b.citaSinResultado).toBe(true);
    // El escalón no cambia: sigue donde la fórmula lo puso.
    expect(b.escalon).toBe("dejo_datos");
    const resumen = resumirEscalera(cargada.deals, cargada.corteDias);
    expect(resumen.citaSinResultado).toBe(filtrarEscalera(cargada, { citaSinResultado: true }).length);
    expect(resumen.citaSinResultado).toBeGreaterThanOrEqual(1);
    // La lista de la marca abre exactamente esos deals.
    const [lista] = await listaDeMetrica("escalera", {
      programId, rango: { desde: "2000-01-01", hasta: "2099-12-31" }, hoy: DIA, ahora, escalon: "cita_sin_resultado",
    }, 1, db);
    expect(lista!.filas.length).toBe(resumen.citaSinResultado);
  });
});
