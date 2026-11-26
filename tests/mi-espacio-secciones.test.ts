import { describe, expect, it } from "vitest";
import {
  seccionPedida,
  seccionesDeRol,
  type SeccionId,
} from "@/lib/mi-espacio/secciones";
import type { Rol } from "@/lib/auth/roles";

/**
 * Ticket 179 — el registro PURO de secciones de Mi espacio: qué ve cada rol, dirigido por
 * una tabla y por las preguntas de capacidad de `roles.ts` (nunca `rol === "..."`).
 */

const ids = (rol: Rol | null, operaComoCloser = false): SeccionId[] =>
  seccionesDeRol({ rol, operaComoCloser }).map((s) => s.id);

describe("seccionesDeRol: qué ve cada rol", () => {
  it("el closer ve Mi día, Métricas e Info, en orden", () => {
    expect(ids("closer")).toEqual(["mi-dia", "metricas", "info"]);
  });

  it("el paid trafficker ve Info y Canales", () => {
    expect(ids("paid_trafficker")).toEqual(["canales", "info"]);
  });

  it("el gerente ve Info y Por decidir: administra pero no trabaja leads (ADR 0003)", () => {
    expect(ids("gerente")).toEqual(["por-decidir", "info"]);
  });

  it("el gerente que opera como closer conserva Por decidir y suma las secciones de closer", () => {
    expect(ids("gerente", true)).toEqual(["mi-dia", "metricas", "por-decidir", "info"]);
  });

  it("el developer (acceso total) cae en la unión: Mi día, Info y Métricas", () => {
    // El developer responde `true` a `trabajaLeads`, `manejaPauta` y `esAdministrador`.
    // `info` lo habilita (cualquiera de las tres), `mi-dia` y `metricas`
    // por `trabajaLeads`; `canales` exige `!esAdministrador && !trabajaLeads` y
    // `por-decidir` excluye acceso total, así que ambas lo dejan fuera. La página NO las usa
    // en vista `todo`: `esAccesoTotal` corta antes y muestra el mensaje; en vista
    // `gerente`/`closer` el rol de vista ya es ese rol.
    expect(ids("developer")).toEqual(["mi-dia", "metricas", "info"]);
  });

  it("sin rol no hay secciones", () => {
    expect(ids(null)).toEqual([]);
  });

});

describe("seccionPedida: la pedida si el rol la cumple, si no la por defecto", () => {

  it("el closer sin ?tab cae en Mi día", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, undefined)?.id).toBe("mi-dia");
  });

  it("el closer puede pedir Métricas", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, "metricas")?.id).toBe("metricas");
  });

  it("un closer que forja ?tab=canales NO la ve: cae en la por defecto", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, "canales")?.id).toBe("mi-dia");
  });

  it("un closer que forja ?tab=por-decidir tampoco: cae en la por defecto", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, "por-decidir")?.id).toBe("mi-dia");
  });

  it("el paid trafficker sin ?tab cae en Canales (su por defecto, no Info)", () => {
    expect(seccionPedida({ rol: "paid_trafficker", operaComoCloser: false }, undefined)?.id).toBe("canales");
    expect(seccionPedida({ rol: "paid_trafficker", operaComoCloser: false }, "mi-dia")?.id).toBe("canales");
  });

  it("el gerente sin ?tab cae en Por decidir (su por defecto, no Info)", () => {
    expect(seccionPedida({ rol: "gerente", operaComoCloser: false }, undefined)?.id).toBe("por-decidir");
    expect(seccionPedida({ rol: "gerente", operaComoCloser: false }, "deals")?.id).toBe("por-decidir");
  });

  it("sin rol no hay sección que mostrar", () => {
    expect(seccionPedida({ rol: null, operaComoCloser: false }, "mi-dia")).toBeNull();
  });
});
