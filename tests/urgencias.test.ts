import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { areas, calls, canales, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  diaHabilAnterior,
  habilesPrevios,
  semaforoDelDia,
  urgenciasDelPrograma,
  type VistaUrgencias,
} from "@/lib/queries/urgencias";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 066: la réplica de `🚨 Urgencias`. Reagrupa la serie de Pauta (093) por el catálogo de
 * Canales (101) como el 088; aquí se prueba lo propio: el día hábil observado, la ventana del
 * promedio, el semáforo y que las DOS cubetas de huérfanos salgan siempre (corrección del 24-sep).
 */

describe("los días de Urgencias", () => {
  it("el día observado es el hábil anterior: un lunes mira el viernes", () => {
    expect(diaHabilAnterior("2026-09-14")).toBe("2026-09-11");
    expect(diaHabilAnterior("2026-09-16")).toBe("2026-09-15");
    // Un domingo también mira el viernes.
    expect(diaHabilAnterior("2026-09-13")).toBe("2026-09-11");
  });

  it("la ventana son los 7 hábiles previos, sin el día observado y sin fines de semana", () => {
    expect(habilesPrevios("2026-09-11", 7)).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
    ]);
  });
});

describe("semaforoDelDia", () => {
  it("en ruta desde el promedio, atento sobre el 75%, atrasado debajo", () => {
    expect(semaforoDelDia(10, 10)).toBe("exito");
    expect(semaforoDelDia(12, 10)).toBe("exito");
    expect(semaforoDelDia(8, 10)).toBe("alerta");
    expect(semaforoDelDia(7.5, 10)).toBe("alerta");
    expect(semaforoDelDia(7, 10)).toBe("peligro");
    expect(semaforoDelDia(0, 10)).toBe("peligro");
  });

  it("sin promedio no hay semáforo, ni aunque el día tenga agendas", () => {
    expect(semaforoDelDia(0, 0)).toBeNull();
    expect(semaforoDelDia(5, 0)).toBeNull();
  });
});

const HOY = "2026-09-14"; // lunes: observa el viernes 11
const DIA = "2026-09-11";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let fuente: string;
let fuenteOtro: string;
let userId: string;
let n = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p, q] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" },
    ])
    .returning();
  programId = p.id;
  otroProgramId = q.id;
  fuente = (await db.insert(sources).values({ programId, nombre: "Typeform" }).returning())[0].id;
  fuenteOtro = (await db.insert(sources).values({ programId: otroProgramId, nombre: "Typeform" }).returning())[0].id;
  userId = (await db.insert(users).values({ email: "g@retia.co", rol: "gerente" }).returning())[0].id;
  const [pauta, organico] = await db.insert(areas).values([{ nombre: "Pauta" }, { nombre: "Orgánico" }]).returning();
  await db.insert(canales).values([
    { nombre: "Meta", utmSource: "facebook", utmMedium: "cpc", areaId: pauta.id },
    // Un valor histórico de la hoja, con su regla en el catálogo (corrección del 24-sep).
    { nombre: "Instagram Rosario", utmSource: "instagram rosario", utmMedium: "linktree", areaId: organico.id },
  ]);
}, 60_000);

afterEach(async () => {
  await cerrar();
});

type Utm = [string | null, string | null, string | null];

async function envio(utm: Utm, dia: string, programa: "p" | "q" = "p") {
  const pid = programa === "q" ? otroProgramId : programId;
  const [l] = await db.insert(leads).values({ programId: pid, emailNormalizado: `l${++n}@correo.co` }).returning();
  const [e] = await db
    .insert(submissions)
    .values({
      leadId: l.id,
      sourceId: programa === "q" ? fuenteOtro : fuente,
      token: `t${n}`,
      esParcial: false,
      fechaEnvio: new Date(`${dia}T09:00:00-05:00`),
      utmSource: utm[0],
      utmMedium: utm[1],
      utmCampaign: utm[2],
    })
    .returning();
  return { leadId: l.id, envioId: e.id, programa: pid };
}

/** Un envío del día con su deal y una agenda creada ese día (a las 10pm: sigue siendo ese día en Bogotá). */
async function agenda(utm: Utm, dia: string, opciones: { programa?: "p" | "q"; anulada?: boolean } = {}) {
  const o = await envio(utm, dia, opciones.programa);
  const [d] = await db
    .insert(deals)
    .values({ leadId: o.leadId, programId: o.programa, etapa: "agendado", submissionOrigenId: o.envioId })
    .returning();
  await db.insert(calls).values({
    programId: o.programa,
    dealId: d.id,
    createdAt: new Date(`${dia}T22:00:00-05:00`),
    ...(opciones.anulada
      ? { anuladoEn: new Date(`${dia}T23:00:00-05:00`), anuladoPor: userId, motivoAnulacion: "prueba" }
      : {}),
  });
}

const fila = (v: VistaUrgencias, clave: string) => v.filas.find((f) => f.canal === clave || f.origen === clave);

describe("urgenciasDelPrograma", () => {
  it("desglosa el día por canal con su %, y las dos cubetas de huérfanos se ven", async () => {
    await agenda(["facebook", "cpc", "c1"], DIA);
    await agenda(["Facebook", "CPC", "c2"], DIA);
    await agenda(["instagram rosario", "linktree", null], DIA);
    await agenda([null, null, null], DIA); // sin UTM
    await agenda(["tiktok", "organic", "x"], DIA); // trae UTM y no casa: sin clasificar
    await envio(["facebook", "cpc", "c3"], DIA); // registro sin agenda

    const v = await urgenciasDelPrograma(db, programId, HOY);
    expect(v.dia).toBe(DIA);
    expect(v.agendas).toBe(5);
    expect(v.registros).toBe(6);
    expect(fila(v, "Meta")).toMatchObject({ agendas: 2, registros: 3, area: "Pauta" });
    expect(fila(v, "Instagram Rosario")).toMatchObject({ agendas: 1, area: "Orgánico" });
    expect(fila(v, "sin_utm")).toMatchObject({ agendas: 1, registros: 1 });
    expect(fila(v, "sin_clasificar")).toMatchObject({ agendas: 1, registros: 1 });
    // La suma de las filas es el total: el % del día suma 100.
    expect(v.filas.reduce((s, f) => s + f.agendas, 0)).toBe(v.agendas);
    // Los canales primero, por agendas; después los huérfanos en orden fijo.
    expect(v.filas.map((f) => f.canal ?? f.origen)).toEqual([
      "Meta",
      "Instagram Rosario",
      "sin_clasificar",
      "sin_utm",
      "sin_envio_origen",
    ]);
  });

  it("los huérfanos salen aunque estén en cero", async () => {
    await agenda(["facebook", "cpc", "c1"], DIA);
    const v = await urgenciasDelPrograma(db, programId, HOY);
    expect(fila(v, "sin_utm")).toMatchObject({ agendas: 0, registros: 0 });
    expect(fila(v, "sin_clasificar")).toMatchObject({ agendas: 0, registros: 0 });
  });

  it("el promedio es de los 7 hábiles previos: ni el fin de semana ni el día observado entran", async () => {
    for (const dia of ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"]) {
      await agenda(["facebook", "cpc", "c"], dia);
      await agenda(["facebook", "cpc", "c"], dia);
    }
    await agenda(["facebook", "cpc", "c"], "2026-09-05"); // sábado: fuera
    await agenda(["facebook", "cpc", "c"], "2026-09-01"); // antes de la ventana: fuera
    await agenda(["facebook", "cpc", "c"], DIA);

    const v = await urgenciasDelPrograma(db, programId, HOY);
    expect(v.promedioAgendas).toBe(2);
    expect(fila(v, "Meta")).toMatchObject({ agendas: 1, promedioAgendas: 2 });
    expect(v.semaforo).toBe("peligro");
  });

  it("un canal sin agendas en el día pero con promedio sale con su promedio", async () => {
    await agenda(["instagram rosario", "linktree", null], "2026-09-10");
    await agenda(["facebook", "cpc", "c"], DIA);
    const v = await urgenciasDelPrograma(db, programId, HOY);
    expect(fila(v, "Instagram Rosario")).toMatchObject({ agendas: 0, promedioAgendas: 1 / 7 });
    expect(v.semaforo).toBe("exito");
  });

  it("sin agendas previas no hay semáforo", async () => {
    await agenda(["facebook", "cpc", "c"], DIA);
    const v = await urgenciasDelPrograma(db, programId, HOY);
    expect(v.promedioAgendas).toBe(0);
    expect(v.semaforo).toBeNull();
  });

  it("no cuenta una agenda anulada ni una de otro programa", async () => {
    await agenda(["facebook", "cpc", "c"], DIA, { anulada: true });
    await agenda(["facebook", "cpc", "c"], DIA, { programa: "q" });
    const v = await urgenciasDelPrograma(db, programId, HOY);
    expect(v.agendas).toBe(0);
    expect(v.registros).toBe(1); // el envío del anulado sigue siendo un registro
    expect(fila(v, "Meta")).toMatchObject({ agendas: 0, registros: 1 });
  });
});
