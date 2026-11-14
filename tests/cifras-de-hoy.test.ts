import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { razon, razonVacia } from "@/lib/cobertura";
import { abonos, calls, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { CONCEPTOS_DE_HOY, cifrasDeHoy, MOTIVO_SIN_CITAS_DEBIDAS, type DatosDeHoy, type EntradaDeCifrasDeHoy, type ExplicacionesDeHoy } from "@/lib/hub/cifras-de-hoy";
import { FRASE_CERO, type CifraDeMetrica, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { EmbudoDelRango } from "@/lib/queries/dashboard";
import { SIN_DINERO } from "@/lib/queries/dinero-de-ventas";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import { armarReporteDiario } from "@/lib/queries/reporte-diario";
import { detallesDelDashboard, sinListas, vistaDeLista, type DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * 419 E-2: Hub › Hoy como Cifras. El constructor no calcula: cada valor es el campo del reporte diario, y la lista de
 * cada cifra cuenta lo mismo que la cifra.
 */

// El texto real es de la ficha del concepto (E-1) y lo aprueba Mani: aquí va uno de prueba con la forma de cada uno.
const UNIDAD: Partial<Record<(typeof CONCEPTOS_DE_HOY)[number], ExplicacionDeConcepto["unidad"]>> = {
  asistencia: "porcentaje", cierre_de_ventas: "porcentaje", show_por_cita: "porcentaje",
  vendido: "usd", recaudado: "usd", por_cobrar: "usd", entro_a_caja: "usd", leads_que_hacen_falta: "decimal",
};
const explicaciones = Object.fromEntries(CONCEPTOS_DE_HOY.map((clave): [string, ExplicacionDeConcepto] => {
  const unidad = UNIDAD[clave] ?? "conteo";
  const esTasa = unidad === "porcentaje";
  return [clave, {
    rotulo: `Rótulo de ${clave.replaceAll("_", " ")}`, universo: "todas", unidad,
    unidadesDePartes: esTasa ? ["conteo", "conteo"] : unidad === "usd" ? ["usd", "usd"] : undefined,
    que: "Qué mide esta cifra.",
    formula: esTasa ? { forma: "razon", terminos: ["Arriba", "Abajo"] } : clave === "por_cobrar" ? { forma: "resta", terminos: ["Vendido", "Recaudado"] } : { forma: "conteo", terminos: ["lo que se cuenta"] },
    variables: [],
  }];
})) as ExplicacionesDeHoy;

function embudo(o: { deals?: number; conShow?: number; vendidos?: number; sinMarcar?: number } = {}): EmbudoDelRango {
  const d = o.deals ?? 4;
  const conShow = o.conShow ?? 3;
  const vendidos = o.vendidos ?? 1;
  const sinMarcar = o.sinMarcar ?? 0;
  const universo = d + sinMarcar;
  const motivo = sinMarcar > 0 ? `${sinMarcar} de ${universo} citas pasadas siguen sin resultado` : null;
  const cobertura = (base: number) => ({ base, faltan: sinMarcar, motivo, calculable: true });
  const razonShow = d === 0 ? razonVacia("Sin citas en el periodo") : razon(conShow, d, cobertura(d));
  const razonCierre = conShow === 0 ? razonVacia("Sin shows en el periodo") : razon(vendidos, conShow, cobertura(conShow));
  return {
    agendas: 6, canceladas: 1,
    estadosDeCitas: { porVenir: 0, sinResultado: sinMarcar, show: conShow, noShow: d - conShow, reagendadas: 0, otro: 0 },
    reagendadas: 0, llamadasConShow: conShow, razonShow, cierres: 2, razonCierre, agendaAVenta: d === 0 ? null : vendidos / d,
    pendientesDeResultado: sinMarcar,
    grupo: {
      deals: d, conShow, vendidos, pendientes: sinMarcar, sinMarcar, cobertura: universo === 0 ? null : d / universo,
      parcial: universo > 0 && sinMarcar / universo > 0.1, agendaAVenta: d === 0 ? null : vendidos / d,
      razonShow, razonCierre, razonAgendaAVenta: razon(vendidos, d, cobertura(d)),
    },
    madurando: false,
  };
}

const datos = (o: Partial<DatosDeHoy> = {}): DatosDeHoy => ({
  embudo: embudo(), sinResultado: 0, registros: 14, leadsDelDia: 12,
  dia: { real: 2, meta: 2.5 }, semana: { real: 6, meta: 10 }, diasDeLaSemana: { dia: 4, total: 5 },
  objetivoDeLeads: 20, leadsQueHacenFalta: { valor: 31.4, razon: null },
  caja: [{ moneda: "USD", total: 900 }], dinero: { ...SIN_DINERO, vendido: 3000, recaudado: 900, porCobrar: 2100, ventas: 2 },
  leadsDeLaSemana: 70, showDeLaSemana: { citasQueYaDebianOcurrir: 20, realizadas: 12, sinMarcar: 0, porcentaje: 0.6 },
  citasDeManana: 5, ...o,
});
const entrada = (o: Partial<DatosDeHoy> = {}, extra: Partial<EntradaDeCifrasDeHoy> = {}): EntradaDeCifrasDeHoy => ({
  datos: datos(o), explicaciones, programa: "Programa de prueba", dia: "2026-11-12", hoy: "2026-11-12", lunes: "2026-11-09", ...extra,
});

function todas(c: ReturnType<typeof cifrasDeHoy>): CifraDeMetrica[] {
  return [
    c.cuposVendidos, c.leads, c.leadsQueHacenFalta, ...c.entroACaja, c.asistencia, c.sinMarcar, c.cierreDeVentas,
    ...Object.values(c.embudo), ...Object.values(c.citas), c.vendido, c.recaudado, c.porCobrar, ...Object.values(c.semana), c.citasDeManana,
  ].filter((x): x is CifraDeMetrica => x !== null);
}
const textosDe = (c: CifraDeMetrica): string[] => [
  c.rotulo, c.textoDelValor, c.ariaLabel, c.linea?.antes ?? "", c.linea?.cifra ?? "", c.linea?.despues ?? "", c.barra?.rotuloDeMarca ?? "",
  ...c.explicacion.lectura.flat(), ...c.explicacion.filtros.flat(),
  c.explicacion.formula.conLosNumeros ?? "", c.explicacion.evidencia?.boton ?? "", c.explicacion.evidencia?.nota ?? "",
];

describe("419 E-2: las cifras clave de Hoy", () => {
  it("cada valor es el campo del reporte; «Calculada con» dice el programa y el día, sin cohorte ni closer", () => {
    const c = cifrasDeHoy(entrada());
    expect(c.cuposVendidos.textoDelValor).toBe("2");
    expect(c.leads.textoDelValor).toBe("12");
    expect(c.leadsQueHacenFalta.textoDelValor).toBe("31,4");
    expect(c.entroACaja.map((x) => x.textoDelValor)).toEqual(["USD 900,00"]);
    expect(c.asistencia.textoDelValor).toBe("75,0%");
    expect(c.cierreDeVentas.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 1 ÷ 3 = 33,3%");
    expect(c.cuposVendidos.explicacion.filtros).toEqual([["Programa", "Programa de prueba"], ["Día", "Hoy"]]);
    expect(c.entroACaja[0].explicacion.filtros).toEqual([["Programa", "Programa de prueba"], ["Día", "Hoy"], ["Moneda", "USD"]]);
    expect(c.cuposVendidos.etiquetas).toEqual(["En curso"]);
    // Un día que ya pasó no está en curso y dice su fecha.
    const ayer = cifrasDeHoy(entrada({}, { dia: "2026-11-11" }));
    expect(ayer.cuposVendidos.etiquetas).toEqual([]);
    expect(ayer.cuposVendidos.explicacion.filtros[1]).toEqual(["Día", "11-nov"]);
  });

  it("Cupos vendidos: el estado sale del objetivo del día y la línea dice el objetivo; sin objetivo, sin estado", () => {
    const c = cifrasDeHoy(entrada());
    expect(c.cuposVendidos.estado).toEqual({ tono: "alerta", rotulo: "En seguimiento" });
    expect(c.cuposVendidos.linea).toEqual({ antes: "Objetivo del día: ", cifra: "2,5", despues: " · llevas el 80,0%" });
    expect(cifrasDeHoy(entrada({ dia: { real: 3, meta: 2.5 } })).cuposVendidos.estado?.tono).toBe("exito");
    expect(cifrasDeHoy(entrada({ dia: { real: 1, meta: 2.5 } })).cuposVendidos.estado?.tono).toBe("peligro");
    const sin = cifrasDeHoy(entrada({ dia: { real: 2, meta: null } })).cuposVendidos;
    expect(sin.estado).toBeNull();
    expect(sin.linea?.antes).toBe("Sin objetivo del día: la cohorte no tiene ventana de ventas");
    // Un objetivo de 0 (ya se llegó) no divide entre cero ni inventa un estado.
    const cero = cifrasDeHoy(entrada({ dia: { real: 2, meta: 0 } })).cuposVendidos;
    expect(cero.estado).toBeNull();
    expect(cero.linea?.despues).toBe(" · llevas el —");
  });

  it("Leads: su objetivo en la línea, sin estado; «Leads que hacen falta» sin valor dice su razón", () => {
    const c = cifrasDeHoy(entrada());
    expect(c.leads.linea).toEqual({ antes: "Objetivo de leads: ", cifra: "20 por día", despues: " · llevas el 60,0%" });
    expect(c.leads.estado).toBeNull();
    expect(cifrasDeHoy(entrada({ objetivoDeLeads: null })).leads.linea?.antes).toBe("Sin objetivo de leads por día");
    expect(cifrasDeHoy(entrada({ leadsDelDia: null })).leads.textoDelValor).toBe("0");
    const sin = cifrasDeHoy(entrada({ leadsQueHacenFalta: { valor: null, razon: "Todavía no sabemos qué porcentaje de los shows termina en venta." } })).leadsQueHacenFalta;
    expect(sin.textoDelValor).toBe("—");
    expect(sin.explicacion.lectura[0][1]).toContain("Todavía no sabemos qué porcentaje de los shows termina en venta. «—» nunca significa cero.");
  });

  it("la asistencia del día es por persona y avisa parcial con las citas sin marcar", () => {
    const c = cifrasDeHoy(entrada({ embudo: embudo({ sinMarcar: 3 }) }));
    expect(c.asistencia.etiquetas).toContain("Parcial");
    expect(c.sinMarcar?.textoDelValor).toBe("3");
    expect(cifrasDeHoy(entrada()).sinMarcar).toBeNull();
  });

  it("sin abonos, «Entró a caja» es una sola en USD con cero; con dos monedas, dos", () => {
    expect(cifrasDeHoy(entrada({ caja: [] })).entroACaja.map((x) => x.textoDelValor)).toEqual(["USD 0,00"]);
    expect(cifrasDeHoy(entrada({ caja: [{ moneda: "USD", total: 1 }, { moneda: "COP", total: 2 }] })).entroACaja.map((x) => x.unidad)).toEqual(["cop", "usd"]);
  });
});

describe("419 E-2: el embudo, las citas y el dinero del día", () => {
  it("los pasos y los conteos de citas salen del embudo del día", () => {
    const c = cifrasDeHoy(entrada({ sinResultado: 2 }));
    expect([c.embudo.envios, c.embudo.citas, c.embudo.realizadas, c.embudo.cuposVendidos].map((x) => x.textoDelValor)).toEqual(["14", "6", "3", "2"]);
    expect([c.citas.delDia, c.citas.realizadas, c.citas.canceladas, c.citas.sinResultado].map((x) => x.textoDelValor)).toEqual(["6", "3", "1", "2"]);
    expect(cifrasDeHoy(entrada()).citas.sinResultado.explicacion.lectura[0]).toEqual(["0", FRASE_CERO]);
  });

  it("Vendido, Recaudado y Por cobrar son los de las ventas del día", () => {
    const c = cifrasDeHoy(entrada());
    expect([c.vendido.textoDelValor, c.recaudado.textoDelValor, c.porCobrar.textoDelValor]).toEqual(["USD 3.000,00", "USD 900,00", "USD 2.100,00"]);
    expect(c.vendido.explicacion.filtros).toEqual([["Programa", "Programa de prueba"], ["Día", "Hoy"]]);
  });
});

describe("419 E-2: la semana", () => {
  it("cupos: barra contra el objetivo de la semana, con lo esperado a hoy por días hábiles", () => {
    const c = cifrasDeHoy(entrada()).semana.cupos;
    expect(c.textoDelValor).toBe("6");
    expect(c.deMeta).toBe("de 10");
    expect(c.barra).toMatchObject({ rotuloDeMarca: "a hoy 8", lectura: { antes: "Vamos ", cifra: "2", despues: " atrás" } });
    expect(c.estado).toEqual({ tono: "alerta", rotulo: "En seguimiento" });
    const lectura = c.explicacion.lectura.map(([, t]) => t).join(" ");
    expect(lectura).toContain("La meta de cupos de la semana. Se calcula: es la parte del objetivo del mes que toca esta semana.");
    expect(lectura).toContain("ya pasó el 80 % de los días hábiles de la semana");
    expect(lectura).not.toContain("cohorte");
    expect(c.explicacion.filtros).toEqual([["Programa", "Programa de prueba"], ["Semana", "9-nov a hoy"]]);
    const sin = cifrasDeHoy(entrada({ semana: { real: 6, meta: null } })).semana.cupos;
    expect(sin.barra).toBeNull();
    expect(sin.estado).toBeNull();
    expect(sin.linea?.antes).toBe("Sin objetivo de la semana: el mes no tiene ventana de ventas");
  });

  it("leads: el objetivo de la semana es el del día por los días hábiles; sin medir es «—»", () => {
    const c = cifrasDeHoy(entrada()).semana.leads;
    expect(c.deMeta).toBe("de 100");
    expect(c.barra?.rotuloDeMarca).toBe("a hoy 80");
    expect(c.estado).toBeNull();
    const sin = cifrasDeHoy(entrada({ leadsDeLaSemana: null })).semana.leads;
    expect(sin.textoDelValor).toBe("—");
    expect(sin.barra).toBeNull();
  });

  it("asistencia de la semana: por cita, con sus partes; parcial con las sin marcar; «—» si ninguna tiene resultado", () => {
    const c = cifrasDeHoy(entrada()).semana.asistencia;
    expect(c.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 12 ÷ 20 = 60,0%");
    expect(c.etiquetas).toEqual(["En curso"]);
    const parcial = cifrasDeHoy(entrada({ showDeLaSemana: { citasQueYaDebianOcurrir: 20, realizadas: 12, sinMarcar: 1, porcentaje: 0.6 } })).semana.asistencia;
    expect(parcial.explicacion.lectura).toContainEqual(["Parcial", "1 de 20 citas sigue sin resultado marcado por el closer."]);
    const vacia = cifrasDeHoy(entrada({ showDeLaSemana: { citasQueYaDebianOcurrir: 4, realizadas: 0, sinMarcar: 4, porcentaje: null } })).semana.asistencia;
    expect(vacia.textoDelValor).toBe("—");
    expect(vacia.explicacion.lectura[0][1]).toContain(MOTIVO_SIN_CITAS_DEBIDAS);
  });

  it("ningún texto lleva «..», «periodo A/B» ni nombres técnicos, en ningún caso raro", () => {
    const casos = [
      entrada(),
      entrada({ embudo: embudo({ sinMarcar: 3 }), sinResultado: 3, caja: [{ moneda: "COP", total: 5 }, { moneda: "USD", total: 1 }] }),
      entrada({ embudo: embudo({ deals: 0, conShow: 0, vendidos: 0 }), dia: { real: 0, meta: null }, semana: { real: 0, meta: null }, objetivoDeLeads: null, leadsDeLaSemana: null, leadsQueHacenFalta: { valor: null, razon: "Falta medir." }, showDeLaSemana: { citasQueYaDebianOcurrir: 0, realizadas: 0, sinMarcar: 0, porcentaje: null }, dinero: { ...SIN_DINERO, sinSaldoCalculable: 1, sinValorVendido: 1 } }, { dia: "2026-11-10" }),
    ];
    for (const caso of casos) {
      for (const cifra of todas(cifrasDeHoy(caso))) {
        for (const texto of textosDe(cifra)) expect(texto, cifra.concepto).not.toMatch(/\.\.|periodo [AB]\b|utm_|grupo_|undefined|null|NaN/);
      }
    }
  });

  it("el módulo declara los conceptos que pinta, para que la ficha de cada uno se pueda exigir", () => {
    expect(Object.keys(explicaciones).sort()).toEqual([...CONCEPTOS_DE_HOY].sort());
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Con base: la lista que abre cada cifra cuenta lo mismo que la cifra, sobre el reporte diario de verdad.

describe("419 E-2: paridad cifra = lista en Hoy", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  const dia = "2026-09-15";
  const ahora = new Date("2026-09-15T23:00:00-05:00");
  const instante = (hora: string, d = dia) => new Date(`${d}T${hora}:00-05:00`);

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseReutilizable());
    const [a, b] = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "e419-h", nombre: "H", ticketUsd: "1500" },
      { ...PROGRAMA_DE_PRUEBA, slug: "e419-h-ajeno", nombre: "Ajeno", ticketUsd: "1500" },
    ]).returning();
    programId = a.id;
    const [closer] = await db.insert(users).values({ email: "c@e419h.test", rol: "closer", closerId: "H419" }).returning();
    let n = 0;
    const cita = async (o: {
      programa?: string; etapa: "agendado" | "atendido" | "ganado_parcial"; resultado: "show" | "no_show" | "agendada" | "cancelada";
      hora?: string; anulado?: boolean; venta?: { valor: string; abono: number };
    }) => {
      n += 1;
      const programa = o.programa ?? programId;
      const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programa, emailNormalizado: `h${n}@e419h.test` }).returning();
      const [deal] = await db.insert(deals).values({
        programId: programa, leadId: lead.id, ownerUserId: closer.id, etapa: o.etapa, valorVendidoUsd: o.venta?.valor ?? null, createdAt: instante("08:00", "2026-09-01"),
        anuladoEn: o.anulado ? ahora : null, anuladoPor: o.anulado ? closer.id : null, motivoAnulacion: o.anulado ? "Prueba" : null,
      }).returning();
      await db.insert(calls).values({ programId: programa, dealId: deal.id, closerUserId: closer.id, fechaAgenda: instante(o.hora ?? "10:00"), resultado: o.resultado });
      if (o.venta) {
        await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial", fecha: instante("15:00") });
        await db.insert(abonos).values({ programId: programa, dealId: deal.id, registradoPorUserId: closer.id, fecha: dia, monto: String(o.venta.abono), moneda: "USD" });
      }
    };
    // El día: 2 asistieron (1 compró), 1 no asistió, 2 sin marcar, 1 cancelada.
    await cita({ etapa: "ganado_parcial", resultado: "show", venta: { valor: "1500", abono: 500 } });
    await cita({ etapa: "atendido", resultado: "show" });
    await cita({ etapa: "agendado", resultado: "no_show" });
    await cita({ etapa: "agendado", resultado: "agendada", hora: "11:00" });
    await cita({ etapa: "agendado", resultado: "agendada", hora: "12:00" });
    await cita({ etapa: "agendado", resultado: "cancelada" });
    // Lo que no puede colarse: un deal anulado con show y venta, y otro programa.
    await cita({ etapa: "ganado_parcial", resultado: "show", anulado: true });
    await cita({ programa: b.id, etapa: "ganado_parcial", resultado: "show", venta: { valor: "1500", abono: 700 } });
  }, 120_000);
  afterAll(async () => cerrar());

  async function totalDeLaLista(detalle: DetalleDeCifra): Promise<number> {
    const busqueda = Object.fromEntries(new URL(detalle.href, "https://e419.test").searchParams);
    const vista = await vistaDeLista({ programId, metrica: busqueda.metrica as Metrica, busqueda, hoy: dia, codigoCloser: busqueda.closer, pagina: 1, ahora }, db);
    expect(vista).not.toBeNull();
    return vista!.lista.subtotal.cantidad;
  }

  it("las cifras del día salen del reporte diario y cada lista dice el mismo número", async () => {
    const reporte = await armarReporteDiario({ programId, dia }, db);
    const periodo = { preset: "custom" as const, a: { desde: dia, hasta: dia }, b: null };
    const detalles = await detallesDelDashboard({ programId, slug: "e419-h", hoy: dia, periodo, claveCloser: null, origen: "/p/e419-h/hub", ahora: reporte.corte }, db);
    const d: DatosDeHoy = {
      embudo: reporte.vista.embudo, sinResultado: reporte.vista.sinResultado, registros: reporte.registros, leadsDelDia: null,
      dia: reporte.horizontes.find((h) => h.clave === "dia")!, semana: reporte.horizontes.find((h) => h.clave === "semana")!,
      diasDeLaSemana: reporte.contexto.semana, objetivoDeLeads: null, leadsQueHacenFalta: reporte.proyeccion.leadsRequeridosDia,
      caja: reporte.caja, dinero: reporte.dinero, leadsDeLaSemana: reporte.leadsDeLaSemana, showDeLaSemana: reporte.showDeLaSemana, citasDeManana: 0,
    };
    const base = { datos: d, explicaciones, programa: "H", dia, hoy: "2026-09-20", lunes: "2026-09-14" };
    const c = cifrasDeHoy({ ...base, detalles });

    // Lo sembrado, a mano.
    expect([c.citas.delDia.valor, c.citas.realizadas.valor, c.citas.canceladas.valor]).toEqual([5, 2, 1]);
    expect(c.cuposVendidos.valor).toBe(1);
    expect(c.asistencia.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 2 ÷ 4 = 50,0%");
    expect([c.vendido.valor, c.recaudado.valor, c.porCobrar.valor]).toEqual([1500, 500, 1000]);
    expect(c.entroACaja.map((x) => x.textoDelValor)).toEqual(["USD 500,00"]);
    expect(c.sinMarcar?.valor).toBe(2);

    // Cada cifra y su lista de verdad.
    const pares: Array<[string, CifraDeMetrica, DetalleDeCifra, number | null]> = [
      ["citas del día", c.citas.delDia, detalles.agendas, c.citas.delDia.valor],
      ["realizadas", c.citas.realizadas, detalles.shows, c.citas.realizadas.valor],
      ["canceladas", c.citas.canceladas, detalles.canceladas, c.citas.canceladas.valor],
      ["cupos vendidos", c.cuposVendidos, detalles.cierres, c.cuposVendidos.valor],
      ["asistencia (abajo de la fórmula)", c.asistencia, detalles.grupo_citas, reporte.vista.embudo.grupo.deals],
      ["cierre (abajo de la fórmula)", c.cierreDeVentas, detalles.grupo_shows, reporte.vista.embudo.grupo.conShow],
      ["sin marcar", c.sinMarcar!, detalles.grupo_pendientes, c.sinMarcar!.valor],
    ];
    for (const [nombre, cifra, detalle, esperado] of pares) {
      expect(await totalDeLaLista(detalle), nombre).toBe(esperado);
      expect(cifra.explicacion.evidencia?.boton, nombre).toContain(` ${esperado} `);
    }
    expect(c.vendido.explicacion.evidencia?.href).toBe(c.cuposVendidos.explicacion.evidencia?.href);
    // El paso de envíos no abre lista: no hay una probada que cuente lo mismo.
    expect(c.embudo.envios.explicacion.evidencia).toBeNull();

    // Quien no abre listas recibe las mismas cifras, sin evidencia.
    const sinLista = cifrasDeHoy({ ...base, detalles: sinListas(detalles) });
    expect(sinLista.asistencia.textoDelValor).toBe(c.asistencia.textoDelValor);
    expect(todas(sinLista).every((x) => x.explicacion.evidencia === null)).toBe(true);
  });
});
