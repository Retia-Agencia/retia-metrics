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

const ids = (rol: Rol | null): SeccionId[] => seccionesDeRol(rol).map((s) => s.id);

describe("seccionesDeRol: qué ve cada rol", () => {
  it("el closer ve las cuatro secciones de quien trabaja leads, en orden", () => {
    expect(ids("closer")).toEqual(["pendientes", "deals", "llamadas", "students"]);
  });

  it("el paid trafficker ve SOLO Canales", () => {
    expect(ids("paid_trafficker")).toEqual(["canales"]);
  });

  it("el gerente ve SOLO Por decidir: administra pero no trabaja leads (ADR 0003)", () => {
    expect(ids("gerente")).toEqual(["por-decidir"]);
  });

  it("el developer (acceso total) cae en las cuatro de quien trabaja leads", () => {
    // El developer responde `true` a `trabajaLeads`, `manejaPauta` y `esAdministrador`.
    // `canales` exige `!esAdministrador && !trabajaLeads` y `por-decidir` exige
    // `!trabajaLeads`: ambas lo excluyen, así que por registro le quedan las del closer.
    // En la práctica la página NO las usa en vista `todo`: `esAccesoTotal` corta antes y
    // muestra el mensaje; en vista `gerente`/`closer` el rol de vista ya es ese rol.
    expect(ids("developer")).toEqual(["pendientes", "deals", "llamadas", "students"]);
  });

  it("sin rol no hay secciones", () => {
    expect(ids(null)).toEqual([]);
  });

  it("ninguna de las secciones del closer se solapa con las de pauta o gerencia", () => {
    expect(ids("closer")).not.toContain("canales");
    expect(ids("closer")).not.toContain("por-decidir");
    expect(ids("gerente")).not.toContain("pendientes");
    expect(ids("paid_trafficker")).not.toContain("pendientes");
  });
});

describe("seccionPedida: la pedida si el rol la cumple, si no la primera", () => {
  it("el closer sin ?tab cae en su primera sección (Pendientes)", () => {
    expect(seccionPedida("closer", undefined)?.id).toBe("pendientes");
  });

  it("el closer puede pedir una sección suya (Mis deals)", () => {
    expect(seccionPedida("closer", "deals")?.id).toBe("deals");
  });

  it("un closer que forja ?tab=canales NO la ve: cae en la primera suya", () => {
    expect(seccionPedida("closer", "canales")?.id).toBe("pendientes");
  });

  it("un closer que forja ?tab=por-decidir tampoco: cae en la primera suya", () => {
    expect(seccionPedida("closer", "por-decidir")?.id).toBe("pendientes");
  });

  it("el paid trafficker siempre cae en Canales, aunque pida otra", () => {
    expect(seccionPedida("paid_trafficker", undefined)?.id).toBe("canales");
    expect(seccionPedida("paid_trafficker", "pendientes")?.id).toBe("canales");
  });

  it("el gerente siempre cae en Por decidir, aunque pida otra", () => {
    expect(seccionPedida("gerente", undefined)?.id).toBe("por-decidir");
    expect(seccionPedida("gerente", "deals")?.id).toBe("por-decidir");
  });

  it("sin rol no hay sección que mostrar", () => {
    expect(seccionPedida(null, "pendientes")).toBeNull();
  });
});

describe("el contrato del registro", () => {
  it("solo las secciones del closer y la del gerente usan selector de programa; Canales no", () => {
    const porId = new Map(SECCIONES.map((s) => [s.id, s]));
    expect(porId.get("canales")?.usaSelectorDePrograma).toBe(false);
    expect(porId.get("por-decidir")?.usaSelectorDePrograma).toBe(true);
    for (const id of ["pendientes", "deals", "llamadas", "students"] as const) {
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
