import { describe, expect, it } from "vitest";
import {
  armarCifra,
  FRASE_CERO,
  FRASE_NO_CALCULABLE,
  FRASE_SIN_DATOS,
  FRASE_SIN_OBJETIVO,
  textoDeCambio,
  type EntradaDeCifra,
} from "@/lib/metricas/cifra";
import { explicacionDePauta, type ClaveDeExplicacionDePauta } from "@/lib/metricas/explicaciones-de-pauta";

const FILTROS = [["Programa", "Comunicarte"], ["Cohorte", "C6"]] as const;

function entrada(clave: ClaveDeExplicacionDePauta, resto: Omit<EntradaDeCifra, "concepto" | "explicacion" | "filtros"> & { filtros?: EntradaDeCifra["filtros"] }): EntradaDeCifra {
  return { concepto: clave, explicacion: explicacionDePauta(clave), filtros: FILTROS, ...resto };
}

const lectura = (e: EntradaDeCifra) => armarCifra(e).explicacion.lectura;
const fraseDe = (e: EntradaDeCifra, rotulo: string) => lectura(e).find(([r]) => r === rotulo)?.[1];

describe("los ocho casos raros (diseño §1.3), cada uno con su frase", () => {
  it("normal con estado: el badge y sus umbrales", () => {
    const e = entrada("roas", { valor: 6.4, partes: [25340, 3959], estado: { fuente: "objetivo", objetivo: 10, aceptable: 5, menorEsMejor: false } });
    const c = armarCifra(e);
    expect(c.estado).toEqual({ tono: "alerta", rotulo: "En seguimiento" });
    expect(fraseDe(e, "En seguimiento")).toBe("El objetivo es 10,0× o más y lo aceptable 5,0× o más. Esta cifra queda entre los dos. Los cargan Pauta o Gerencia en Programa › Objetivos.");
  });

  it("parcial: la etiqueta en la tarjeta y su motivo al abrir", () => {
    const motivo = "Hay 18 citas del periodo cuya hora no ha llegado; cuando ocurran, la tasa cambia.";
    const e = entrada("show", { valor: 0.41, partes: [34, 83], parcial: motivo });
    expect(armarCifra(e).etiquetas).toEqual(["Parcial"]);
    expect(fraseDe(e, "Parcial")).toBe(motivo);
  });

  it("«—» no se puede calcular: el motivo y que nunca es cero", () => {
    const e = entrada("frecuencia", { valor: null, motivo: "Meta solo da las personas alcanzadas día por día; en un periodo de varios días no se puede sumar." });
    const c = armarCifra(e);
    expect(c.textoDelValor).toBe("—");
    expect(c.vacio).toBe(true);
    expect(fraseDe(e, "—")).toBe(`No se puede calcular. Meta solo da las personas alcanzadas día por día; en un periodo de varios días no se puede sumar. ${FRASE_NO_CALCULABLE}`);
  });

  it("un «—» sin motivo no se puede armar", () => {
    expect(() => armarCifra(entrada("roas", { valor: null }))).toThrow(/siempre dice por qué/);
  });

  it("0 es cero", () => {
    const e = entrada("ventas", { valor: 0 });
    expect(armarCifra(e).textoDelValor).toBe("0");
    expect(fraseDe(e, "0")).toBe(FRASE_CERO);
  });

  it("sin datos todavía", () => {
    const e = entrada("facturacion", { valor: null, sinDatos: true, motivo: "La cohorte C7 aún no abre la venta." });
    expect(armarCifra(e).textoDelValor).toBe("Sin datos");
    expect(fraseDe(e, "Sin datos")).toBe(`La cohorte C7 aún no abre la venta. ${FRASE_SIN_DATOS}`);
  });

  it("sin objetivo cargado: valor sin color y «Sin color» al abrir, solo si el concepto admite objetivo", () => {
    const conObjetivo = entrada("agenda_venta", { valor: 0.08, partes: [7, 88] });
    expect(armarCifra(conObjetivo).estado).toBeNull();
    expect(fraseDe(conObjetivo, "Sin color")).toBe(FRASE_SIN_OBJETIVO);
    expect(fraseDe(entrada("ctr", { valor: 0.02 }), "Sin color")).toBeUndefined();
  });

  it("en curso", () => {
    const e = entrada("agendas", { valor: 31, enCurso: true, periodo: "la semana del 9 al 15 nov" });
    expect(armarCifra(e).etiquetas).toEqual(["En curso"]);
    expect(fraseDe(e, "En curso")).toBe("La semana del 9 al 15 nov todavía no termina: las cifras pueden subir y las tasas cambiar hasta que cierre.");
  });

  it("«—» por falta de gasto: no se divide con el gasto incompleto", () => {
    const e = entrada("roas", { valor: null, motivo: "El gasto de Meta solo está desde el 1 oct y el periodo empieza antes: dividir daría un ROAS inflado." });
    expect(armarCifra(e).textoDelValor).toBe("—");
    expect(fraseDe(e, "—")).toContain("dividir daría un ROAS inflado. «—» nunca significa cero.");
  });
});

describe("la barra de avance (diseño §1.1)", () => {
  const agendas = entrada("agendas", {
    valor: 412,
    periodo: "cohorte C6 hasta hoy",
    avance: { llevamos: 412, meta: 900, esperado: 558, fraccionDeTiempo: 0.62, de: "agendas" },
    estado: { fuente: "esperado", llevamos: 412, esperado: 558 },
    comparacion: { referencia: "C5 al mismo día", valor: 380 },
  });

  it("lleno, rayado del atraso, marca rotulada y lectura", () => {
    const c = armarCifra(agendas);
    expect(c.deMeta).toBe("de 900");
    expect(c.barra?.lleno).toBeCloseTo(412 / 900);
    expect(c.barra?.marca).toBeCloseTo(558 / 900);
    expect(c.barra?.atraso).toBeCloseTo(146 / 900);
    expect(c.barra?.rotuloDeMarca).toBe("a hoy 558");
    expect(c.barra?.lectura).toEqual({ antes: "Vamos ", cifra: "146", despues: " atrás" });
    expect(c.estado?.rotulo).toBe("En seguimiento");
    expect(c.ariaLabel).toBe("Agendadas: 412 de 900. Abrir cómo se calcula");
  });

  it("cómo leer la tarjeta sigue el orden visible", () => {
    expect(lectura(agendas).map(([r]) => r)).toEqual(["412", "de pauta", "de 900", "a hoy 558", "146 atrás", "En seguimiento", "Cambio"]);
    expect(fraseDe(agendas, "a hoy 558")).toBe("Lo que deberíamos llevar si avanzáramos parejo: 900 × 62 %, porque ya pasó el 62 % de los días hábiles de venta de la cohorte. Es la marca sobre la barra.");
    expect(fraseDe(agendas, "En seguimiento")).toBe("Llevamos 74 % de lo esperado a hoy. En meta desde 100 %, en seguimiento desde 65 %, rezagado por debajo.");
  });

  it("lo esperado a hoy lleva su decimal en una meta de cantidad", () => {
    const ventas = armarCifra(entrada("ventas", {
      valor: 21,
      avance: { llevamos: 21, meta: 55, esperado: 34.1, fraccionDeTiempo: 0.62, de: "ventas de pauta" },
    }));
    expect(ventas.barra?.rotuloDeMarca).toBe("a hoy 34,1");
    expect(ventas.barra?.lectura.cifra).toBe("13,1");
    expect(ventas.textoDelValor).toBe("21");
  });

  it("adelante: sin rayado", () => {
    const c = armarCifra({ ...agendas, avance: { ...agendas.avance!, llevamos: 600 }, valor: 600 });
    expect(c.barra?.atraso).toBe(0);
    expect(c.barra?.lectura.despues).toBe(" adelante");
  });
});

describe("fórmula, comparación y evidencia", () => {
  it("con los números de esta cifra, y × 1.000 en el CPM", () => {
    const costo = armarCifra(entrada("costo_agenda_crm", { valor: 44800, partes: [403200, 9] }));
    expect(costo.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: COP 403.200 ÷ 9 = COP 44.800");
    const cpm = armarCifra(entrada("cpm", { valor: 12000, partes: [1200000, 100000] }));
    expect(cpm.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: COP 1.200.000 ÷ 100.000 × 1.000 = COP 12.000");
    expect(armarCifra(entrada("ventas", { valor: 3 })).explicacion.formula.conLosNumeros).toBeNull();
  });

  it("el cambio va en cantidad y %, en puntos para una tasa, y en el mismo formato que el valor", () => {
    expect(textoDeCambio("conteo", 412, 380)).toBe("+32 (+8 %)");
    expect(textoDeCambio("porcentaje", 0.42, 0.4)).toBe("+2,0 puntos");
    expect(textoDeCambio("cop", 15_600_000, 14_100_000, true)).toBe("+COP 1,5 M (+11 %)");
    expect(textoDeCambio("conteo", 3, 0)).toBe("+3 (—)");
  });

  it("la evidencia: cinco filas, el botón con el total y la nota de la razón", () => {
    const filas = Array.from({ length: 8 }, (_, i) => [`Persona ${i}`]);
    const c = armarCifra(entrada("agenda_venta", { valor: 0.08, partes: [7, 88], lista: { href: "/x", nombre: "agendadas", total: 88, filas } }));
    expect(c.explicacion.evidencia?.filas).toHaveLength(5);
    expect(c.explicacion.evidencia?.boton).toBe("Ver las 88 agendadas");
    expect(c.explicacion.evidencia?.nota).toBe("Son las agendadas de abajo de la fórmula; la última columna dice cuáles suman arriba.");
  });
});
