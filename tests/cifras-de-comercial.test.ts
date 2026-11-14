import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { razon, razonVacia, textoDeRazon, type RazonConCobertura } from "@/lib/cobertura";
import { calls, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { pct } from "@/lib/format";
import {
  CONCEPTOS_DE_COMERCIAL,
  cifrasClaveDeComercial,
  cifrasDeCloser,
  MOTIVO_SIN_VENTAS_DEL_CLOSER,
  periodoDeComercial,
  type ContextoDeComercial,
  type ExplicacionesDeComercial,
} from "@/lib/hub/cifras-de-comercial";
import { FRASE_CERO, FRASE_NO_CALCULABLE, FRASE_PUNTOS, type CifraDeMetrica, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import { entradaDesdeRazon, MOTIVO_SIN_DATOS_DE_LA_RAZON } from "@/lib/metricas/razon-a-cifra";
import { embudoDelRango, embudoPorCloser, type EmbudoDelRango } from "@/lib/queries/dashboard";
import { SIN_DINERO } from "@/lib/queries/dinero-de-ventas";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import { detalleDeCifra, detallesDelComparativo, sinListas, vistaDeLista, type DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * 419 E-2: Hub › Comercial como Cifras. El constructor no calcula: cada valor es el campo de la vista, cada tasa
 * trae las partes del grupo de citas y la lista de cada cifra cuenta lo mismo que la cifra.
 */

// El texto real es de la ficha del concepto (E-1) y lo aprueba Mani: aquí va uno de prueba con la forma de cada uno.
const tasa = (rotulo: string, arriba: string, abajo: string): ExplicacionDeConcepto => ({
  rotulo, universo: "todas", unidad: "porcentaje", unidadesDePartes: ["conteo", "conteo"],
  que: `Qué parte de ${abajo.toLowerCase()} son ${arriba.toLowerCase()}.`,
  formula: { forma: "razon", terminos: [arriba, abajo] },
  variables: [{ nombre: abajo, explicacion: "Se cuenta por persona." }],
});
const conteo = (rotulo: string): ExplicacionDeConcepto => ({
  rotulo, universo: "todas", unidad: "conteo", que: `Cuántas ${rotulo.toLowerCase()} hay.`,
  formula: { forma: "conteo", terminos: [rotulo.toLowerCase()] }, variables: [],
});
const plata = (rotulo: string): ExplicacionDeConcepto => ({
  rotulo, universo: "todas", unidad: "usd", que: `Cuánto es lo ${rotulo.toLowerCase()}.`,
  formula: { forma: "suma", terminos: ["valor de cada venta"] }, variables: [],
});
const explicaciones: ExplicacionesDeComercial = {
  citas: conteo("Citas"),
  asistencia: tasa("Asistencia", "Personas con cita realizada", "Personas con resultado marcado"),
  cierre_de_ventas: tasa("Cierre de ventas", "Personas vendidas", "Personas con cita realizada"),
  cita_a_venta: tasa("De cita a venta", "Personas vendidas", "Personas del grupo de citas"),
  citas_sin_marcar: conteo("Citas sin marcar"),
  vendido: plata("Vendido"),
  recaudado: plata("Recaudado"),
  por_cobrar: plata("Por cobrar"),
};

const contexto: ContextoDeComercial = {
  programa: "Programa de prueba", cohorte: "C6", rango: { desde: "2026-11-01", hasta: "2026-11-10" }, hoy: "2026-11-13", closer: null,
};

/** Un embudo con el grupo de citas dado: 10 personas con resultado, `conShow` asistieron, `vendidos` compraron. */
function embudo(o: { deals?: number; conShow?: number; vendidos?: number; sinMarcar?: number; agendas?: number; pendientes?: number } = {}): EmbudoDelRango {
  const d = o.deals ?? 10;
  const conShow = o.conShow ?? 6;
  const vendidos = o.vendidos ?? 3;
  const sinMarcar = o.sinMarcar ?? 0;
  const universo = d + sinMarcar;
  const motivo = sinMarcar > 0 ? `${sinMarcar} de ${universo} citas pasadas siguen sin resultado` : null;
  const cobertura = (base: number) => ({ base, faltan: sinMarcar, motivo, calculable: true, agendasPendientes: o.pendientes });
  const razonShow = d === 0 ? razonVacia("Sin citas en el periodo") : razon(conShow, d, cobertura(d));
  const razonCierre = conShow === 0 ? razonVacia("Sin shows en el periodo") : razon(vendidos, conShow, cobertura(conShow));
  const agendaAVenta = d === 0 ? null : vendidos / d;
  return {
    agendas: o.agendas ?? 12, canceladas: 0,
    estadosDeCitas: { porVenir: 0, sinResultado: sinMarcar, show: conShow, noShow: d - conShow, reagendadas: 0, otro: 0 },
    reagendadas: 0, llamadasConShow: conShow, razonShow, cierres: vendidos, razonCierre, agendaAVenta,
    pendientesDeResultado: sinMarcar,
    grupo: {
      deals: d, conShow, vendidos, pendientes: sinMarcar, sinMarcar, cobertura: universo === 0 ? null : d / universo,
      parcial: universo > 0 && sinMarcar / universo > 0.1, agendaAVenta,
      razonShow, razonCierre, razonAgendaAVenta: razon(vendidos, d, cobertura(d)),
    },
    madurando: false,
  };
}

const textosDe = (c: CifraDeMetrica): string[] => [
  c.rotulo, c.textoDelValor, c.ariaLabel, c.explicacion.que,
  ...c.explicacion.lectura.flat(), ...c.explicacion.filtros.flat(),
  c.explicacion.formula.conLosNumeros ?? "", c.explicacion.evidencia?.boton ?? "", c.explicacion.evidencia?.nota ?? "",
];

describe("419 E-2: una razón con cobertura dicha como entrada de la Cifra", () => {
  const casos: [string, RazonConCobertura][] = [
    ["completa", razon(6, 10, { base: 10, faltan: 0, motivo: null, calculable: true })],
    ["completa con faltantes bajo el umbral", razon(6, 10, { base: 9, faltan: 1, motivo: "1 de 10 citas pasadas siguen sin resultado", calculable: true })],
    ["parcial por base", razon(6, 10, { base: 12, faltan: 18, motivo: null, calculable: true })],
    ["parcial por citas por venir", razon(6, 10, { base: 10, faltan: 0, motivo: null, calculable: true, agendasPendientes: 2 })],
    ["no calculable", razonVacia("Sin citas en el periodo")],
    ["no calculable sin motivo", razon(0, 0, { base: 0, faltan: 0, motivo: null, calculable: true })],
  ];

  it("decide lo mismo que la pieza vieja: el vacío, el valor y cuándo es parcial", () => {
    for (const [nombre, r] of casos) {
      const viejo = textoDeRazon(r, pct);
      const e = entradaDesdeRazon(r);
      expect(e.valor === null, nombre).toBe(viejo === "—");
      expect(Boolean(e.parcial), nombre).toBe(viejo.includes("parcial"));
      expect(e.valor, nombre).toBe(r.valor);
    }
  });

  it("el vacío siempre dice por qué; la base se dice en palabras solo si la consulta no trae motivo", () => {
    expect(entradaDesdeRazon(casos[4][1])).toEqual({ valor: null, motivo: "Sin citas en el periodo" });
    expect(entradaDesdeRazon(casos[5][1])).toEqual({ valor: null, motivo: MOTIVO_SIN_DATOS_DE_LA_RAZON });
    expect(entradaDesdeRazon(casos[2][1], { base: "citas ya tienen resultado" }).parcial).toBe("12 de 30 citas ya tienen resultado.");
    expect(entradaDesdeRazon(casos[3][1]).parcial).toBe("Hay 2 citas por venir de estas personas: cuando ocurran, la tasa puede cambiar.");
    const conMotivo = razon(6, 10, { base: 12, faltan: 18, motivo: "18 de 30 citas pasadas siguen sin resultado", calculable: true, agendasPendientes: 1 });
    expect(entradaDesdeRazon(conMotivo).parcial).toBe("18 de 30 citas pasadas siguen sin resultado. Hay 1 cita por venir de estas personas: cuando ocurra, la tasa puede cambiar.");
    expect(entradaDesdeRazon(casos[0][1])).toEqual({ valor: 0.6 });
  });
});

describe("419 E-2: las cifras clave de Comercial", () => {
  it("cada valor es el campo de la vista y cada tasa trae las partes del grupo de citas", () => {
    const c = cifrasClaveDeComercial({ embudo: embudo(), explicaciones, contexto });
    expect(c.citas.textoDelValor).toBe("12");
    expect(c.asistencia.textoDelValor).toBe("60,0%");
    expect(c.asistencia.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 6 ÷ 10 = 60,0%");
    expect(c.cierreDeVentas.textoDelValor).toBe("50,0%");
    expect(c.cierreDeVentas.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 3 ÷ 6 = 50,0%");
    expect(c.citaAVenta.textoDelValor).toBe("30,0%");
    expect(c.citaAVenta.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 3 ÷ 10 = 30,0%");
    expect(c.sinMarcar).toBeNull();
    expect(c.asistencia.textoDeUniverso).toBe("todas las áreas");
    // Sin fuente no hay estado, y un periodo cerrado no lleva etiqueta.
    for (const cifra of [c.citas, c.asistencia, c.cierreDeVentas, c.citaAVenta]) {
      expect(cifra.estado).toBeNull();
      expect(cifra.etiquetas).toEqual([]);
      expect(cifra.explicacion.evidencia).toBeNull();
    }
  });

  it("«Calculada con»: programa, cohorte, periodo y el closer solo si se filtró", () => {
    const c = cifrasClaveDeComercial({ embudo: embudo(), explicaciones, contexto });
    expect(c.asistencia.explicacion.filtros).toEqual([["Programa", "Programa de prueba"], ["Cohorte", "C6"], ["Periodo", "1-nov a 10-nov"]]);
    const filtrada = cifrasClaveDeComercial({ embudo: embudo(), explicaciones, contexto: { ...contexto, cohorte: null, closer: "Ana", rango: { desde: "2026-11-01", hasta: "2026-11-13" } } });
    expect(filtrada.citas.explicacion.filtros).toEqual([["Programa", "Programa de prueba"], ["Cohorte", "Todas"], ["Periodo", "1-nov a hoy"], ["Closer", "Ana"]]);
    expect(periodoDeComercial({ desde: "2026-11-13", hasta: "2026-11-13" }, "2026-11-13")).toBe("hoy");
  });

  it("parcial: con citas sin marcar las tres tasas lo dicen con su motivo y aparece la cifra de sin marcar", () => {
    const c = cifrasClaveDeComercial({ embudo: embudo({ sinMarcar: 5 }), explicaciones, contexto });
    for (const cifra of [c.asistencia, c.cierreDeVentas, c.citaAVenta]) {
      expect(cifra.etiquetas).toEqual(["Parcial"]);
      expect(cifra.explicacion.lectura).toContainEqual(["Parcial", "5 de 15 citas pasadas siguen sin resultado."]);
    }
    expect(c.citas.etiquetas).toEqual([]);
    expect(c.sinMarcar?.textoDelValor).toBe("5");
    // Una sola sin marcar de 21 no vuelve parcial la tasa (cobertura sobre el umbral), pero la cifra de sin marcar sigue.
    const leve = cifrasClaveDeComercial({ embudo: embudo({ deals: 20, conShow: 10, sinMarcar: 1 }), explicaciones, contexto });
    expect(leve.asistencia.etiquetas).toEqual([]);
    expect(leve.sinMarcar?.textoDelValor).toBe("1");
  });

  it("parcial por madurez: citas por venir de esas personas", () => {
    const c = cifrasClaveDeComercial({ embudo: embudo({ pendientes: 3 }), explicaciones, contexto });
    expect(c.asistencia.explicacion.lectura).toContainEqual(["Parcial", "Hay 3 citas por venir de estas personas: cuando ocurran, la tasa puede cambiar."]);
  });

  it("«—» dice por qué y nunca significa cero; 0 es cero", () => {
    const vacio = cifrasClaveDeComercial({ embudo: embudo({ deals: 0, conShow: 0, vendidos: 0, agendas: 0 }), explicaciones, contexto });
    expect(vacio.citas.textoDelValor).toBe("0");
    expect(vacio.citas.explicacion.lectura[0]).toEqual(["0", FRASE_CERO]);
    for (const [cifra, motivo] of [[vacio.asistencia, "Sin citas en el periodo"], [vacio.cierreDeVentas, "Sin shows en el periodo"], [vacio.citaAVenta, "Sin citas en el periodo"]] as const) {
      expect(cifra.textoDelValor).toBe("—");
      expect(cifra.vacio).toBe(true);
      expect(cifra.explicacion.lectura[0][1]).toBe(`No se puede calcular. ${motivo}. ${FRASE_NO_CALCULABLE}`);
      expect(cifra.explicacion.formula.conLosNumeros).toBeNull();
    }
    // Hubo citas y nadie asistió: asistencia es 0 de verdad, y el cierre no se puede calcular.
    const nadie = cifrasClaveDeComercial({ embudo: embudo({ conShow: 0, vendidos: 0 }), explicaciones, contexto });
    expect(nadie.asistencia.textoDelValor).toBe("0,0%");
    expect(nadie.asistencia.explicacion.lectura[0]).toEqual(["0", FRASE_CERO]);
    expect(nadie.cierreDeVentas.textoDelValor).toBe("—");
  });

  it("en curso: el periodo llega hasta hoy", () => {
    const c = cifrasClaveDeComercial({ embudo: embudo(), explicaciones, contexto: { ...contexto, rango: { desde: "2026-11-09", hasta: "2026-11-13" } } });
    expect(c.asistencia.etiquetas).toEqual(["En curso"]);
    expect(c.asistencia.explicacion.lectura.at(-1)?.[1]).toContain("todavía no termina");
  });

  it("compara solo si se pidió, con la referencia en palabras y las tasas en puntos", () => {
    const anterior = embudo({ conShow: 5, vendidos: 2, agendas: 10 });
    const sin = cifrasClaveDeComercial({ embudo: embudo(), explicaciones, contexto, referencia: "el periodo anterior" });
    expect(sin.asistencia.comparacion).toBeNull();
    const c = cifrasClaveDeComercial({ embudo: embudo(), anterior, referencia: "el periodo anterior", explicaciones, contexto });
    expect(c.citas.comparacion).toEqual({ texto: "el periodo anterior", cifra: "10", cambio: "+2 (+20 %)" });
    expect(c.asistencia.comparacion).toEqual({ texto: "el periodo anterior", cifra: "50,0%", cambio: "+10,0 puntos" });
    expect(c.asistencia.explicacion.lectura.find(([n]) => n === "Cambio")?.[1]).toContain(FRASE_PUNTOS);
    // Si el otro periodo no se puede calcular, no se compara contra un vacío.
    const sinBase = cifrasClaveDeComercial({ embudo: embudo(), anterior: embudo({ deals: 0, conShow: 0, vendidos: 0 }), referencia: "el periodo anterior", explicaciones, contexto });
    expect(sinBase.asistencia.comparacion).toBeNull();
  });

  it("ningún texto lleva «..», «periodo A/B» ni nombres técnicos", () => {
    const cifras = [
      ...Object.values(cifrasClaveDeComercial({ embudo: embudo({ sinMarcar: 5, pendientes: 2 }), anterior: embudo(), referencia: "el periodo anterior", explicaciones, contexto })),
      ...Object.values(cifrasClaveDeComercial({ embudo: embudo({ deals: 0, conShow: 0, vendidos: 0 }), explicaciones, contexto })),
    ].filter((c): c is CifraDeMetrica => c !== null);
    for (const cifra of cifras) {
      for (const texto of textosDe(cifra)) {
        expect(texto, cifra.concepto).not.toMatch(/\.\.|periodo [AB]\b|utm_|grupo_|razon[A-Z]|undefined|null|NaN/);
      }
    }
  });
});

describe("419 E-2: la fila de un closer, celda por celda", () => {
  const fila = { ...embudo({ agendas: 0 }), clave: "u-ana", closerId: "Ana" };

  it("las celdas llevan al closer en «Calculada con» y 0 citas es cero, no «—»", () => {
    const c = cifrasDeCloser({ fila, dinero: { ...SIN_DINERO, vendido: 3000, recaudado: 1200, porCobrar: 1800, ventas: 3 }, explicaciones, contexto });
    expect(c.closer).toBe("Ana");
    expect(c.citas.textoDelValor).toBe("0");
    expect(c.asistencia.explicacion.filtros.at(-1)).toEqual(["Closer", "Ana"]);
    expect([c.vendido.textoDelValor, c.recaudado.textoDelValor, c.porCobrar.textoDelValor]).toEqual(["USD 3.000,00", "USD 1.200,00", "USD 1.800,00"]);
    expect(c.vendido.etiquetas).toEqual([]);
    expect(cifrasDeCloser({ fila: { ...fila, closerId: null }, explicaciones, contexto }).closer).toBe("Sin closer");
  });

  it("sin ventas el dinero es «—» con su motivo; una venta sin saldo calculable lo vuelve parcial", () => {
    for (const dinero of [undefined, SIN_DINERO]) {
      const c = cifrasDeCloser({ fila, dinero, explicaciones, contexto });
      expect(c.vendido.textoDelValor).toBe("—");
      expect(c.porCobrar.explicacion.lectura[0][1]).toContain(MOTIVO_SIN_VENTAS_DEL_CLOSER);
    }
    const c = cifrasDeCloser({ fila, dinero: { ...SIN_DINERO, vendido: 1000, recaudado: 1000, ventas: 1, sinSaldoCalculable: 1 }, explicaciones, contexto });
    expect(c.porCobrar.textoDelValor).toBe("USD 0,00");
    expect(c.vendido.etiquetas).toEqual([]);
    expect(c.porCobrar.explicacion.lectura).toContainEqual(["Parcial", "1 venta quedó fuera porque no tiene valor vendido o tiene abonos en otra moneda."]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Con base: la lista que abre cada cifra cuenta lo mismo que la cifra.

describe("419 E-2: paridad cifra = lista en Comercial", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programaA: string;
  let ana: string;
  let beto: string;
  const rango = { desde: "2026-09-01", hasta: "2026-09-30" };
  const hoy = "2026-10-02";
  const ahora = new Date("2026-10-02T12:00:00-05:00");
  const periodo = { preset: "custom" as const, a: rango, b: null };
  const origen = "/p/e419-a/hub?seccion=comercial";
  const ctx: ContextoDeComercial = { programa: "A", cohorte: null, rango, hoy, closer: null };
  const instante = (dia: string) => new Date(`${dia}T10:00:00-05:00`);

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseReutilizable());
    const [a, b] = (await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "e419-a", nombre: "A" },
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "e419-b", nombre: "B" },
    ]).returning()).map((p) => p.id);
    programaA = a;
    [ana, beto] = (await db.insert(users).values([
      { email: "ana@e419.test", rol: "closer", closerId: "Ana" },
      { email: "beto@e419.test", rol: "closer", closerId: "Beto" },
    ]).returning()).map((u) => u.id);

    let n = 0;
    const cita = async (o: {
      programId?: string; closer: string; etapa: "agendado" | "atendido" | "ganado_parcial";
      resultado: "show" | "no_show" | "agendada" | "cancelada"; dia: string; anulado?: boolean;
    }) => {
      n += 1;
      const programId = o.programId ?? programaA;
      const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `l${n}@e419.test` }).returning();
      const [deal] = await db.insert(deals).values({
        programId, leadId: lead.id, ownerUserId: o.closer, etapa: o.etapa, createdAt: instante("2026-09-01"),
        anuladoEn: o.anulado ? ahora : null, anuladoPor: o.anulado ? ana : null, motivoAnulacion: o.anulado ? "Prueba" : null,
      }).returning();
      await db.insert(calls).values({ programId, dealId: deal.id, closerUserId: o.closer, fechaAgenda: instante(o.dia), resultado: o.resultado });
    };
    // Ana: 3 asistieron (2 hoy vendidas), 2 no asistieron, 3 sin marcar (parcial), 1 cancelada.
    await cita({ closer: ana, etapa: "ganado_parcial", resultado: "show", dia: "2026-09-03" });
    await cita({ closer: ana, etapa: "ganado_parcial", resultado: "show", dia: "2026-09-04" });
    await cita({ closer: ana, etapa: "atendido", resultado: "show", dia: "2026-09-05" });
    await cita({ closer: ana, etapa: "agendado", resultado: "no_show", dia: "2026-09-08" });
    await cita({ closer: ana, etapa: "agendado", resultado: "no_show", dia: "2026-09-09" });
    for (const dia of ["2026-09-10", "2026-09-11", "2026-09-14"]) await cita({ closer: ana, etapa: "agendado", resultado: "agendada", dia });
    await cita({ closer: ana, etapa: "agendado", resultado: "cancelada", dia: "2026-09-15" });
    // Beto: 1 asistió y 1 no.
    await cita({ closer: beto, etapa: "atendido", resultado: "show", dia: "2026-09-16" });
    await cita({ closer: beto, etapa: "agendado", resultado: "no_show", dia: "2026-09-17" });
    // Lo que no puede colarse: un deal anulado con show vendido, y otro programa.
    await cita({ closer: ana, etapa: "ganado_parcial", resultado: "show", dia: "2026-09-18", anulado: true });
    await cita({ programId: b, closer: ana, etapa: "ganado_parcial", resultado: "show", dia: "2026-09-19" });
  }, 120_000);
  afterAll(async () => cerrar());

  /** Cuenta las filas de la lista que abre un detalle, por su URL, como el navegador. */
  async function totalDeLaLista(detalle: DetalleDeCifra): Promise<number> {
    const busqueda = Object.fromEntries(new URL(detalle.href, "https://e419.test").searchParams);
    const vista = await vistaDeLista({
      programId: programaA, metrica: busqueda.metrica as Metrica, busqueda, hoy, codigoCloser: busqueda.closer,
      etapa: busqueda.etapa, antiguedad: busqueda.antiguedad, pagina: 1, ahora,
    }, db);
    expect(vista).not.toBeNull();
    expect(vista!.lista.filas.length).toBe(vista!.lista.subtotal.cantidad);
    return vista!.lista.subtotal.cantidad;
  }

  it("las cifras clave: el botón de cada lista dice el número de su cifra, sin la anulada ni el otro programa", async () => {
    const entrada = { programId: programaA, slug: "e419-a", hoy, periodo, claveCloser: null, origen, ahora };
    const [vista, agendas, grupo_citas, grupo_shows, grupo_pendientes] = await Promise.all([
      embudoDelRango({ programId: programaA, rango }, db, ahora),
      ...(["agendas", "grupo_citas", "grupo_shows", "grupo_pendientes"] as const).map((m) => detalleDeCifra(m, entrada, db)),
    ]);
    const detalles = { agendas, grupo_citas, grupo_shows, grupo_pendientes };
    const c = cifrasClaveDeComercial({ embudo: vista, detalles, explicaciones, contexto: ctx });

    // Lo sembrado, a mano: 8 personas con resultado (4 asistieron, 2 vendidas; la cancelada es del grupo) y 3 sin marcar.
    expect(c.asistencia.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 4 ÷ 8 = 50,0%");
    expect(c.cierreDeVentas.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 2 ÷ 4 = 50,0%");
    expect(c.citaAVenta.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 2 ÷ 8 = 25,0%");
    expect(c.sinMarcar?.valor).toBe(3);
    expect(c.asistencia.etiquetas).toContain("Parcial");

    // La cifra, el botón y la lista de verdad dicen el mismo número.
    expect(c.citas.explicacion.evidencia?.boton).toBe(`Ver las ${c.citas.valor} citas`);
    expect(await totalDeLaLista(agendas)).toBe(c.citas.valor);
    expect(c.asistencia.explicacion.evidencia?.boton).toBe("Ver las 8 personas con resultado marcado");
    expect(await totalDeLaLista(grupo_citas)).toBe(vista.grupo.deals);
    expect(c.cierreDeVentas.explicacion.evidencia?.boton).toBe("Ver las 4 personas con cita realizada");
    expect(await totalDeLaLista(grupo_shows)).toBe(vista.grupo.conShow);
    expect(c.citaAVenta.explicacion.evidencia?.boton).toBe("Ver las 8 personas del grupo de citas");
    expect(c.sinMarcar?.explicacion.evidencia?.boton).toBe("Ver las 3 citas sin marcar");
    expect(await totalDeLaLista(grupo_pendientes)).toBe(3);
    expect(c.asistencia.explicacion.evidencia?.nota).toBe("Son las personas con resultado marcado de abajo de la fórmula; la última columna dice cuáles suman arriba.");

    // Quien no abre listas recibe las mismas cifras, sin evidencia.
    const sinLista = cifrasClaveDeComercial({ embudo: vista, detalles: sinListas(detalles), explicaciones, contexto: ctx });
    expect(sinLista.asistencia.textoDelValor).toBe(c.asistencia.textoDelValor);
    expect(sinLista.asistencia.explicacion.evidencia).toBeNull();
  });

  it("la fila de cada closer: sus celdas y sus listas cuentan lo mismo", async () => {
    const filas = await embudoPorCloser({ programId: programaA, rango }, db, ahora);
    const detalles = await detallesDelComparativo({ programId: programaA, slug: "e419-a", hoy, periodo, origen }, filas.map((f) => f.clave), db, ahora);
    const deAna = filas.find((f) => f.clave === ana)!;
    const c = cifrasDeCloser({ fila: deAna, detalles: detalles[ana], explicaciones, contexto: ctx });
    expect(c.asistencia.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: 3 ÷ 6 = 50,0%");
    expect(c.asistencia.explicacion.evidencia?.boton).toBe("Ver las 6 personas con resultado marcado");
    expect(await totalDeLaLista(detalles[ana].grupo_citas)).toBe(deAna.grupo.deals);
    expect(await totalDeLaLista(detalles[ana].grupo_shows)).toBe(deAna.grupo.conShow);
    expect(await totalDeLaLista(detalles[ana].agendas)).toBe(c.citas.valor);
    expect(c.sinMarcar?.valor).toBe(3);
    expect(await totalDeLaLista(detalles[ana].grupo_pendientes)).toBe(3);

    const deBeto = cifrasDeCloser({ fila: filas.find((f) => f.clave === beto)!, detalles: detalles[beto], explicaciones, contexto: ctx });
    expect(deBeto.asistencia.textoDelValor).toBe("50,0%");
    expect(deBeto.cierreDeVentas.textoDelValor).toBe("0,0%");
    expect(deBeto.sinMarcar).toBeNull();
    // La suma de los closers da el grupo del programa: cada persona cuenta en un solo closer.
    expect(filas.reduce((s, f) => s + f.grupo.deals, 0)).toBe(8);
  });

  it("el módulo declara los conceptos que pinta, para que la ficha de cada uno se pueda exigir", () => {
    expect(Object.keys(explicaciones).sort()).toEqual([...CONCEPTOS_DE_COMERCIAL].sort());
  });
});
