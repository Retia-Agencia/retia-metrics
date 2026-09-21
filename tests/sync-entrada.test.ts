import { describe, expect, it } from "vitest";
import { planificarSync } from "@/lib/sheets/plan-sync";
import type { PersonaDeducida } from "@/lib/sheets/dedup";

/**
 * Ticket 026 / ADR 0021: cuando el sync encuentra un lead con entrada "crm" lo pasa
 * a "formulario" dejando rastro en la bitacora. Puro, sin base — mismo estilo que
 * tests/plan-sync.test.ts.
 *
 * Hasta el ADR 0035 este archivo probaba ademas que el sync no pisaba
 * `responsableCloserId`. Esa columna ya no existe (la atribucion pasa a
 * `deals.owner_user_id`, ADR 0037), asi que esas aserciones se fueron con ella: un
 * `not.toHaveProperty` sobre un campo inexistente pasa siempre y no prueba nada.
 * La garantia equivalente para el owner del deal la escribe la etapa 3.
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

/** Lo que ya esta guardado, con la forma de una fila de `leads`. */
function guardada(p: PersonaDeducida, extra: Record<string, unknown> = {}) {
  return {
    id: "per-1",
    programId: ctx.programId,
    empresa: null,
    ciudad: null,
    pais: null,
    motivoDescarte: null,
    cohortId: null,
    entrada: "formulario",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
    estado: "cola_setteo",
    ...extra,
  } as Parameters<typeof planificarSync>[1] extends Map<string, infer F> ? F : never;
}

describe("planificarSync y la entrada del lead (ADR 0021)", () => {
  it("una persona con entrada 'crm' y sin otro cambio pasa a 'formulario' y deja UNA fila de bitacora", () => {
    const p = persona();
    const plan = planificarSync(
      [p],
      new Map([[p.emailNormalizado, guardada(p, { entrada: "crm" })]]),
      ctx,
    );

    expect(plan.aActualizar).toHaveLength(1);
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

  it("una persona nueva se inserta con entrada 'formulario'", () => {
    const plan = planificarSync([persona()], new Map(), ctx);

    expect(plan.aInsertar).toHaveLength(1);
    expect(plan.aInsertar[0]).toMatchObject({ entrada: "formulario" });
  });
});
