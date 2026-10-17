import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  calls,
  cohorts,
  cuentasPublicitarias,
  deals,
  fotosPauta,
  gastoPauta,
  leads,
  objetivos,
  pautaObjetos,
  programs,
  sources,
  submissions,
  tasasCambio,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { costoPorAgenda, costoPorAgendaDeLosUltimosHabiles } from "@/lib/semaforo/costo-por-agenda";
import { semaforoDelPrograma } from "@/lib/semaforo/semaforo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let secuencia = 0;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  secuencia = 0;
});

afterAll(async () => cerrar());

async function crearPrograma(slug: string, opciones: { cohorte?: boolean; objetivo?: boolean } = {}) {
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug,
    nombre: slug,
    ticketUsd: "1000",
  }).returning();
  const [fuente] = await db.insert(sources).values({ programId: programa.id, nombre: "Formulario" }).returning();
  const [cuenta] = await db.insert(cuentasPublicitarias).values({
    idMeta: `cuenta-${slug}`,
    programId: programa.id,
    nombre: "Cuenta",
    moneda: "COP",
    zonaHoraria: "America/Bogota",
  }).returning();
  const [campana] = await db.insert(pautaObjetos).values({
    cuentaId: cuenta.id,
    programId: programa.id,
    idMeta: `campana-${slug}`,
    nivel: "campana",
    padreIdMeta: null,
    nombre: "Campaña",
    estado: "ACTIVE",
  }).returning();
  let cohortId: string | null = null;
  if (opciones.cohorte !== false) {
    const [cohorte] = await db.insert(cohorts).values({
      programId: programa.id,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-31",
      fechaInicioClases: "2026-11-01",
      estado: "activo",
    }).returning();
    cohortId = cohorte.id;
    if (opciones.objetivo !== false) {
      await db.insert(objetivos).values({
        cohortId,
        area: null,
        metrica: "costo_por_agenda",
        meta: "70000",
        aceptable: "93000",
        moneda: "COP",
      });
    }
  }
  return {
    programId: programa.id,
    fuenteId: fuente.id,
    cuentaId: cuenta.id,
    campanaId: campana.id,
    cohortId,
  };
}

async function crearAgenda(args: {
  programId: string;
  fuenteId: string;
  creadaEn: Date;
}): Promise<void> {
  secuencia += 1;
  const [lead] = await db.insert(leads).values({
    programId: args.programId,
    emailNormalizado: `agenda-${secuencia}@test.co`,
  }).returning();
  const [envio] = await db.insert(submissions).values({
    leadId: lead.id,
    sourceId: args.fuenteId,
    token: `token-${secuencia}`,
    utmSource: "facebook",
    utmMedium: "cpc",
    createdAt: args.creadaEn,
  }).returning();
  const [deal] = await db.insert(deals).values({
    leadId: lead.id,
    programId: args.programId,
    submissionOrigenId: envio.id,
  }).returning();
  await db.insert(calls).values({
    dealId: deal.id,
    programId: args.programId,
    resultado: "agendada",
    createdAt: args.creadaEn,
  });
}

async function foto(args: {
  programId: string;
  campanaId: string;
  dia: string;
  hora: string;
  gasto: number;
  agendasMeta?: number | null;
  tomadaEn?: Date;
}): Promise<void> {
  await db.insert(fotosPauta).values({
    programId: args.programId,
    campanaId: args.campanaId,
    fecha: args.dia,
    tomadaEn: args.tomadaEn ?? new Date(`${args.dia}T${args.hora}:00-05:00`),
    gasto: String(args.gasto),
    moneda: "COP",
    agendasMeta: args.agendasMeta === undefined ? 1 : args.agendasMeta,
  });
}

async function gastoCerrado(programId: string, dia: string, monto: number, agendasMeta = 1): Promise<void> {
  await db.insert(gastoPauta).values({
    programId,
    fecha: dia,
    monto: String(monto),
    moneda: "COP",
    origen: "manual",
    area: "paid",
    agendasMeta,
  });
}

describe("semáforo del programa", () => {
  it("desglosa el día por campaña con la misma conversión y los mismos totales", async () => {
    const p = await crearPrograma("campanas-dia");
    const [campanaUsd] = await db.insert(pautaObjetos).values({
      cuentaId: p.cuentaId,
      programId: p.programId,
      idMeta: "campana-usd-dia",
      nivel: "campana",
      padreIdMeta: null,
      nombre: "Campaña USD sin recortar",
      estado: "ACTIVE",
    }).returning();
    await db.insert(tasasCambio).values({
      vigenteDesde: "2026-10-16",
      vigenteHasta: "2026-10-16",
      pesosPorDolar: "4000",
      fuente: "prueba",
    });
    await db.insert(fotosPauta).values([
      {
        tomadaEn: new Date("2026-10-16T11:00:00-05:00"),
        fecha: "2026-10-16",
        programId: p.programId,
        campanaId: p.campanaId,
        gasto: "150000",
        moneda: "COP",
        agendasMeta: 3,
      },
      {
        tomadaEn: new Date("2026-10-16T11:00:00-05:00"),
        fecha: "2026-10-16",
        programId: p.programId,
        campanaId: campanaUsd.id,
        gasto: "25",
        moneda: "USD",
        agendasMeta: 2,
      },
    ]);
    await db.insert(gastoPauta).values({
      programId: p.programId,
      fecha: "2026-10-16",
      monto: "50000",
      moneda: "COP",
      agendasMeta: null,
      origen: "manual",
      area: "paid",
    });

    const resultado = await semaforoDelPrograma(db, {
      programId: p.programId,
      ahora: new Date("2026-10-16T11:05:00-05:00"),
      tipo: "dia",
    });

    expect(resultado.campanas.map((campana) => campana.nombre)).toEqual([
      "Campaña",
      "Campaña USD sin recortar",
    ]);
    expect(resultado.campanas.map((campana) => campana.gasto)).toEqual([150000, 100000]);
    expect(Math.abs(resultado.campanas.reduce((total, campana) => total + campana.gasto, 0) - resultado.gasto)).toBeLessThanOrEqual(1);
    expect(resultado.campanas.reduce((total, campana) => total + (campana.agendasMeta ?? 0), 0)).toBe(resultado.agendasMeta ?? 0);
  });

  it("desglosa el cierre por campaña y reúne en Sin campaña las filas sin árbol", async () => {
    const p = await crearPrograma("campanas-cierre");
    const [campanaUsd] = await db.insert(pautaObjetos).values({
      cuentaId: p.cuentaId,
      programId: p.programId,
      idMeta: "campana-usd-cierre",
      nivel: "campana",
      padreIdMeta: null,
      nombre: "Campaña USD",
      estado: "ACTIVE",
    }).returning();
    const crearAnuncio = async (campanaIdMeta: string, sufijo: string) => {
      const [conjunto] = await db.insert(pautaObjetos).values({
        cuentaId: p.cuentaId,
        programId: p.programId,
        idMeta: `conjunto-${sufijo}`,
        nivel: "conjunto" as const,
        padreIdMeta: campanaIdMeta,
        nombre: `Conjunto ${sufijo}`,
        estado: "ACTIVE",
      }).returning();
      const [anuncio] = await db.insert(pautaObjetos).values({
        cuentaId: p.cuentaId,
        programId: p.programId,
        idMeta: `anuncio-${sufijo}`,
        nivel: "anuncio" as const,
        padreIdMeta: conjunto.idMeta,
        nombre: `Anuncio ${sufijo}`,
        estado: "ACTIVE",
      }).returning();
      return anuncio.id;
    };
    const anuncioCop = await crearAnuncio("campana-campanas-cierre", "cop");
    const anuncioUsd = await crearAnuncio(campanaUsd.idMeta, "usd");
    await db.insert(tasasCambio).values({
      vigenteDesde: "2026-10-16",
      vigenteHasta: "2026-10-16",
      pesosPorDolar: "4000",
      fuente: "prueba",
    });
    await db.insert(gastoPauta).values([
      {
        programId: p.programId,
        fecha: "2026-10-16",
        monto: "150000",
        moneda: "COP",
        agendasMeta: 3,
        origen: "meta_api",
        pautaObjetoId: anuncioCop,
      },
      {
        programId: p.programId,
        fecha: "2026-10-16",
        monto: "25",
        moneda: "USD",
        agendasMeta: null,
        origen: "meta_api",
        pautaObjetoId: anuncioUsd,
      },
      {
        programId: p.programId,
        fecha: "2026-10-16",
        monto: "50000",
        moneda: "COP",
        agendasMeta: null,
        origen: "manual",
        area: "paid",
      },
    ]);

    const resultado = await semaforoDelPrograma(db, {
      programId: p.programId,
      ahora: new Date("2026-10-17T00:05:00-05:00"),
      tipo: "cierre",
    });

    expect(resultado.campanas.map((campana) => [campana.nombre, campana.gasto])).toEqual([
      ["Campaña", 150000],
      ["Campaña USD", 100000],
      ["Sin campaña", 50000],
    ]);
    expect(Math.abs(resultado.campanas.reduce((total, campana) => total + campana.gasto, 0) - resultado.gasto)).toBeLessThanOrEqual(1);
    expect(resultado.campanas.reduce((total, campana) => total + (campana.agendasMeta ?? 0), 0)).toBe(resultado.agendasMeta ?? 0);
  });

  it("un caso armado con gasto, fotos y agendas da el color de día y cierre", async () => {
    const p = await crearPrograma("armado");
    await foto({ ...p, dia: "2026-10-13", hora: "11:00", gasto: 100000 });
    await foto({ ...p, dia: "2026-10-14", hora: "11:00", gasto: 80000, agendasMeta: 2 });
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-13T10:00:00-05:00") });
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-14T10:00:00-05:00") });
    await foto({ ...p, dia: "2026-10-14", hora: "17:45", gasto: 80000 });
    await gastoCerrado(p.programId, "2026-10-14", 80000);
    await gastoCerrado(p.programId, "2026-10-13", 100000);

    const dia = await semaforoDelPrograma(db, {
      programId: p.programId, ahora: new Date("2026-10-14T11:00:00-05:00"), tipo: "dia",
    });
    const cierre = await semaforoDelPrograma(db, {
      programId: p.programId, ahora: new Date("2026-10-15T00:05:00-05:00"), tipo: "cierre",
    });

    expect(dia).toMatchObject({ color: "exito", gasto: 80000, agendasCrm: 1, costo: 40000, agendasMeta: 2 });
    expect(cierre).toMatchObject({
      color: "alerta",
      dia: "2026-10-14",
      gasto: 80000,
      agendasCrm: 1,
      costo: 80000,
      comparacion: { dia: "2026-10-13", gasto: 100000, etiqueta: "día anterior" },
    });
  });

  it("la trayectoria usa solo las horas configuradas hasta la hora actual", async () => {
    const p = await crearPrograma("trayectoria-configurada");
    for (const hora of [8, 11, 14, 17, 20]) {
      await foto({
        ...p,
        dia: "2026-10-14",
        hora: `${String(hora).padStart(2, "0")}:00`,
        gasto: hora * 1000,
      });
    }

    const resultado = await semaforoDelPrograma(db, {
      programId: p.programId,
      ahora: new Date("2026-10-14T20:00:00-05:00"),
      tipo: "dia",
      horas: [20, 8, 14, 11, 17, 20],
    });

    expect(resultado.trayectoria.map((punto) => punto.hora))
      .toEqual(["08:00", "11:00", "14:00", "17:00", "20:00"]);
  });

  it("el caso real del 16-oct a las 8 pinta rojo contra la meta aunque ayer no tuviera agendas", async () => {
    const p = await crearPrograma("caso-real");
    await foto({ ...p, dia: "2026-10-15", hora: "08:00", gasto: 100000, agendasMeta: 0 });
    await foto({ ...p, dia: "2026-10-16", hora: "08:00", gasto: 218653, agendasMeta: 1 });
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-16T07:30:00-05:00") });

    const dia = await semaforoDelPrograma(db, {
      programId: p.programId, ahora: new Date("2026-10-16T08:05:00-05:00"), tipo: "dia",
    });

    expect(dia).toMatchObject({
      color: "peligro",
      gasto: 218653,
      agendasMeta: 1,
      agendasCrm: 1,
      costo: 218653,
    });
  });

  it("sin agendas de Meta hoy cuenta 0 y pinta rojo si el programa ya tuvo agendas de Meta", async () => {
    const p = await crearPrograma("mide-agendas");
    await db.insert(gastoPauta).values({
      programId: p.programId,
      fecha: "2026-10-14",
      monto: "60000",
      moneda: "COP",
      origen: "meta_api",
      pautaObjetoId: p.campanaId,
      agendasMeta: 1,
    });
    await foto({ ...p, dia: "2026-10-16", hora: "11:00", gasto: 63902, agendasMeta: null });

    const dia = await semaforoDelPrograma(db, {
      programId: p.programId, ahora: new Date("2026-10-16T11:05:00-05:00"), tipo: "dia",
    });

    expect(dia).toMatchObject({ color: "peligro", motivo: null, agendasMeta: 0, costo: null, gasto: 63902 });
  });

  it("sin agendas de Meta nunca, el programa sigue sin dato porque no las mide", async () => {
    const p = await crearPrograma("no-mide-agendas");
    await foto({ ...p, dia: "2026-10-16", hora: "11:00", gasto: 63902, agendasMeta: null });

    const dia = await semaforoDelPrograma(db, {
      programId: p.programId, ahora: new Date("2026-10-16T11:05:00-05:00"), tipo: "dia",
    });

    expect(dia).toMatchObject({ color: "sin_dato", motivo: "sin_agendas_meta", agendasMeta: null });
  });

  it("sin cohorte o sin objetivo dice el motivo y nunca queda verde", async () => {
    const sinCohorte = await crearPrograma("sin-cohorte", { cohorte: false });
    const sinObjetivo = await crearPrograma("sin-objetivo", { objetivo: false });
    await foto({ ...sinCohorte, dia: "2026-10-14", hora: "17:45", gasto: 1000 });
    await foto({ ...sinObjetivo, dia: "2026-10-14", hora: "17:45", gasto: 1000 });
    const primero = await semaforoDelPrograma(db, {
      programId: sinCohorte.programId, ahora: new Date("2026-10-14T18:00:00-05:00"), tipo: "dia",
    });
    const segundo = await semaforoDelPrograma(db, {
      programId: sinObjetivo.programId, ahora: new Date("2026-10-14T18:00:00-05:00"), tipo: "dia",
    });
    expect(primero).toMatchObject({ color: "sin_dato", motivo: "sin_cohorte" });
    expect(segundo).toMatchObject({ color: "sin_dato", motivo: "sin_umbral" });
  });

  it("no cuenta agendas creadas después del instante consultado", async () => {
    const p = await crearPrograma("corte-hora");
    await foto({ ...p, dia: "2026-10-14", hora: "11:00", gasto: 100000 });
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-14T10:00:00-05:00") });
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-14T12:00:00-05:00") });
    const resultado = await costoPorAgenda(db, {
      programId: p.programId,
      dia: "2026-10-14",
      hasta: new Date("2026-10-14T11:00:00-05:00"),
    });
    expect(resultado).toMatchObject({ agendasCrm: 1, costo: 100000 });
  });

  it("cuenta sábado y domingo rojos y para en el primero que no es rojo", async () => {
    const p = await crearPrograma("racha");
    for (const dia of ["2026-10-18", "2026-10-17"]) {
      await gastoCerrado(p.programId, dia, 100000);
      await crearAgenda({ ...p, creadaEn: new Date(`${dia}T10:00:00-05:00`) });
    }
    await gastoCerrado(p.programId, "2026-10-16", 60000);
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-16T10:00:00-05:00") });
    const resultado = await semaforoDelPrograma(db, {
      programId: p.programId, ahora: new Date("2026-10-19T11:00:00-05:00"), tipo: "dia",
    });
    expect(resultado.racha).toEqual({ color: "peligro", dias: 2 });
  });

  it("la racha sigue el color del último día cerrado, también en verde, y hoy no cuenta", async () => {
    const p = await crearPrograma("racha-verde");
    for (const dia of ["2026-10-18", "2026-10-17"]) {
      await gastoCerrado(p.programId, dia, 60000);
      await crearAgenda({ ...p, creadaEn: new Date(`${dia}T10:00:00-05:00`) });
    }
    await gastoCerrado(p.programId, "2026-10-16", 100000);
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-16T10:00:00-05:00") });
    await gastoCerrado(p.programId, "2026-10-19", 100000);
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-19T10:00:00-05:00") });
    const resultado = await semaforoDelPrograma(db, {
      programId: p.programId, ahora: new Date("2026-10-19T11:00:00-05:00"), tipo: "dia",
    });
    expect(resultado.racha).toEqual({ color: "exito", dias: 2 });
  });

  it("una agenda de otro programa nunca cuenta", async () => {
    const propio = await crearPrograma("frontera-a");
    const ajeno = await crearPrograma("frontera-b");
    await foto({ ...propio, dia: "2026-10-14", hora: "17:45", gasto: 70000 });
    await crearAgenda({ ...propio, creadaEn: new Date("2026-10-14T10:00:00-05:00") });
    await crearAgenda({ ...ajeno, creadaEn: new Date("2026-10-14T10:00:00-05:00") });
    const resultado = await semaforoDelPrograma(db, {
      programId: propio.programId, ahora: new Date("2026-10-14T18:00:00-05:00"), tipo: "dia",
    });
    expect(resultado).toMatchObject({ agendasCrm: 1, costo: 70000 });
  });

  it("el valor de los últimos días hábiles deja fuera hoy y lo que queda antes de la ventana", async () => {
    const p = await crearPrograma("ventana");
    await gastoCerrado(p.programId, "2026-10-09", 999000);
    await gastoCerrado(p.programId, "2026-10-12", 60000);
    await gastoCerrado(p.programId, "2026-10-13", 90000);
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-12T10:00:00-05:00") });
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-13T10:00:00-05:00") });
    await crearAgenda({ ...p, creadaEn: new Date("2026-10-14T10:00:00-05:00") });
    const resultado = await costoPorAgendaDeLosUltimosHabiles(db, { programId: p.programId, hoy: "2026-10-14", dias: 2 });
    expect(resultado).toMatchObject({ gasto: 150000, agendasCrm: 2, costo: 75000 });
  });

  it("sin foto de ayer a esa hora deja la comparación en null", async () => {
    const p = await crearPrograma("sin-foto-ayer");
    await foto({ ...p, dia: "2026-10-16", hora: "08:00", gasto: 70000, agendasMeta: 1 });

    const resultado = await semaforoDelPrograma(db, {
      programId: p.programId, ahora: new Date("2026-10-16T08:05:00-05:00"), tipo: "dia",
    });

    expect(resultado.comparacion).toBeNull();
  });

  it("incluye una foto tomada 0,6 segundos después de las 20:00 en el punto de las 20", async () => {
    const p = await crearPrograma("gracia-foto");
    await foto({
      ...p,
      dia: "2026-10-16",
      hora: "20:00",
      gasto: 70000,
      agendasMeta: 1,
      tomadaEn: new Date("2026-10-16T20:00:00.600-05:00"),
    });

    const resultado = await semaforoDelPrograma(db, {
      programId: p.programId,
      ahora: new Date("2026-10-16T20:05:00-05:00"),
      tipo: "dia",
      horas: [20],
    });

    expect(resultado.trayectoria).toMatchObject([{ hora: "20:00", gasto: 70000 }]);
  });
});
