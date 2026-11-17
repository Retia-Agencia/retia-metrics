import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Session } from "next-auth";
import {
  auditarCoberturaDeConceptos,
  CIFRAS_EN_EL_RESUMEN,
  CONCEPTOS_SIN_LISTA_EN_EL_MCP,
  TOPE_DE_CONCEPTOS_PENDIENTES_DEL_MCP,
  TOPE_DE_CONCEPTOS_SIN_LISTA_DEL_MCP,
  viaDeConceptoSinLista,
} from "@/lib/mcp/cobertura";
import { capacidadesMcp } from "@/lib/mcp/herramientas/capacidades";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { consultarMetricaMcp } from "@/lib/mcp/herramientas/metricas";
import { explicacionDe } from "@/lib/metricas/explicacion";
import { REGISTRO, type ClaveRegistrada } from "@/lib/metricas/registro";
import { METRICAS_DE_LISTA } from "@/lib/queries/filtros-de-lista";
import { salidaDeResumen } from "@/lib/mcp/salidas/resumen";

const SIN_HALLAZGOS = {
  sinCobertura: [],
  listasDesconocidas: [],
  excepcionesInexistentes: [],
  excepcionesConLista: [],
};

describe("cobertura de conceptos del MCP", () => {
  it("cubre cada concepto mediante consultar_metrica o una excepción justificada", () => {
    expect(auditarCoberturaDeConceptos(REGISTRO, METRICAS_DE_LISTA, CONCEPTOS_SIN_LISTA_EN_EL_MCP))
      .toEqual(SIN_HALLAZGOS);

    for (const ficha of Object.values(REGISTRO)) {
      for (const metrica of ficha.listas) {
        expect(consultarMetricaMcp.entrada.safeParse({ programa: "programa", metrica, periodo: "hoy" }).success, metrica)
          .toBe(true);
      }
    }
  });

  it("no conserva excepciones inexistentes ni conceptos que ya tienen lista", () => {
    const claves = Object.keys(CONCEPTOS_SIN_LISTA_EN_EL_MCP);
    expect(claves.every((clave) => clave in REGISTRO)).toBe(true);
    expect(claves.filter((clave) => REGISTRO[clave as ClaveRegistrada].listas.length > 0)).toEqual([]);
  });

  it("mantiene el trinquete de conceptos sin lista", () => {
    const conVia = Object.keys(CONCEPTOS_SIN_LISTA_EN_EL_MCP)
      .filter((clave) => viaDeConceptoSinLista(clave as ClaveRegistrada) !== "pendiente");
    expect(conVia.length)
      .toBeLessThanOrEqual(TOPE_DE_CONCEPTOS_SIN_LISTA_DEL_MCP);
  });

  it("mantiene aparte el trinquete de conceptos pendientes", () => {
    const pendientes = Object.keys(CONCEPTOS_SIN_LISTA_EN_EL_MCP)
      .filter((clave) => viaDeConceptoSinLista(clave as ClaveRegistrada) === "pendiente");
    expect(pendientes).toHaveLength(TOPE_DE_CONCEPTOS_PENDIENTES_DEL_MCP);
  });

  it("cada cifra registrada de resumen_del_hub apunta a una ruta real de su esquema", () => {
    const declaradas = Object.entries(CONCEPTOS_SIN_LISTA_EN_EL_MCP)
      .filter(([, razon]) => razon.startsWith("Cifra de resumen_del_hub:"))
      .map(([concepto]) => concepto);
    expect(declaradas.filter((concepto) => !(concepto in CIFRAS_EN_EL_RESUMEN)).sort())
      .toEqual([]);
    const desenvolver = (schema: z.ZodType): z.ZodType => {
      let actual = schema;
      while (actual instanceof z.ZodNullable || actual instanceof z.ZodOptional) {
        actual = actual.unwrap() as unknown as z.ZodType;
      }
      return actual;
    };
    const existe = (ruta: string) => {
      let actual: z.ZodType = salidaDeResumen;
      for (const segmento of ruta.split(".")) {
        actual = desenvolver(actual);
        if (!(actual instanceof z.ZodObject) || !(segmento in actual.shape)) return false;
        actual = actual.shape[segmento] as unknown as z.ZodType;
      }
      return true;
    };
    for (const [concepto, ruta] of Object.entries(CIFRAS_EN_EL_RESUMEN)) {
      expect(CONCEPTOS_SIN_LISTA_EN_EL_MCP[concepto as keyof typeof CONCEPTOS_SIN_LISTA_EN_EL_MCP], concepto)
        .toMatch(/^Cifra de resumen_del_hub:/);
      expect(existe(ruta), `${concepto}: ${ruta}`).toBe(true);
    }
  });

  it("muerde en los dos sentidos con fichas sintéticas", () => {
    const registro = { con_lista: { listas: ["lista"] }, sin_lista: { listas: [] } };
    expect(auditarCoberturaDeConceptos(registro, ["lista"], {})).toEqual({
      ...SIN_HALLAZGOS,
      sinCobertura: ["sin_lista"],
    });
    expect(auditarCoberturaDeConceptos(registro, ["lista"], { sin_lista: "Justificada." }))
      .toEqual(SIN_HALLAZGOS);
    expect(auditarCoberturaDeConceptos(registro, ["lista"], { con_lista: "Obsoleta.", inexistente: "Obsoleta." }))
      .toEqual({
        ...SIN_HALLAZGOS,
        excepcionesInexistentes: ["inexistente"],
        excepcionesConLista: ["con_lista"],
        sinCobertura: ["sin_lista"],
      });
    expect(auditarCoberturaDeConceptos({ pendiente: { listas: ["lista"] } }, ["lista"], {
      pendiente: "Pendiente en el MCP: todavía solo está en la app.",
    })).toEqual({ ...SIN_HALLAZGOS, excepcionesConLista: ["pendiente"] });
    expect(auditarCoberturaDeConceptos({ rota: { listas: ["otra"] } }, ["lista"], {}))
      .toEqual({ ...SIN_HALLAZGOS, listasDesconocidas: ["rota:otra"] });
  });

  it("capacidades publica literalmente la explicación canónica", async () => {
    const rol = "developer" as const;
    const session = { user: { id: "dev", email: "dev@retia.test", name: "Dev", rol, operaComoCloser: false, closerId: null, alcanceLimitado: false } } as Session;
    const contexto = { db: {} as never, session, rol, tokenId: "token", escritura: false } satisfies ContextoMcp;
    const pedido = capacidadesMcp.entrada.parse({ concepto: "ventas" });
    const respuesta = await capacidadesMcp.ejecutar(contexto, pedido);
    const concepto = respuesta.estructurado.concepto as { que: string; formula: unknown };
    expect(concepto.que).toEqual(explicacionDe("ventas").que);
    expect(concepto.formula).toEqual(explicacionDe("ventas").formula);
  });

  it("capacidades dirige ticket_perdido al resumen del Hub", async () => {
    const rol = "developer" as const;
    const session = { user: { id: "dev", email: "dev@retia.test", name: "Dev", rol, operaComoCloser: false, closerId: null, alcanceLimitado: false } } as Session;
    const contexto = { db: {} as never, session, rol, tokenId: "token", escritura: false } satisfies ContextoMcp;
    const respuesta = await capacidadesMcp.ejecutar(contexto, capacidadesMcp.entrada.parse({ concepto: "ticket_perdido" }));
    expect(respuesta.texto).not.toContain("todavía solo está disponible en la app");
    expect((respuesta.estructurado.concepto as { via: string[] } | undefined)?.via).toEqual(["resumen_del_hub"]);
  });
});
