import { describe, expect, it } from "vitest";
import { planificarSync } from "@/lib/sheets/plan-sync";
import type { PersonaDeducida } from "@/lib/sheets/dedup";

/**
 * Ticket 026 / ADR 0021: el sync NUNCA lee ni escribe el responsable, y cuando
 * encuentra una persona con entrada "crm" la pasa a "formulario" dejando rastro en
 * la bitacora. Puro, sin base — mismo estilo que tests/plan-sync.test.ts.
 */

const ctx = { programId: "prog-1", syncRunId: "run-1" };

function persona(extra: Partial<PersonaDeducida> = {}): PersonaDeducida {
  return {
    emailNormalizado: "ana@correo.co",
    nombre: "Ana",
    telefono: "300",
    cargo: null,
    ingresoDeclarado: null,
    urgencia: null,
    porQueAplico: null,
    utmSource: "meta",
    utmMedium: null,
    utmCampaign: null,
    estado: null,
    fechaPrimeraAplicacion: null,
    fechaUltimaAplicacion: null,
    numAplicaciones: 1,
    raw: {},
    ...extra,
  };
}

/** Lo que ya esta guardado, con la forma de una fila de `people`. */
function guardada(p: PersonaDeducida, extra: Record<string, unknown> = {}) {
  return {
    id: "per-1",
    programId: ctx.programId,
    empresa: null,
    ciudad: null,
    pais: null,
    motivoDescarte: null,
    cohortId: null,
    responsableCloserId: null,
    entrada: "formulario",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
    estado: "cola_setteo",
    ...extra,
  } as Parameters<typeof planificarSync>[1] extends Map<string, infer F> ? F : never;
}

describe("planificarSync y el responsable (ADR 0021)", () => {
  it("una persona con responsable que cambia de telefono conserva el responsable y no deja bitacora de ese campo", () => {
    const antes = persona();
    const ahora = persona({ telefono: "311" });
    const plan = planificarSync(
      [ahora],
      new Map([[antes.emailNormalizado, guardada(antes, { responsableCloserId: "Ana" })]]),
      ctx,
    );

    expect(plan.aActualizar).toHaveLength(1);
    // El registro a actualizar NO menciona el responsable: el update de sync.ts no lo pisa.
    expect(plan.aActualizar[0].valores).not.toHaveProperty("responsableCloserId");
    // Ninguna fila de bitacora habla del responsable.
    expect(plan.cambios.some((c) => c.campo === "responsableCloserId")).toBe(false);
  });

  it("una persona con entrada 'crm' y sin otro cambio pasa a 'formulario' y deja UNA fila de bitacora, conservando el responsable", () => {
    const p = persona();
    const plan = planificarSync(
      [p],
      new Map([[p.emailNormalizado, guardada(p, { entrada: "crm", responsableCloserId: "Ana" })]]),
      ctx,
    );

    expect(plan.aActualizar).toHaveLength(1);
    // El responsable no se toca.
    expect(plan.aActualizar[0].valores).not.toHaveProperty("responsableCloserId");
    expect(plan.cambios).toEqual([
      expect.objectContaining({
        campo: "entrada",
        valorAnterior: "crm",
        valorNuevo: "formulario",
      }),
    ]);
  });

  it("una persona ya en 'formulario' sin cambios no escribe nada (no hay falso diff de entrada)", () => {
    const p = persona();
    const plan = planificarSync([p], new Map([[p.emailNormalizado, guardada(p)]]), ctx);

    expect(plan).toEqual({ aInsertar: [], aActualizar: [], cambios: [] });
  });

  it("una persona nueva se inserta con entrada 'formulario' y sin responsable", () => {
    const plan = planificarSync([persona()], new Map(), ctx);

    expect(plan.aInsertar).toHaveLength(1);
    expect(plan.aInsertar[0]).toMatchObject({ entrada: "formulario" });
    expect(plan.aInsertar[0]).not.toHaveProperty("responsableCloserId");
  });
});
