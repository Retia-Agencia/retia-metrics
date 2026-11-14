import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { abonos, cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { ContextoDelHub } from "@/lib/hub/contexto-de-cifras";
import { CONCEPTOS_DE_DINERO, cifrasDeDinero, cifrasPorCohorte, type ExplicacionesDeDinero } from "@/lib/hub/cifras-de-dinero";
import { FRASE_CERO, type CifraDeMetrica, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import { cajaRecaudada, dineroDelRango, ventasPorCohorte } from "@/lib/queries/dashboard";
import { SIN_DINERO } from "@/lib/queries/dinero-de-ventas";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import { detalleDeCifra, sinListas, vistaDeLista, type DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * 419 E-2: Hub › Dinero como Cifras. El constructor no calcula: Vendido, Recaudado y Por cobrar son los de la consulta,
 * "Entró a caja" es una Cifra por moneda y la lista de cada cifra cuenta lo mismo que la cifra.
 */

// El texto real es de la ficha del concepto (E-1) y lo aprueba Mani: aquí va uno de prueba con la forma de cada uno.
const plata = (rotulo: string, forma: "suma" | "resta" = "suma"): ExplicacionDeConcepto => ({
  rotulo, universo: "todas", unidad: "usd", unidadesDePartes: ["usd", "usd"], que: `Cuánto es lo ${rotulo.toLowerCase()}.`,
  formula: { forma, terminos: forma === "resta" ? ["Vendido", "Recaudado"] : ["valor de cada venta"] }, variables: [],
});
const explicaciones: ExplicacionesDeDinero = {
  vendido: plata("Vendido"),
  recaudado: plata("Recaudado"),
  por_cobrar: plata("Por cobrar", "resta"),
  entro_a_caja: plata("Entró a caja"),
  ventas: { rotulo: "Ventas", universo: "todas", unidad: "conteo", que: "Cuántas ventas hay.", formula: { forma: "conteo", terminos: ["ventas del periodo"] }, variables: [] },
};
const contexto: ContextoDelHub = {
  programa: "Programa de prueba", cohorte: "C6", rango: { desde: "2026-11-01", hasta: "2026-11-10" }, hoy: "2026-11-13", closer: null,
};
const dinero = { ...SIN_DINERO, vendido: 3000, recaudado: 2000, porCobrar: 1000, ventas: 2 };

const textosDe = (c: CifraDeMetrica): string[] => [
  c.rotulo, c.textoDelValor, c.ariaLabel, c.explicacion.que, c.linea?.antes ?? "", c.linea?.cifra ?? "", c.linea?.despues ?? "",
  ...c.explicacion.lectura.flat(), ...c.explicacion.filtros.flat(),
  c.explicacion.formula.conLosNumeros ?? "", c.explicacion.evidencia?.boton ?? "", c.explicacion.evidencia?.nota ?? "",
];

describe("419 E-2: Vendido, Recaudado y Por cobrar", () => {
  it("los tres valores son los de la consulta; Recaudado dice qué parte de lo vendido y Por cobrar trae su resta", () => {
    const c = cifrasDeDinero({ dinero, caja: [], explicaciones, contexto });
    expect([c.vendido.textoDelValor, c.recaudado.textoDelValor, c.porCobrar.textoDelValor]).toEqual(["USD 3.000,00", "USD 2.000,00", "USD 1.000,00"]);
    expect(c.recaudado.linea).toEqual({ antes: "", cifra: "66,7%", despues: " de lo vendido, a hoy" });
    expect(c.porCobrar.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: USD 3.000,00 − USD 2.000,00 = USD 1.000,00");
    expect(c.porCobrar.linea).toBeNull();
    expect(c.vendido.explicacion.filtros).toEqual([["Programa", "Programa de prueba"], ["Cohorte", "C6"], ["Periodo", "1-nov a 10-nov"]]);
    for (const cifra of [c.vendido, c.recaudado, c.porCobrar]) {
      expect(cifra.estado).toBeNull();
      expect(cifra.etiquetas).toEqual([]);
    }
  });

  it("un sobrepago se dice aparte y la resta no se escribe con números que no cuadran", () => {
    const c = cifrasDeDinero({ dinero: { ...dinero, recaudado: 2200.3, sobrepago: 200.3 }, caja: [], explicaciones, contexto });
    expect(c.porCobrar.linea).toEqual({ antes: "", cifra: "USD 200,30", despues: " de sobrepago, aparte" });
    expect(c.porCobrar.explicacion.formula.conLosNumeros).toBeNull();
    expect(c.porCobrar.explicacion.lectura.find(([n]) => n === "Sobrepago")?.[1]).toContain("no le restan deuda a otra venta");
    // Recaudado nunca dice más del 100 % de lo vendido.
    expect(cifrasDeDinero({ dinero: { ...dinero, recaudado: 3500, sobrepago: 500 }, caja: [], explicaciones, contexto }).recaudado.linea?.cifra).toBe("100,0%");
  });

  it("parcial: una venta con abonos en otra moneda cuenta en Vendido y queda fuera solo de Recaudado y Por cobrar", () => {
    const c = cifrasDeDinero({ dinero: { ...dinero, sinSaldoCalculable: 2 }, caja: [], explicaciones, contexto });
    expect(c.vendido.etiquetas).toEqual([]);
    for (const cifra of [c.recaudado, c.porCobrar]) {
      expect(cifra.etiquetas).toEqual(["Parcial"]);
      expect(cifra.explicacion.lectura).toContainEqual(["Parcial", "2 ventas quedaron fuera porque no tienen valor vendido o tienen abonos en otra moneda."]);
    }
    expect(c.porCobrar.explicacion.formula.conLosNumeros).toBeNull();
    // Sin valor vendido queda fuera de las tres, y Vendido lo dice con su propia frase.
    const una = cifrasDeDinero({ dinero: { ...dinero, sinSaldoCalculable: 1, sinValorVendido: 1 }, caja: [], explicaciones, contexto });
    expect(una.vendido.explicacion.lectura).toContainEqual(["Parcial", "1 venta no tiene valor vendido y no suma."]);
    expect(una.recaudado.explicacion.lectura).toContainEqual(["Parcial", "1 venta quedó fuera porque no tiene valor vendido o tiene abonos en otra moneda."]);
  });

  it("sin ventas es cero de verdad, sin línea de porcentaje", () => {
    const c = cifrasDeDinero({ dinero: SIN_DINERO, caja: [], explicaciones, contexto });
    expect(c.vendido.textoDelValor).toBe("USD 0,00");
    expect(c.vendido.explicacion.lectura[0]).toEqual(["0", FRASE_CERO]);
    expect(c.recaudado.linea).toBeNull();
  });

  it("compara solo si se pidió, con la referencia en palabras", () => {
    const anterior = { dinero: { ...dinero, vendido: 1500, recaudado: 1500, porCobrar: 0 }, caja: [{ moneda: "USD", total: 500 }] };
    expect(cifrasDeDinero({ dinero, caja: [], referencia: "el periodo anterior", explicaciones, contexto }).vendido.comparacion).toBeNull();
    const c = cifrasDeDinero({ dinero, caja: [{ moneda: "USD", total: 2000 }], anterior, referencia: "el periodo anterior", explicaciones, contexto });
    expect(c.vendido.comparacion).toEqual({ texto: "el periodo anterior", cifra: "USD 1.500,00", cambio: "+USD 1.500,00 (+100 %)" });
    expect(c.entroACaja[0].comparacion?.cifra).toBe("USD 500,00");
  });
});

describe("419 E-2: Entró a caja, una Cifra por moneda", () => {
  it("nunca suma monedas: una Cifra por cada una, con su unidad y su filtro", () => {
    const c = cifrasDeDinero({ dinero, caja: [{ moneda: "USD", total: 1200 }, { moneda: "COP", total: 4_000_000 }], explicaciones, contexto });
    expect(c.entroACaja.map((x) => x.textoDelValor)).toEqual(["COP 4.000.000", "USD 1.200,00"]);
    expect(c.entroACaja.map((x) => x.unidad)).toEqual(["cop", "usd"]);
    expect(c.entroACaja[0].explicacion.filtros.at(-1)).toEqual(["Moneda", "COP"]);
    expect(c.entroACaja.every((x) => x.rotulo === "Entró a caja")).toBe(true);
  });

  it("sin abonos, una sola en USD con cero", () => {
    const c = cifrasDeDinero({ dinero, caja: [], explicaciones, contexto });
    expect(c.entroACaja).toHaveLength(1);
    expect(c.entroACaja[0].textoDelValor).toBe("USD 0,00");
    expect(c.entroACaja[0].explicacion.lectura[0]).toEqual(["0", FRASE_CERO]);
  });

  it("al comparar, una moneda que solo tuvo abonos en el otro periodo sale en cero, no desaparece", () => {
    const c = cifrasDeDinero({
      dinero, caja: [{ moneda: "USD", total: 100 }], anterior: { dinero, caja: [{ moneda: "COP", total: 50_000 }] },
      referencia: "el periodo anterior", explicaciones, contexto,
    });
    expect(c.entroACaja.map((x) => [x.textoDelValor, x.comparacion?.cifra])).toEqual([["COP 0", "COP 50.000"], ["USD 100,00", "USD 0,00"]]);
  });

  it("una moneda que el CRM no registra no se pinta: falla", () => {
    expect(() => cifrasDeDinero({ dinero, caja: [{ moneda: "EUR", total: 1 }], explicaciones, contexto })).toThrow(/EUR/);
  });

  it("ningún texto lleva «..», «periodo A/B» ni nombres técnicos", () => {
    const c = cifrasDeDinero({
      dinero: { ...dinero, recaudado: 2200.3, sobrepago: 200.3, sinSaldoCalculable: 1 }, caja: [{ moneda: "USD", total: 100 }, { moneda: "COP", total: 5 }],
      anterior: { dinero, caja: [] }, referencia: "el periodo anterior", explicaciones, contexto: { ...contexto, rango: { desde: "2026-11-09", hasta: "2026-11-13" } },
    });
    for (const cifra of [c.vendido, c.recaudado, c.porCobrar, ...c.entroACaja]) {
      for (const texto of textosDe(cifra)) expect(texto, cifra.concepto).not.toMatch(/\.\.|periodo [AB]\b|utm_|sinSaldo|undefined|null|NaN/);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Con base: la lista que abre cada cifra cuenta lo mismo que la cifra.

describe("419 E-2: paridad cifra = lista en Dinero", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  let c5: string;
  let c6: string;
  const rango = { desde: "2026-10-01", hasta: "2026-10-20" };
  const hoy = "2026-10-20";
  const ahora = new Date("2026-10-20T12:00:00-05:00");
  const periodo = { preset: "custom" as const, a: rango, b: null };
  const origen = "/p/e419-d/hub?seccion=dinero";
  const ctx: ContextoDelHub = { programa: "D", cohorte: null, rango, hoy, closer: null };

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseReutilizable());
    const [a, b] = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "e419-d", nombre: "D", ticketUsd: "1500" },
      { ...PROGRAMA_DE_PRUEBA, slug: "e419-ajeno", nombre: "Ajeno", ticketUsd: "1500" },
    ]).returning();
    programId = a.id;
    const [closer] = await db.insert(users).values({ email: "c@e419d.test", rol: "closer", closerId: "C419" }).returning();
    [c5, c6] = (await db.insert(cohorts).values([
      { programId, codigo: "C5", metaCupos: 10, precioUsd: "1500" },
      { programId, codigo: "C6", metaCupos: 10, precioUsd: "1500" },
    ]).returning()).map((x) => x.id);

    let n = 0;
    const vender = async (valor: string | null, pagos: Array<[number, "USD" | "COP"]>, extra: { programa?: string; cohortId?: string; anulada?: boolean } = {}) => {
      n += 1;
      const programa = extra.programa ?? programId;
      const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programa, emailNormalizado: `v${n}@e419d.test` }).returning();
      const [deal] = await db.insert(deals).values({
        programId: programa, leadId: lead.id, ownerUserId: closer.id, cohortId: extra.cohortId ?? null, etapa: "ganado_parcial", valorVendidoUsd: valor,
      }).returning();
      await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial", fecha: new Date("2026-10-05T10:00:00-05:00") });
      for (const [monto, moneda] of pagos) {
        await db.insert(abonos).values({ programId: programa, dealId: deal.id, registradoPorUserId: closer.id, fecha: "2026-10-06", monto: String(monto), moneda });
      }
      if (extra.anulada) await db.update(deals).set({ anuladoEn: ahora, anuladoPor: closer.id, motivoAnulacion: "Prueba" }).where(eq(deals.id, deal.id));
      return deal;
    };
    await vender("1500", [[1500, "USD"]], { cohortId: c5 });
    await vender("1500", [[500, "USD"]], { cohortId: c6 });
    await vender("1500", [[300, "USD"], [200, "USD"]], { cohortId: c6 });
    // Fuera de las tres por abonos en otra moneda: cuenta como venta, y su abono sí entra a caja en COP.
    await vender("1000", [[400_000, "COP"]], { cohortId: c6 });
    // Lo que no puede colarse: una venta anulada con su abono, y otro programa.
    const anulada = await vender("1500", [[700, "USD"]], { cohortId: c6, anulada: true });
    await db.update(abonos).set({ anuladoEn: ahora, anuladoPor: closer.id, motivoAnulacion: "Prueba" }).where(eq(abonos.dealId, anulada.id));
    await vender("1500", [[900, "USD"]], { programa: b.id });
  }, 120_000);
  afterAll(async () => cerrar());

  async function listaDe(detalle: DetalleDeCifra) {
    const busqueda = Object.fromEntries(new URL(detalle.href, "https://e419.test").searchParams);
    const vista = await vistaDeLista({ programId, metrica: busqueda.metrica as Metrica, busqueda, hoy, codigoCloser: busqueda.closer, cohorteId: busqueda.cohorte, pagina: 1, ahora }, db);
    expect(vista).not.toBeNull();
    expect(vista!.lista.filas.length).toBe(vista!.lista.subtotal.cantidad);
    return vista!.lista;
  }

  it("las cifras del periodo: el botón dice el número de la lista y la lista suma lo que dice la cifra", async () => {
    const entrada = { programId, slug: "e419-d", hoy, periodo, claveCloser: null, origen, ahora };
    const [dineroDelPeriodo, caja, contratado, detalleDeCaja] = await Promise.all([
      dineroDelRango({ programId, rango }, db),
      cajaRecaudada({ programId, rango }, db),
      detalleDeCifra("contratado", entrada, db),
      detalleDeCifra("caja", entrada, db),
    ]);
    const detalles = { contratado, caja: detalleDeCaja };
    const c = cifrasDeDinero({ dinero: dineroDelPeriodo, caja, detalles, explicaciones, contexto: ctx });

    // Lo sembrado, a mano: tres ventas con saldo (2.500 recaudados, 2.000 por cobrar) y una con abonos en COP, que cuenta
    // en Vendido (5.500) pero no en Recaudado ni en Por cobrar.
    expect([c.vendido.valor, c.recaudado.valor, c.porCobrar.valor]).toEqual([5500, 2500, 2000]);
    expect(c.vendido.etiquetas).not.toContain("Parcial");
    expect(c.recaudado.etiquetas).toContain("Parcial");
    expect(c.entroACaja.map((x) => x.textoDelValor)).toEqual(["COP 400.000", "USD 2.500,00"]);

    // Las tres abren la misma lista de ventas, y esa lista trae las mismas tres cifras al pie.
    const ventas = await listaDe(contratado);
    expect(c.vendido.explicacion.evidencia?.boton).toBe(`Ver las ${ventas.subtotal.cantidad} ventas`);
    expect(c.recaudado.explicacion.evidencia?.href).toBe(c.vendido.explicacion.evidencia?.href);
    expect(ventas.subtotal.cantidad).toBe(dineroDelPeriodo.ventas + dineroDelPeriodo.sinSaldoCalculable);
    expect(ventas.dinero).toEqual(dineroDelPeriodo);

    // Con dos monedas, el botón de la caja no dice un total que no es el de esa moneda.
    const abonosDeLaLista = await listaDe(detalleDeCaja);
    expect(c.entroACaja[0].explicacion.evidencia?.boton).toBe("Ver todos los abonos");
    expect(abonosDeLaLista.subtotal.cantidad).toBe(5);
    expect(abonosDeLaLista.subtotal.caja.map((x) => [x.moneda, x.total]).sort()).toEqual(c.entroACaja.map((x) => [x.explicacion.filtros.at(-1)![1], x.valor]).sort());

    // Quien no abre listas recibe las mismas cifras, sin evidencia.
    const sinLista = cifrasDeDinero({ dinero: dineroDelPeriodo, caja, detalles: sinListas(detalles), explicaciones, contexto: ctx });
    expect(sinLista.vendido.textoDelValor).toBe(c.vendido.textoDelValor);
    expect(sinLista.vendido.explicacion.evidencia).toBeNull();
    expect(sinLista.entroACaja[0].explicacion.evidencia).toBeNull();
  });

  it("ventas por cohorte: cada fila con sus cuatro celdas, y su lista cuenta las ventas de esa cohorte", async () => {
    const filas = await ventasPorCohorte({ programId, rango }, db);
    const detalles = Object.fromEntries(await Promise.all(filas.filter((f) => f.cohorteId).map(async (f) =>
      [f.cohorteId!, await detalleDeCifra("contratado", { programId, slug: "e419-d", hoy, periodo, claveCloser: null, origen, cohorteId: f.cohorteId, ahora }, db)] as const)));
    const c = cifrasPorCohorte({ filas, detalles, explicaciones, contexto: ctx });
    expect(c.map((x) => [x.cohorte, x.ventas.textoDelValor, x.vendido.textoDelValor, x.recaudado.textoDelValor, x.porCobrar.textoDelValor]).sort()).toEqual([
      ["C5", "1", "USD 1.500,00", "USD 1.500,00", "USD 0,00"],
      ["C6", "3", "USD 4.000,00", "USD 1.000,00", "USD 2.000,00"],
    ]);
    const deC6 = c.find((x) => x.clave === c6)!;
    expect(deC6.ventas.explicacion.filtros).toContainEqual(["Cohorte", "C6"]);
    expect(deC6.porCobrar.etiquetas).toContain("Parcial");
    for (const fila of c) {
      const lista = await listaDe(detalles[fila.clave]);
      expect(lista.subtotal.cantidad).toBe(fila.ventas.valor);
      expect(fila.ventas.explicacion.evidencia?.boton).toBe(`Ver las ${fila.ventas.valor} ventas`);
    }
    // La suma de las cohortes es el total del programa: conteos, que sí son sumables.
    expect(c.reduce((s, x) => s + (x.ventas.valor ?? 0), 0)).toBe(4);
  });

  it("el módulo declara los conceptos que pinta, para que la ficha de cada uno se pueda exigir", () => {
    expect(Object.keys(explicaciones).sort()).toEqual([...CONCEPTOS_DE_DINERO].sort());
  });
});
