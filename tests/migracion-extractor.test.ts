import { describe, expect, it } from "vitest";
import { monto, siNo } from "@/lib/migracion/celdas";
import { extraerSetteo } from "@/lib/migracion/extraer-setteo";
import { extraerLlamadas } from "@/lib/migracion/extraer-llamadas";
import { extraerEstudiantes } from "@/lib/migracion/extraer-estudiantes";
import { juntar } from "@/lib/migracion/template";

/**
 * Ticket 078 paso 3 — el extractor, puro sobre matrices. Los encabezados son los REALES de
 * las pestañas (leidos el 29-sep con `npm run inspeccionar`); los datos son inventados.
 */

// ─────────────────────────────────────────── celdas

describe("celdas", () => {
  it("lee los formatos de monto de las hojas y rechaza lo que no es numero", () => {
    expect(monto("$1,500")).toBe("1500.00");
    expect(monto("1300")).toBe("1300.00");
    expect(monto("697")).toBe("697.00");
    expect(monto("1.500")).toBe("1500.00");
    expect(monto("797,50")).toBe("797.50");
    expect(monto("Ya pago")).toBeNull();
    expect(monto("#N/A")).toBeNull();
    expect(monto("")).toBeNull();
  });

  it("Si/No sin mayusculas ni acentos; otro texto no se adivina", () => {
    expect(siNo("Sí")).toBe("si");
    expect(siNo("si")).toBe("si");
    expect(siNo("no")).toBe("no");
    expect(siNo("")).toBe("vacio");
    expect(siNo("tal vez")).toBe("otro");
  });
});

// ─────────────────────────────────────────── Setteo

const CAB_SETTEO_CA = [
  "Fecha detección", "Nombre", "WhatsApp", "Correo", "Situación profesional", "Ingresos mensuales",
  "Disposición pago", "Closer asignado", "Estado gestión", "Fecha de contacto",
  "Registro 1", "Registro 2", "Registro 3", "Registro 4", "Registro 5",
];
const CAB_SETTEO_TI = [
  "Columna 1", "Nombre", "WhatsApp", "Correo", "Situación profesional", "Ingresos mensuales",
  "Disposición pago", "Estado gestión", "Responsable", "Fecha de contacto", "Registro 1",
  "Fecha de ultimo contacto", "Registro 2", "Registro 3", "Registro 4", "Registro 5",
];

function filaCA(o: { fecha?: string; correo?: string; closer?: string; estado?: string; contacto?: string; r1?: string; r2?: string }) {
  return [o.fecha ?? "", "Nombre", "300", o.correo ?? "", "", "", "", o.closer ?? "", o.estado ?? "", o.contacto ?? "", o.r1 ?? "", o.r2 ?? "", "", "", ""];
}

const OP = { programa: "prog-a", hoy: "2026-09-29", alcance: "trabajado-y-reciente" as const, diasDeCorte: 30 };

describe("extraerSetteo (decision de Mani del 28-sep)", () => {
  it("En proceso → deal En Contacto con el closer como texto y sus notas", () => {
    const r = extraerSetteo(
      [CAB_SETTEO_CA, filaCA({ fecha: "1/08/2026", correo: "Ana@Correo.co", closer: "Andrea", estado: "En proceso", contacto: "5/08/2026", r1: "Le escribí", r2: "No contesta" })],
      OP,
    );
    expect(r.deals).toHaveLength(1);
    expect(r.deals[0]).toMatchObject({
      huella: "sheets:prog-a:setteo:ana@correo.co",
      correo: "ana@correo.co",
      etapa: "en_contacto",
      closer: "Andrea",
    });
    expect(r.deals[0].notas.map((n) => n.texto)).toEqual(["Registro 1: Le escribí", "Registro 2: No contesta"]);
    // El Registro 1 lleva la fecha de contacto; el del medio/ultimo sin "ultimo contacto" no lleva.
    expect(r.deals[0].notas[0].fecha).not.toBeNull();
    expect(r.deals[0].notas[1].fecha).toBeNull();
    expect(r.rarezas).toEqual([]);
  });

  it("Pendiente reciente sin actividad → deal; viejo → sin deal; total → deal", () => {
    const m = [
      CAB_SETTEO_CA,
      filaCA({ fecha: "20/09/2026", correo: "nuevo@c.co", estado: "Pendiente" }),
      filaCA({ fecha: "1/07/2026", correo: "viejo@c.co", estado: "Pendiente" }),
    ];
    const r = extraerSetteo(m, OP);
    expect(r.deals.map((d) => d.correo)).toEqual(["nuevo@c.co"]);
    expect(r.deals[0].etapa).toBe("pendiente_setteo");
    expect(r.sinDeal).toEqual([{ huella: "sheets:prog-a:setteo:viejo@c.co", razon: "pendiente_viejo_sin_actividad" }]);

    const total = extraerSetteo(m, { ...OP, alcance: "total" });
    expect(total.deals.map((d) => d.correo)).toEqual(["nuevo@c.co", "viejo@c.co"]);
  });

  it("un Pendiente viejo con solo `Fecha de ultimo contacto` es trabajado (revision de Codex)", () => {
    const fila = ["1/07/2026", "N", "3", "t@c.co", "", "", "", "Pendiente", "Jero", "", "", "20/09/2026", "", "", "", ""];
    const r = extraerSetteo([CAB_SETTEO_TI, fila], OP);
    expect(r.deals.map((d) => d.etapa)).toEqual(["pendiente_setteo"]);
    expect(r.rarezas.map((x) => x.tipo)).toEqual(["pendiente_con_notas"]);
    expect(r.sinDeal).toEqual([]);
  });

  it("Pendiente con notas → Pendiente Setteo y rareza, no se adivina la etapa", () => {
    const r = extraerSetteo([CAB_SETTEO_CA, filaCA({ fecha: "1/07/2026", correo: "a@c.co", estado: "Pendiente", r1: "hablé" })], OP);
    expect(r.deals[0].etapa).toBe("pendiente_setteo");
    expect(r.rarezas.map((x) => x.tipo)).toEqual(["pendiente_con_notas"]);
  });

  it("No interesado y Cerrado → sin deal aunque tengan actividad", () => {
    const r = extraerSetteo(
      [
        CAB_SETTEO_CA,
        filaCA({ correo: "a@c.co", estado: "No interesado", r1: "dijo que no" }),
        filaCA({ correo: "b@c.co", estado: "Cerrado" }),
      ],
      OP,
    );
    expect(r.deals).toEqual([]);
    expect(r.sinDeal.map((s) => s.razon)).toEqual(["no_interesado", "cerrado"]);
  });

  it("Agendado → En Contacto marcado; estado raro, sin correo y repetido → rareza, ninguna en silencio", () => {
    const r = extraerSetteo(
      [
        CAB_SETTEO_CA,
        filaCA({ correo: "a@c.co", estado: "Agendado" }),
        filaCA({ correo: "b@c.co", estado: "Andrea" }),
        filaCA({ correo: "", estado: "En proceso" }),
        filaCA({ correo: "a@c.co", estado: "En proceso" }),
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ],
      OP,
    );
    expect(r.deals.map((d) => [d.correo, d.etapa])).toEqual([["a@c.co", "en_contacto"]]);
    expect(r.rarezas.map((x) => x.tipo)).toEqual(["agendado_por_decidir", "estado_desconocido", "sin_correo", "correo_repetido"]);
    expect(r.rarezas[2].huella).toBe("sheets:prog-a:setteo:fila-4");
  });

  it("Tactical: `Columna 1` es la deteccion, `Responsable` el closer, y el ultimo Registro lleva la fecha de ultimo contacto", () => {
    const fila = ["20/09/2026", "N", "3", "t@c.co", "", "", "", "En proceso", "Jero", "2/09/2026", "uno", "10/09/2026", "dos", "", "", ""];
    const r = extraerSetteo([CAB_SETTEO_TI, fila], OP);
    expect(r.deals[0]).toMatchObject({ closer: "Jero", etapa: "en_contacto" });
    const [n1, n2] = r.deals[0].notas;
    expect(n1.fecha).toBe(new Date("2026-09-02T00:00:00-05:00").toISOString());
    expect(n2.fecha).toBe(new Date("2026-09-10T00:00:00-05:00").toISOString());
    // La etapa entro con el ultimo contacto.
    expect(r.deals[0].fechaEtapa).toBe(n2.fecha);
  });

  it("sin columna de correo o de estado falla ruidosamente", () => {
    expect(() => extraerSetteo([["Fecha", "Estado gestión"]], OP)).toThrow(/correo/);
  });
});

// ─────────────────────────────────────────── Registro de llamadas

const CAB_LLAMADAS_TI = [
  "Fecha", "Closer", "Nombre Lead", "WhatsApp", "Correo", "Show", "Cierre", "Link de la llamada",
  "Registro 1", "Registro 2", "Registro 3", "Registro 4", "Registro 5", "Categoría", "Subcategoría", "Cartera",
];
// ComunicArte, con los encabezados corridos: J dice Subcategoría y es el Registro 3.
const CAB_LLAMADAS_CA = [
  "Fecha", "Closer", "Nombre Lead", "Correo", "WhatsApp", "Show", "Cierre", "Registro 1", "Registro 2",
  "Subcategoría", "Registro 4", "Registro 5", "Categoría", "Subcategoría", "Cartera", "Link de la llamada",
];

describe("extraerLlamadas", () => {
  const ti = (show: string, cierre: string, correo = "a@c.co", fecha = "10/08/2026 15:00") =>
    [fecha, "Andrea", "N", "3", correo, show, cierre, "https://grain.co/x", "r1", "", "", "", "", "FOLLOW UP", "FU-3", ""];

  it("el resultado sale de Show y Cierre; la huella es la fila de la hoja", () => {
    const r = extraerLlamadas(
      [CAB_LLAMADAS_TI, ti("No", ""), ti("Sí", "Sí"), ti("si", "no"), ti("Sí", "")],
      { programa: "prog-a" },
    );
    expect(r.llamadas.map((l) => l.resultado)).toEqual(["no_show", "cerrada", "show", "show"]);
    expect(r.llamadas.map((l) => l.huella)).toEqual([2, 3, 4, 5].map((n) => `sheets:prog-a:registro:${n}`));
    expect(r.llamadas[0]).toMatchObject({ closer: "Andrea", categoria: "FOLLOW UP", subcategoria: "FU-3", link: "https://grain.co/x", notas: "Registro 1: r1" });
    expect(r.rarezas).toEqual([]);
  });

  it("Show vacio, valor raro, sin correo y sin fecha entran igual y quedan marcados", () => {
    const r = extraerLlamadas(
      [CAB_LLAMADAS_TI, ti("", ""), ti("tal vez", ""), ti("No", "", ""), ti("No", "", "b@c.co", "")],
      { programa: "prog-a" },
    );
    expect(r.llamadas).toHaveLength(4);
    expect(r.llamadas[0].resultado).toBe("agendada");
    expect(r.rarezas.map((x) => x.tipo)).toEqual(["sin_resultado", "valor_desconocido", "sin_correo", "sin_fecha"]);
  });

  it("Tactical con columnas cruzadas: el correo en WhatsApp se toma solo si Correo no trae uno", () => {
    const cruzada = ["10/08/26", "Andrea", "N", "x@c.co", "+573001112233", "No", "", "", "", "", "", "", "", "", "", ""];
    const normal = ["10/08/26", "Andrea", "N", "otro@c.co", "y@c.co", "No", "", "", "", "", "", "", "", "", "", ""];
    const r = extraerLlamadas([CAB_LLAMADAS_TI, cruzada, normal], { programa: "prog-a" });
    expect(r.llamadas.map((l) => l.correo)).toEqual(["x@c.co", "y@c.co"]);
    // Y la fecha con ano de dos digitos se lee.
    expect(r.llamadas[0].fecha).toBe("2026-08-10T05:00:00.000Z");
    expect(r.rarezas).toEqual([]);
  });

  it("ComunicArte: la primera Subcategoría es el Registro 3 y la ultima la subcategoria de verdad", () => {
    const fila = ["10/08/2026", "Andrea", "N", "a@c.co", "3", "Sí", "No", "r1", "r2", "pendiente onboarding", "", "", "FINANCIERO", "FIN-1", "debe 200", "https://grain.co/y"];
    const r = extraerLlamadas([CAB_LLAMADAS_CA, fila], { programa: "prog-b" });
    expect(r.llamadas[0].subcategoria).toBe("FIN-1");
    expect(r.llamadas[0].notas).toBe("Registro 1: r1\nRegistro 2: r2\nRegistro 3: pendiente onboarding\nCartera: debe 200");
    expect(r.llamadas[0].link).toBe("https://grain.co/y");
  });
});

// ─────────────────────────────────────────── Estudiantes

const CAB_JULIO_TI = [
  "Nombre completo", "WhatsApp", "Correo", "Situación profesional", "Closer", "Precio", "Tipo de pago",
  "Plataforma de pago", "Factura electrónica", "Mail/ Mensaje onboarding", "Acceso WhatsApp",
  "Acceso Plataforma", "Link llamada", "Origen", "PENDIENTES DE BONOS",
];
const CAB_SEPT_CA = [
  "x", "Numero de asistentes", "Nombre completo", "Cédula", "Correo", "WhatsApp", "Closer", "Cash collected",
  "Precio final", "Tipo de pago", "Plataforma de pago", "Factura electrónica", "Mail onboarding",
  "Acceso WhatsApp", "Acceso Plataforma", "Link llamada",
];

describe("extraerEstudiantes (ADR 0059 puntos 6 y 7)", () => {
  const julio = (correo: string, precio: string, tipo: string, situacion = "") =>
    ["N", "3", correo, situacion, "Jero", precio, tipo, "Hotmart", "", "Si", "", "", "", "#N/A", ""];
  const OPJ = { programa: "prog-a", pestana: "estudiantes-julio", cohorte: "C1", situacionEsAcuerdoDePago: true };

  it("Julio Total → Completo con un abono por el precio y fecha aproximada", () => {
    const r = extraerEstudiantes([CAB_JULIO_TI, julio("a@c.co", "$1,500", "Total")], OPJ);
    expect(r.deals[0]).toMatchObject({ etapa: "completo", cohorte: "C1", precio: "1500.00", mailOnboarding: true, closer: "Jero" });
    expect(r.abonos).toEqual([
      { huella: "sheets:prog-a:estudiantes-julio:a@c.co:abono", dealHuella: "sheets:prog-a:estudiantes-julio:a@c.co", fecha: null, monto: "1500.00", plataforma: "Hotmart", closer: "Jero" },
    ]);
    expect(r.rarezas.map((x) => x.tipo)).toEqual(["fecha_aproximada"]);
  });

  it("Julio Parcial y `Ya pago` → Compromiso Verbal, sin abono, con rareza; la nota de pago es el acuerdo", () => {
    const r = extraerEstudiantes(
      [CAB_JULIO_TI, julio("a@c.co", "$1,500", "Parcial", "segundo pago 17 de agosto"), julio("b@c.co", "Ya pago", "Total")],
      OPJ,
    );
    expect(r.deals.map((d) => d.etapa)).toEqual(["compromiso_verbal", "compromiso_verbal"]);
    expect(r.deals[0].acuerdoPago).toBe("segundo pago 17 de agosto");
    expect(r.abonos).toEqual([]);
    expect(r.rarezas.map((x) => x.tipo)).toEqual(["monto_cobrado_desconocido", "monto_cobrado_desconocido", "precio_desconocido"]);
  });

  it("Septiembre CA: cash y precio final deciden Abonado/Completo, y la columna `x` es la fecha", () => {
    const sept = (x: string, correo: string, cash: string, precio: string) =>
      [x, "1", "N", "123", correo, "3", "Andrea", cash, precio, "parcial", "mercadopago", "", "", "", "", ""];
    const r = extraerEstudiantes(
      [CAB_SEPT_CA, sept("5/09/2026", "a@c.co", "400", "797"), sept("6/09/2026", "b@c.co", "797", "797")],
      { programa: "prog-b", pestana: "estudiantes-septiembre", cohorte: "C2" },
    );
    expect(r.deals.map((d) => d.etapa)).toEqual(["abonado", "completo"]);
    expect(r.deals[0].acuerdoPago).toBeNull();
    expect(r.abonos.map((a) => [a.fecha, a.monto])).toEqual([["2026-09-05", "400.00"], ["2026-09-06", "797.00"]]);
    expect(r.rarezas).toEqual([]);
  });

  it("juntar suma lo de varias pestañas sin perder nada", () => {
    const a = extraerEstudiantes([CAB_JULIO_TI, julio("a@c.co", "1500", "Total")], OPJ);
    const b = extraerLlamadas([CAB_LLAMADAS_TI, ["10/08/2026", "A", "N", "3", "a@c.co", "No", "", "", "", "", "", "", "", "", "", ""]], { programa: "prog-a" });
    const t = juntar(a, b);
    expect([t.deals.length, t.abonos.length, t.llamadas.length, t.rarezas.length]).toEqual([1, 1, 1, 1]);
  });
});
