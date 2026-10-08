import { describe, expect, it } from "vitest";
import { hayFiltrosActivos, siguienteQuery } from "@/components/filtros/query";
import {
  activosEnPopover,
  cambiosParaQuitar,
  clavesABorrar,
  clavesDelPopover,
  etiquetaDelValor,
  etiquetasActivas,
  filtroActivo,
  hayAlgunActivo,
  valorDeFiltro,
  type FiltroDeclarado,
  type LectorDeUrl,
} from "@/components/filtros/declaracion";

describe("filtros en la URL", () => {
  it("conserva otros parámetros y aplica los cambios", () => {
    expect(siguienteQuery("programa=uno&closer=viejo", { closer: "nuevo" })).toBe(
      "programa=uno&closer=nuevo",
    );
  });

  it.each([null, ""])("borra un parámetro con %j", (valor) => {
    expect(siguienteQuery("closer=uno&resultado=venta", { closer: valor })).toBe("resultado=venta");
  });

  it("siempre elimina la página", () => {
    expect(siguienteQuery("pagina=4&closer=uno", { resultado: "venta" })).toBe(
      "closer=uno&resultado=venta",
    );
  });

  it("quita varios filtros a la vez", () => {
    expect(siguienteQuery("closer=uno&desde=2026-10-01&orden=reciente&pagina=2", {
      closer: null,
      desde: null,
    })).toBe("orden=reciente");
  });

  it("detecta solo filtros con valor", () => {
    expect(hayFiltrosActivos("closer=&pagina=2&resultado=venta", ["closer", "resultado"])).toBe(true);
    expect(hayFiltrosActivos(new URLSearchParams("closer=&pagina=2"), ["closer", "resultado"])).toBe(false);
  });
});

describe("la barra de lista deriva todo de las declaraciones (ticket 202)", () => {
  const deal: FiltroDeclarado = {
    tipo: "select",
    nombre: "deal",
    etiqueta: "Deal",
    opciones: [
      { value: "con", label: "Con deal" },
      { value: "sin", label: "Sin deal" },
    ],
  };
  const calidad: FiltroDeclarado = {
    tipo: "select",
    nombre: "calidad",
    etiqueta: "Calidad",
    todos: "Todas",
    opciones: [
      { value: "high", label: "High" },
      { value: "low", label: "Low" },
    ],
  };
  // Un filtro compuesto: una entrada, varias claves de la URL.
  const fecha: FiltroDeclarado = {
    tipo: "select",
    nombre: "fecha",
    etiqueta: "Fecha",
    opciones: [{ value: "creado", label: "Creado" }],
    clavesExtra: ["periodo", "a_desde", "a_hasta"],
  };
  const filtros = [deal, calidad, fecha];
  const cohorte: FiltroDeclarado = {
    tipo: "select",
    nombre: "cohorte",
    etiqueta: "Cohorte",
    todos: "Todas las cohortes",
    valorTodos: "todas",
    porDefecto: { valor: "c-activa", etiqueta: "Cohorte activa", valorTodos: "todas" },
    opciones: [{ value: "c-activa", label: "Octubre" }],
  };
  const leerDe = (query: string): LectorDeUrl => {
    const params = new URLSearchParams(query);
    return (nombre) => params.get(nombre);
  };

  it("lee el valor vigente y lo trata '' como ausente", () => {
    expect(valorDeFiltro(deal, leerDe("deal=con"))).toBe("con");
    expect(valorDeFiltro(deal, leerDe("deal="))).toBeNull();
    expect(valorDeFiltro(deal, leerDe(""))).toBeNull();
  });

  it("traduce un valor a su etiqueta legible, y cae al valor crudo si no está", () => {
    expect(etiquetaDelValor(deal, "con")).toBe("Con deal");
    expect(etiquetaDelValor(deal, "desconocido")).toBe("desconocido");
  });

  it("sabe si un filtro está activo", () => {
    expect(filtroActivo(deal, leerDe("deal=con"))).toBe(true);
    expect(filtroActivo(deal, leerDe("calidad=high"))).toBe(false);
  });

  it("'Filtros · n' cuenta todos los filtros declarados activos", () => {
    expect(activosEnPopover(filtros, leerDe("deal=con"))).toBe(1);
    expect(activosEnPopover(filtros, leerDe("deal=con&calidad=high"))).toBe(2);
    expect(activosEnPopover(filtros, leerDe("calidad=high&fecha=creado"))).toBe(2);
  });

  it("cuenta y etiqueta un filtro aplicado por defecto", () => {
    expect(valorDeFiltro(cohorte, leerDe(""))).toBe("c-activa");
    expect(activosEnPopover([cohorte], leerDe(""))).toBe(1);
    expect(etiquetasActivas([cohorte], leerDe(""))[0]).toMatchObject({
      valor: "c-activa",
      texto: "Cohorte activa",
    });
    expect(valorDeFiltro(cohorte, leerDe("cohorte=todas"))).toBeNull();
  });

  it("quitar el chip de un default escribe el valor explicito de todos", () => {
    const [activa] = etiquetasActivas([cohorte], leerDe(""));
    expect(siguienteQuery("", activa!.cambiosAlQuitar)).toBe("cohorte=todas");
    expect(cambiosParaQuitar([cohorte])).toEqual({ cohorte: "todas" });
  });

  it("quitar un filtro sin default conserva el comportamiento de borrar el parametro", () => {
    const [activa] = etiquetasActivas([deal], leerDe("deal=con"));
    expect(activa!.cambiosAlQuitar).toEqual({ deal: null });
    expect(cambiosParaQuitar([deal])).toEqual({ deal: null });
  });

  it("las claves a borrar salen de las declaraciones, con las extras y sin duplicar", () => {
    expect(clavesABorrar(filtros)).toEqual(["deal", "calidad", "fecha", "periodo", "a_desde", "a_hasta"]);
  });

  it("'Quitar filtros' del popover abarca todas las claves declaradas", () => {
    expect(clavesDelPopover(filtros)).toEqual(["deal", "calidad", "fecha", "periodo", "a_desde", "a_hasta"]);
  });

  it("las etiquetas activas conservan el orden de la declaración y traen sus claves", () => {
    const activas = etiquetasActivas(filtros, leerDe("calidad=high&deal=con&fecha=creado"));
    expect(activas.map((a) => a.nombre)).toEqual(["deal", "calidad", "fecha"]);
    expect(activas[0]).toMatchObject({ etiqueta: "Deal", valor: "con", texto: "Con deal", claves: ["deal"] });
    expect(activas[2].claves).toEqual(["fecha", "periodo", "a_desde", "a_hasta"]);
  });

  it("hayAlgunActivo mira a la vista y popover", () => {
    expect(hayAlgunActivo(filtros, leerDe(""))).toBe(false);
    expect(hayAlgunActivo(filtros, leerDe("pagina=2"))).toBe(false);
    expect(hayAlgunActivo(filtros, leerDe("calidad=high"))).toBe(true);
  });
});
