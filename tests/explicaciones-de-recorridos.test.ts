import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cifrasDeAuditoria,
  cifrasDeCaminos,
  cifrasDeEscalera,
  cifrasDelEmbudoComercial,
} from "@/lib/hub/cifras-de-recorridos";
import { explicacionesDeRecorridos } from "@/lib/metricas/explicacion";
import {
  ESCALONES,
  GRUPOS_DE_CIERRE,
  NOMBRE_DE_ESCALON,
  NOMBRE_DE_GRUPO_DE_CIERRE,
  type Escalon,
  type GrupoDeCierre,
} from "@/lib/escalones";
import type { ResultadoEmbudoEtapas } from "@/lib/queries/embudo-etapas";
import type { CeldaDeEscalera, FilaDeEscalera, VistaDeEscalera } from "@/lib/queries/vista-escalera";

const contexto = {
  programa: "Comunicarte",
  cohorte: null,
  rango: { desde: "2026-11-01", hasta: "2026-11-14" },
  hoy: "2026-11-14",
  closer: null,
};

const celda = (): CeldaDeEscalera => ({
  deals: 0,
  porcentaje: { tipo: "tasa", valor: null },
  diasMedianos: null,
  anterior: null,
  detalle: null,
});

function celdas<K extends Escalon | GrupoDeCierre>(claves: readonly K[]): Record<K, CeldaDeEscalera> {
  return claves.reduce<Record<K, CeldaDeEscalera>>((resultado, clave) => {
    resultado[clave] = celda();
    return resultado;
  }, {} as Record<K, CeldaDeEscalera>);
}

const fila: FilaDeEscalera = {
  clave: "",
  etiqueta: "Todos",
  esSinDueno: false,
  total: 0,
  celdas: celdas(ESCALONES),
  grupos: celdas(Object.keys(GRUPOS_DE_CIERRE) as GrupoDeCierre[]),
  citaSinResultado: celda(),
};

const vista: VistaDeEscalera = {
  corteDias: 2,
  sinCorte: false,
  principal: fila,
  porCloser: [],
  porCalidad: [],
  hayComparacion: false,
};

const lecturaVacia = { entraron: 0, dealIds: [], pasos: [] };
const embudo: ResultadoEmbudoEtapas = {
  conversion: {
    todas: lecturaVacia,
    sinNoCalificados: lecturaVacia,
    porPuerta: [],
    porCamino: [{
      camino: "setter",
      pasos: [{
        camino: "setter",
        etapa: "en_gestion",
        llegaron: 1,
        dealIds: ["deal-1"],
        pasaron: 0,
        pasaronDealIds: [],
        siguenAqui: 1,
        siguenAquiDealIds: ["deal-1"],
        perdidosAqui: 0,
        perdidosAquiDealIds: [],
      }],
    }],
  },
  tiempoEnEtapa: [],
  abiertos: [],
  sinDuenoPorAntiguedad: [],
  motivosDePerdida: [{
    motivo: "Precio",
    deals: 1,
    dealIds: ["deal-2"],
    ticketPerdidoUsd: 797,
    dealsSinTicket: 0,
    moneda: "USD",
  }],
};

const clavesFijas = [
  "porcentaje_de_escalera", "dias_medianos_de_escalera", "cita_sin_resultado_de_escalera",
  "embudo_comercial_creados", "embudo_comercial_agendaron", "embudo_comercial_tuvieron_show", "embudo_comercial_compraron",
  "conversion_del_paso", "perdidos_del_paso", "pasaron", "siguen_en_etapa", "perdidos_en_etapa",
  "dias_medianos_en_etapa", "citas_futuras", "deals_perdidos", "ticket_perdido",
  "shows", "no_asistio", "citas_sin_marcar", "deals_abiertos", "deals_sin_dueno",
] as const;

describe("explicaciones de los recorridos de Comercial", () => {
  it("mantiene puros el catálogo y el constructor de explicaciones", () => {
    for (const archivo of ["lib/metricas/explicacion.ts", "lib/escalones.ts"]) {
      const importsDeValor = readFileSync(archivo, "utf8")
        .split(";")
        .map((sentencia) => sentencia.trim())
        .filter((sentencia) => /^import\s+(?!type\b)/.test(sentencia));
      expect(importsDeValor.filter((sentencia) => /@\/lib\/(db|queries)(?:\/|\")/.test(sentencia)), archivo).toEqual([]);
    }
  });

  it("empareja cada escalón y grupo con la variable de su mismo nombre", () => {
    const explicaciones = explicacionesDeRecorridos();
    for (const clave of ESCALONES) {
      expect(explicaciones[clave].variables.map(({ nombre }) => nombre)).toEqual([NOMBRE_DE_ESCALON[clave]]);
    }
    for (const clave of Object.keys(GRUPOS_DE_CIERRE) as GrupoDeCierre[]) {
      expect(explicaciones[clave].variables.map(({ nombre }) => nombre)).toEqual([NOMBRE_DE_GRUPO_DE_CIERRE[clave]]);
    }
  });

  it("cubre cada clave con qué mide y fórmula", () => {
    const explicaciones = explicacionesDeRecorridos();
    const claves = [...ESCALONES, ...Object.keys(GRUPOS_DE_CIERRE), ...clavesFijas];

    for (const clave of claves) {
      expect(explicaciones[clave], clave).toBeDefined();
      expect(explicaciones[clave]?.que.trim(), clave).not.toBe("");
      expect(explicaciones[clave]?.formula.terminos.length, clave).toBeGreaterThan(0);
    }

    expect(explicaciones.porcentaje_de_escalera.unidad).toBe("porcentaje");
    expect(explicaciones.conversion_del_paso.unidad).toBe("porcentaje");
    expect(explicaciones.dias_medianos_de_escalera.unidad).toBe("dias");
    expect(explicaciones.dias_medianos_en_etapa.unidad).toBe("dias");
    expect(explicaciones.ticket_perdido.unidad).toBe("usd");
  });

  it("alimenta los cuatro constructores sin explicaciones faltantes", () => {
    const explicaciones = explicacionesDeRecorridos();
    expect(() => cifrasDeEscalera({ contexto, explicaciones, vista })).not.toThrow();
    expect(() => cifrasDelEmbudoComercial({
      contexto,
      explicaciones,
      origen: "todos",
      pasos: [
        { paso: "creados", cantidad: 2, dealIds: ["1", "2"], pctDelPaso: 1, perdidos: 0 },
        { paso: "agendaron", cantidad: 1, dealIds: ["1"], pctDelPaso: 0.5, perdidos: 1 },
        { paso: "tuvieron_show", cantidad: 1, dealIds: ["1"], pctDelPaso: 1, perdidos: 0 },
        { paso: "compraron", cantidad: 1, dealIds: ["1"], pctDelPaso: 1, perdidos: 0 },
      ],
    })).not.toThrow();
    expect(() => cifrasDeCaminos({ contexto, explicaciones, embudo })).not.toThrow();
    expect(() => cifrasDeAuditoria({ contexto, explicaciones, embudo, ventasSinLlamada: celda() })).not.toThrow();
  });
});
