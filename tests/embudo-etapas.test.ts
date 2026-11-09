import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cohorts,
  deals,
  dealEtapaHistorial,
  leads,
  motivos,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import {
  calcularEmbudoEtapas,
  embudoPorEtapas,
  type DealParaEmbudo,
  type HistorialParaEmbudo,
} from "@/lib/queries/embudo-etapas";
import { idsDeLaCifra } from "@/lib/queries/embudo-con-filas";
import type { Rango } from "@/lib/queries/dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const rango: Rango = { desde: "2026-09-01", hasta: "2026-09-30" };
const ahora = new Date("2026-10-01T12:00:00Z");

function deal(
  id: string,
  etapa: EtapaDeal,
  createdAt = new Date("2026-09-01T12:00:00Z"),
  extra: Partial<DealParaEmbudo> = {},
): DealParaEmbudo {
  return {
    id,
    etapa,
    ownerUserId: null,
    ownerNombre: null,
    createdAt,
    precioUsd: null,
    motivoNombre: null,
    cortesia: false,
    ...extra,
  };
}

function movimiento(
  id: string,
  dealId: string,
  de: EtapaDeal | null,
  a: EtapaDeal,
  fecha: string,
): HistorialParaEmbudo {
  return { id, dealId, de, a, fecha: new Date(fecha) };
}

function calcular(filasDeal: DealParaEmbudo[], historial: HistorialParaEmbudo[] = []) {
  return calcularEmbudoEtapas({ deals: filasDeal, historial, idsCerrados: [], rango, ahora });
}

describe("calcularEmbudoEtapas", () => {
  it("suma todos los tramos, no parte por pendiente y excluye el tramo actualmente abierto", () => {
    const filasDeal = [
      deal("ida-vuelta", "atendido"),
      deal("actual", "agendado"),
    ];
    const historial = [
      movimiento("01", "ida-vuelta", null, "calificado", "2026-09-01T12:00:00Z"),
      movimiento("02", "ida-vuelta", "calificado", "agendado", "2026-09-02T12:00:00Z"),
      movimiento("03", "ida-vuelta", "agendado", "calificado", "2026-09-04T12:00:00Z"),
      // Solo cambia el pendiente: no cierra ni vuelve a abrir Calificado.
      movimiento("04", "ida-vuelta", "calificado", "calificado", "2026-09-05T12:00:00Z"),
      movimiento("05", "ida-vuelta", "calificado", "agendado", "2026-09-06T12:00:00Z"),
      movimiento("06", "ida-vuelta", "agendado", "atendido", "2026-09-09T12:00:00Z"),
      movimiento("07", "actual", null, "calificado", "2026-09-03T12:00:00Z"),
      movimiento("08", "actual", "calificado", "agendado", "2026-09-04T12:00:00Z"),
    ];

    const tiempos = calcular(filasDeal, historial).tiempoEnEtapa;
    expect(tiempos.find((fila) => fila.etapa === "calificado")).toMatchObject({
      deals: 2,
      promedioDias: 2,
      dealsConVariosTramos: 1,
      dealIds: ["ida-vuelta", "actual"],
    });
    expect(tiempos.find((fila) => fila.etapa === "agendado")).toMatchObject({
      deals: 1,
      promedioDias: 5,
      dealsConVariosTramos: 1,
      dealIds: ["ida-vuelta"],
    });
  });

  it("usa la puerta en Bogota, distingue no calificados y acredita etapas saltadas", () => {
    const filasDeal = [
      deal("registrado", "agendado"),
      deal("calificado", "agendado"),
      deal("fuera", "agendado"),
    ];
    const historial = [
      // 29-sep 22:00 en Bogota: pertenece al rango y no al 30 por la fecha UTC.
      movimiento("01", "registrado", null, "registrado", "2026-09-30T03:00:00Z"),
      movimiento("02", "registrado", "registrado", "agendado", "2026-09-30T04:00:00Z"),
      movimiento("03", "calificado", null, "calificado", "2026-09-29T12:00:00Z"),
      movimiento("04", "calificado", "calificado", "agendado", "2026-09-29T13:00:00Z"),
      movimiento("05", "fuera", null, "registrado", "2026-10-01T05:00:00Z"),
    ];

    const conversion = calcularEmbudoEtapas({
      deals: filasDeal,
      historial,
      idsCerrados: [],
      rango: { desde: "2026-09-29", hasta: "2026-09-29" },
      ahora,
    }).conversion;
    expect(conversion.todas).toMatchObject({ entraron: 2, dealIds: ["registrado", "calificado"] });
    expect(conversion.sinNoCalificados).toMatchObject({ entraron: 1, dealIds: ["calificado"] });
    for (const paso of ["en_gestion", "contactado", "calificado", "agendado"] as const) {
      expect(conversion.todas.pasos.find((fila) => fila.paso === paso)).toMatchObject({
        llegaron: 2,
        dealIds: ["registrado", "calificado"],
      });
    }
    expect(conversion.porPuerta).toEqual([
      { puerta: "registrado", deals: 1, dealIds: ["registrado"] },
      { puerta: "calificado", deals: 1, dealIds: ["calificado"] },
    ]);
  });

  it("devuelve tasas nulas cuando el denominador es cero", () => {
    const lectura = calcular([]).conversion.todas;
    expect(lectura.entraron).toBe(0);
    expect(lectura.pasos.every((paso) => paso.tasaDesdeAnterior === null && paso.tasaDesdeEntrada === null)).toBe(true);
  });

  it("separa quienes avanzan, siguen y se pierden, y conserva la suma de cada paso", () => {
    const filas = [deal("avanza", "atendido"), deal("sigue", "agendado"), deal("pierde", "cierre_perdido")];
    const historial = [
      movimiento("01", "avanza", null, "agendado", "2026-09-02T12:00:00Z"),
      movimiento("02", "avanza", "agendado", "atendido", "2026-09-03T12:00:00Z"),
      movimiento("03", "sigue", null, "agendado", "2026-09-02T12:00:00Z"),
      movimiento("04", "pierde", null, "agendado", "2026-09-02T12:00:00Z"),
      movimiento("05", "pierde", "agendado", "cierre_perdido", "2026-09-03T12:00:00Z"),
    ];
    const pasos = calcular(filas, historial).conversion.todas.pasos;
    const agendado = pasos.find((paso) => paso.paso === "agendado")!;
    expect(agendado).toMatchObject({ pasaron: 1, siguenAqui: 1, perdidosAqui: 1, otros: 0 });
    expect(agendado.pasaronDealIds).toEqual(["avanza"]);
    expect(agendado.siguenAquiDealIds).toEqual(["sigue"]);
    expect(agendado.perdidosAquiDealIds).toEqual(["pierde"]);
    for (const paso of pasos) expect(paso.pasaron + paso.siguenAqui + paso.perdidosAqui + paso.otros).toBe(paso.llegaron);
  });

  it("separa setter y llamada sin dejar deals fuera de pasaron, siguen o perdidos", () => {
    const filas = [deal("avanza", "atendido"), deal("sigue", "agendado"), deal("pierde", "cierre_perdido")];
    const historial = [
      movimiento("01", "avanza", null, "en_gestion", "2026-09-01T12:00:00Z"),
      movimiento("02", "avanza", "en_gestion", "agendado", "2026-09-02T12:00:00Z"),
      movimiento("03", "avanza", "agendado", "atendido", "2026-09-03T12:00:00Z"),
      movimiento("04", "sigue", null, "agendado", "2026-09-02T12:00:00Z"),
      movimiento("05", "pierde", null, "agendado", "2026-09-02T12:00:00Z"),
      movimiento("06", "pierde", "agendado", "cierre_perdido", "2026-09-03T12:00:00Z"),
    ];
    const caminos = calcular(filas, historial).conversion.porCamino;
    expect(caminos.map((camino) => camino.camino)).toEqual(["setter", "llamada"]);
    for (const camino of caminos) {
      for (const paso of camino.pasos) {
        expect(paso.pasaron + paso.siguenAqui + paso.perdidosAqui).toBe(paso.llegaron);
      }
    }
  });

  it("la lista de cada tramo (pasaron, siguen, perdidos) tiene exactamente los deals que cuenta la barra", () => {
    const filas = [deal("avanza", "atendido"), deal("sigue", "agendado"), deal("pierde", "cierre_perdido")];
    const historial = [
      movimiento("01", "avanza", null, "en_gestion", "2026-09-01T12:00:00Z"),
      movimiento("02", "avanza", "en_gestion", "agendado", "2026-09-02T12:00:00Z"),
      movimiento("03", "avanza", "agendado", "atendido", "2026-09-03T12:00:00Z"),
      movimiento("04", "sigue", null, "agendado", "2026-09-02T12:00:00Z"),
      movimiento("05", "pierde", null, "agendado", "2026-09-02T12:00:00Z"),
      movimiento("06", "pierde", "agendado", "cierre_perdido", "2026-09-03T12:00:00Z"),
    ];
    const resultado = calcular(filas, historial);
    for (const camino of resultado.conversion.porCamino) {
      for (const paso of camino.pasos) {
        expect(idsDeLaCifra(resultado, "etapa_paso", { etapa: paso.etapa })).toHaveLength(paso.llegaron);
        expect(idsDeLaCifra(resultado, "etapa_siguen", { etapa: paso.etapa })).toHaveLength(paso.siguenAqui);
        expect(idsDeLaCifra(resultado, "etapa_perdidos", { etapa: paso.etapa })).toHaveLength(paso.perdidosAqui);
      }
    }
  });

  it("acredita el avance desde Calificado y no inventa etapas de setter al entrar por Agendado", () => {
    const filas = [deal("recorre-setter", "agendado"), deal("entra-agendado", "agendado")];
    const historial = [
      movimiento("01", "recorre-setter", null, "registrado", "2026-09-01T12:00:00Z"),
      movimiento("02", "recorre-setter", "registrado", "en_gestion", "2026-09-02T12:00:00Z"),
      movimiento("03", "recorre-setter", "en_gestion", "contactado", "2026-09-03T12:00:00Z"),
      movimiento("04", "recorre-setter", "contactado", "calificado", "2026-09-04T12:00:00Z"),
      movimiento("05", "recorre-setter", "calificado", "agendado", "2026-09-05T12:00:00Z"),
      movimiento("06", "entra-agendado", null, "agendado", "2026-09-02T12:00:00Z"),
    ];

    const caminos = calcular(filas, historial).conversion.porCamino;
    const setter = caminos.find((camino) => camino.camino === "setter")!;
    const calificado = setter.pasos.find((paso) => paso.etapa === "calificado")!;
    expect(calificado).toMatchObject({
      llegaron: 1,
      dealIds: ["recorre-setter"],
      pasaron: 1,
      pasaronDealIds: ["recorre-setter"],
      siguenAqui: 0,
      perdidosAqui: 0,
    });
    expect(setter.pasos.every((paso) => !paso.dealIds.includes("entra-agendado"))).toBe(true);
    for (const camino of caminos) {
      for (const paso of camino.pasos) {
        expect(paso.pasaron + paso.siguenAqui + paso.perdidosAqui).toBe(paso.llegaron);
      }
    }
  });

  it("un deal que vuelve a una etapa anterior sigue en el camino: no es pérdida ni rompe la suma", () => {
    const filas = [deal("vuelve", "en_gestion")];
    const historial = [
      movimiento("01", "vuelve", null, "en_gestion", "2026-09-01T12:00:00Z"),
      movimiento("02", "vuelve", "en_gestion", "contactado", "2026-09-02T12:00:00Z"),
      movimiento("03", "vuelve", "contactado", "calificado", "2026-09-03T12:00:00Z"),
      movimiento("04", "vuelve", "calificado", "en_gestion", "2026-09-04T12:00:00Z"),
    ];
    const setter = calcular(filas, historial).conversion.porCamino.find((camino) => camino.camino === "setter")!;
    const calificado = setter.pasos.find((paso) => paso.etapa === "calificado")!;
    expect(calificado).toMatchObject({ llegaron: 1, pasaron: 0, siguenAqui: 1, perdidosAqui: 0 });
  });

  it("solo publica la mediana de días hábiles con cinco deals o más", () => {
    const filas = Array.from({ length: 6 }, (_, indice) => deal(`d${indice}`, "agendado"));
    const historial = filas.flatMap((fila, indice) => [
      movimiento(`e${indice}`, fila.id, null, "calificado", "2026-09-07T12:00:00Z"),
      movimiento(`s${indice}`, fila.id, "calificado", "agendado", `2026-09-${String(8 + indice).padStart(2, "0")}T12:00:00Z`),
    ]);
    const tiempos = calcular(filas, historial).tiempoEnEtapa;
    expect(tiempos.find((fila) => fila.etapa === "calificado")).toMatchObject({
      deals: 6,
      medianaDiasHabiles: 3.5,
    });
    expect(tiempos.find((fila) => fila.etapa === "agendado")!.medianaDiasHabiles).toBeNull();
    expect(calcular(filas.slice(0, 4), historial.filter((fila) => !["d4", "d5"].includes(fila.dealId)))
      .tiempoEnEtapa.find((fila) => fila.etapa === "calificado")!.medianaDiasHabiles).toBeNull();
  });

  it("produce siempre los cuatro buckets en los limites 7/8, 30/31 y 90/91", () => {
    const enDias = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000);
    const resultado = calcular([
      deal("d7", "registrado", enDias(7)),
      deal("d8", "registrado", enDias(8)),
      deal("d30", "registrado", enDias(30)),
      deal("d31", "registrado", enDias(31)),
      deal("d90", "registrado", enDias(90)),
      deal("d91", "registrado", enDias(91)),
    ]);

    expect(resultado.sinDuenoPorAntiguedad).toEqual([
      { bucket: "0-7", deals: 1, dealIds: ["d7"] },
      { bucket: "8-30", deals: 2, dealIds: ["d8", "d30"] },
      { bucket: "31-90", deals: 2, dealIds: ["d31", "d90"] },
      { bucket: ">90", deals: 1, dealIds: ["d91"] },
    ]);
  });
});

describe("embudoPorEtapas con PGlite", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let otroProgramId: string;
  let cohortId: string;
  let closerId: string;
  let motivoId: string;
  let secuencia = 0;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "principal",
      nombre: "Principal",
      ticketUsd: "1000",
    }).returning();
    programId = programa.id;
    const [otro] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "otro",
      nombre: "Otro",
      ticketUsd: "800",
    }).returning();
    otroProgramId = otro.id;
    const [cohorte] = await db.insert(cohorts).values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado: "activo",
    }).returning();
    cohortId = cohorte.id;
    const [closer] = await db.insert(users).values({
      email: "maru@retiagrowth.com",
      nombre: "Maru",
      rol: "closer",
      closerId: "Maru",
    }).returning();
    closerId = closer.id;
    const [motivo] = await db.insert(motivos).values({ nombre: "Sin dinero", tipo: "perdida" }).returning();
    motivoId = motivo.id;
  }, 60_000);

  afterAll(async () => {
    await cerrar();
  });

  async function crearDeal(opciones: {
    etapa: EtapaDeal;
    programa?: string;
    owner?: string | null;
    cohorte?: string | null;
    motivo?: string | null;
    anulado?: boolean;
    entrada?: string;
  }): Promise<string> {
    const numero = ++secuencia;
    const programa = opciones.programa ?? programId;
    const [lead] = await db.insert(leads).values({
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
      programId: programa,
      emailNormalizado: `embudo-${numero}@correo.co`,
      nombre: `Lead ${numero}`,
    }).returning();
    const [fuente] = await db.insert(sources).values({
      programId: programa,
      nombre: `Fuente ${numero}`,
      activo: false,
    }).returning();
    const [submission] = await db.insert(submissions).values({
      leadId: lead.id,
      sourceId: fuente.id,
      token: `embudo-${numero}`,
    }).returning();
    const anulacion = opciones.anulado
      ? { anuladoEn: new Date("2026-09-25T12:00:00Z"), anuladoPor: closerId, motivoAnulacion: "error" }
      : {};
    const [fila] = await db.insert(deals).values({
      leadId: lead.id,
      submissionOrigenId: submission.id,
      programId: programa,
      cohortId: opciones.cohorte === undefined ? (programa === programId ? cohortId : null) : opciones.cohorte,
      etapa: opciones.etapa,
      ownerUserId: opciones.owner ?? null,
      motivoId: opciones.motivo ?? null,
      createdAt: new Date(opciones.entrada ?? "2026-09-01T12:00:00Z"),
      ...anulacion,
    }).returning();
    await db.insert(dealEtapaHistorial).values({
      dealId: fila.id,
      de: null,
      a: opciones.etapa,
      fecha: new Date(opciones.entrada ?? "2026-09-01T12:00:00Z"),
    });
    return fila.id;
  }

  it("respeta vigencia y programa, agrupa abiertos y cuadra perdidas con dashboard", async () => {
    const abiertoConOwner = await crearDeal({ etapa: "contactado", owner: closerId });
    const abiertoSinOwner = await crearDeal({ etapa: "contactado" });
    const perdidoConTicket = await crearDeal({
      etapa: "cierre_perdido",
      motivo: motivoId,
      entrada: "2026-09-10T12:00:00Z",
    });
    const perdidoSinTicket = await crearDeal({
      etapa: "cierre_perdido",
      motivo: motivoId,
      cohorte: null,
      entrada: "2026-09-11T12:00:00Z",
    });
    const anulado = await crearDeal({ etapa: "contactado", anulado: true });
    const otroPrograma = await crearDeal({ etapa: "contactado", programa: otroProgramId });

    const resultado = await embudoPorEtapas(db, { programId, rango }, ahora);
    const abiertosContactados = resultado.abiertos.filter((fila) => fila.etapa === "contactado");
    expect(abiertosContactados).toEqual([
      { etapa: "contactado", ownerUserId: closerId, ownerNombre: "Maru", deals: 1, dealIds: [abiertoConOwner] },
      { etapa: "contactado", ownerUserId: null, ownerNombre: null, deals: 1, dealIds: [abiertoSinOwner] },
    ]);
    expect(resultado.motivosDePerdida).toEqual([{
      motivo: "Sin dinero",
      deals: 2,
      dealIds: [perdidoConTicket, perdidoSinTicket],
      ticketPerdidoUsd: 1000,
      dealsSinTicket: 1,
      moneda: "USD",
    }]);

    const todosLosIds = JSON.stringify(resultado);
    expect(todosLosIds).not.toContain(anulado);
    expect(todosLosIds).not.toContain(otroPrograma);
  });
});
