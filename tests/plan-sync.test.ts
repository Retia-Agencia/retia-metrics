import { describe, expect, it } from "vitest";
import { planificarSync } from "@/lib/sheets/plan-sync";
import type { PersonaDeducida } from "@/lib/sheets/dedup";

/**
 * B-01: la decision del sync (que se inserta, que se actualiza, que va a la
 * bitacora) es pura y se prueba sin base. La escritura queda en sync.ts.
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
    estado: "cola_setteo",
    ...extra,
  } as Parameters<typeof planificarSync>[1] extends Map<string, infer F> ? F : never;
}

describe("planificarSync", () => {
  it("una persona que no existe se inserta en su programa y no deja bitacora", () => {
    const plan = planificarSync([persona()], new Map(), ctx);

    expect(plan.aInsertar).toHaveLength(1);
    expect(plan.aInsertar[0]).toMatchObject({ programId: "prog-1", emailNormalizado: "ana@correo.co" });
    expect(plan.aActualizar).toEqual([]);
    expect(plan.cambios).toEqual([]);
  });

  it("una segunda corrida sin novedades no escribe nada", () => {
    const p = persona();
    const plan = planificarSync([p], new Map([[p.emailNormalizado, guardada(p)]]), ctx);

    expect(plan).toEqual({ aInsertar: [], aActualizar: [], cambios: [] });
  });

  it("cada campo que cambia actualiza la persona y deja una fila de bitacora", () => {
    const antes = persona();
    const ahora = persona({ telefono: "311", numAplicaciones: 2 });
    const plan = planificarSync([ahora], new Map([[antes.emailNormalizado, guardada(antes)]]), ctx);

    expect(plan.aInsertar).toEqual([]);
    expect(plan.aActualizar).toEqual([
      { id: "per-1", valores: expect.objectContaining({ telefono: "311", numAplicaciones: 2 }) },
    ]);
    expect(plan.cambios).toEqual([
      expect.objectContaining({ campo: "telefono", valorAnterior: "300", valorNuevo: "311" }),
      expect.objectContaining({ campo: "numAplicaciones", valorAnterior: "1", valorNuevo: "2" }),
    ]);
    expect(plan.cambios[0]).toMatchObject({
      tabla: "people",
      registroId: "per-1",
      etiqueta: "Ana",
      origen: "sync",
      syncRunId: "run-1",
    });
  });

  it("sin nombre guardado, la bitacora se etiqueta con el correo", () => {
    const antes = persona({ nombre: null });
    const ahora = persona({ nombre: "Ana" });
    const plan = planificarSync([ahora], new Map([[antes.emailNormalizado, guardada(antes)]]), ctx);

    expect(plan.cambios).toEqual([
      expect.objectContaining({ campo: "nombre", etiqueta: "ana@correo.co", valorAnterior: null }),
    ]);
  });

  it("null y undefined en la base cuentan como el mismo vacio", () => {
    const p = persona({ cargo: null });
    const plan = planificarSync([p], new Map([[p.emailNormalizado, guardada(p, { cargo: undefined })]]), ctx);

    expect(plan.aActualizar).toEqual([]);
  });

  it("cambiar un campo que no se compara (estado, fechas) no dispara escritura", () => {
    const antes = persona();
    const ahora = persona({ estado: "descartado", fechaUltimaAplicacion: new Date("2026-09-01") });
    const plan = planificarSync([ahora], new Map([[antes.emailNormalizado, guardada(antes)]]), ctx);

    // Hoy es asi a proposito (F-01 y F-05 siguen abiertos). Si cambia, que sea consciente.
    expect(plan.aActualizar).toEqual([]);
  });
});
