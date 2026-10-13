import { describe, expect, it } from "vitest";
import {
  SECCIONES,
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
  it("el closer ve Info, Notificaciones y Métricas, en orden", () => {
    expect(ids("closer")).toEqual(["info", "notificaciones", "metricas"]);
  });

  it("el paid trafficker ve Info y Canales", () => {
    expect(ids("paid_trafficker")).toEqual(["info", "canales"]);
  });

  it("el gerente ve Info y Por decidir: administra pero no trabaja leads (ADR 0003)", () => {
    expect(ids("gerente")).toEqual(["info", "por-decidir"]);
  });

  it("el gerente que opera como closer conserva Por decidir y suma las secciones de closer", () => {
    expect(ids("gerente", true)).toEqual(["info", "notificaciones", "metricas", "por-decidir"]);
  });

  it("el developer (acceso total) cae en la unión: Info, Notificaciones y Métricas", () => {
    // El developer responde `true` a `trabajaLeads`, `manejaPauta` y `esAdministrador`.
    // `info` lo habilita (cualquiera de las tres), `notificaciones` y `metricas` por
    // `trabajaLeads`; `canales` exige `!esAdministrador && !trabajaLeads` y `por-decidir`
    // exige `!trabajaLeads`, así que ambas lo excluyen. En la práctica la página NO las usa
    // en vista `todo`: `esAccesoTotal` corta antes y muestra el mensaje; en vista
    // `gerente`/`closer` el rol de vista ya es ese rol.
    expect(ids("developer")).toEqual(["info", "notificaciones", "metricas"]);
  });

  it("sin rol no hay secciones", () => {
    expect(ids(null)).toEqual([]);
  });

  it("ninguna de las secciones del closer se solapa con las de pauta o gerencia", () => {
    expect(ids("closer")).not.toContain("canales");
    expect(ids("closer")).not.toContain("por-decidir");
    expect(ids("gerente")).not.toContain("notificaciones");
    expect(ids("paid_trafficker")).not.toContain("notificaciones");
  });

  it("todo rol que tiene Mi espacio ve Info primera", () => {
    for (const rol of ["closer", "gerente", "paid_trafficker", "developer"] as const) {
      expect(ids(rol)[0]).toBe("info");
    }
  });
});

describe("seccionPedida: la pedida si el rol la cumple, si no la por defecto", () => {
  it("el closer sin ?tab cae en su sección por defecto (Notificaciones, no Info)", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, undefined)?.id).toBe("notificaciones");
  });

  it("el closer puede pedir Info", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, "info")?.id).toBe("info");
  });

  it("el closer puede pedir Métricas", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, "metricas")?.id).toBe("metricas");
  });

  it("el `?tab=atencion` viejo lleva a Notificaciones (ticket 221)", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, "atencion")?.id).toBe("notificaciones");
  });

  it("un closer que forja ?tab=canales NO la ve: cae en la por defecto", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, "canales")?.id).toBe("notificaciones");
  });

  it("un closer que forja ?tab=por-decidir tampoco: cae en la por defecto", () => {
    expect(seccionPedida({ rol: "closer", operaComoCloser: false }, "por-decidir")?.id).toBe("notificaciones");
  });

  it("el paid trafficker sin ?tab cae en Canales (su por defecto, no Info)", () => {
    expect(seccionPedida({ rol: "paid_trafficker", operaComoCloser: false }, undefined)?.id).toBe("canales");
    expect(seccionPedida({ rol: "paid_trafficker", operaComoCloser: false }, "notificaciones")?.id).toBe("canales");
  });

  it("el paid trafficker puede pedir Info", () => {
    expect(seccionPedida({ rol: "paid_trafficker", operaComoCloser: false }, "info")?.id).toBe("info");
  });

  it("el gerente sin ?tab cae en Por decidir (su por defecto, no Info)", () => {
    expect(seccionPedida({ rol: "gerente", operaComoCloser: false }, undefined)?.id).toBe("por-decidir");
    expect(seccionPedida({ rol: "gerente", operaComoCloser: false }, "deals")?.id).toBe("por-decidir");
  });

  it("el gerente puede pedir Info", () => {
    expect(seccionPedida({ rol: "gerente", operaComoCloser: false }, "info")?.id).toBe("info");
  });

  it("sin rol no hay sección que mostrar", () => {
    expect(seccionPedida({ rol: null, operaComoCloser: false }, "notificaciones")).toBeNull();
  });
});

describe("el contrato del registro", () => {
  it("Notificaciones, Métricas y Por decidir usan selector de programa; Info y Canales no", () => {
    const porId = new Map(SECCIONES.map((s) => [s.id, s]));
    expect(porId.get("info")?.usaSelectorDePrograma).toBe(false);
    expect(porId.get("canales")?.usaSelectorDePrograma).toBe(false);
    expect(porId.get("por-decidir")?.usaSelectorDePrograma).toBe(true);
    for (const id of ["notificaciones", "metricas"] as const) {
      expect(porId.get(id)?.usaSelectorDePrograma).toBe(true);
    }
  });

  it("cada id es único", () => {
    const vistos = new Set<string>();
    for (const s of SECCIONES) {
      expect(vistos.has(s.id)).toBe(false);
      vistos.add(s.id);
    }
  });
});
