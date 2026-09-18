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

  it("cambiar `estado`, que no se compara, no dispara escritura", () => {
    const antes = persona();
    const ahora = persona({ estado: "descartado" });
    const plan = planificarSync([ahora], new Map([[antes.emailNormalizado, guardada(antes)]]), ctx);

    // `estado` sigue fuera a proposito (F-01 abierto). Si cambia, que sea consciente.
    expect(plan.aActualizar).toEqual([]);
  });

  /**
   * 18-sep, decision de Mani: las fechas de aplicacion SI se comparan.
   *
   * Antes no, y ese era el motivo de que arreglar `parsearFecha` no reparara lo ya
   * escrito: una persona cuyo unico campo malo era la fecha no tenia ningun diff, no
   * entraba a `aActualizar` y el dano se quedaba para siempre. De ahi salio
   * `npm run backfill-fechas`. Con las fechas dentro, el sync se auto-repara y ese
   * script pasa a ser una herramienta de una sola vez, no una pieza del diseno.
   */
  it("una fecha de aplicacion que cambia SI dispara escritura y deja bitacora", () => {
    const antes = persona({ fechaPrimeraAplicacion: new Date("2026-06-17T05:00:00Z") });
    const ahora = persona({ fechaPrimeraAplicacion: new Date("2026-06-10T05:00:00Z") });
    const plan = planificarSync([ahora], new Map([[antes.emailNormalizado, guardada(antes)]]), ctx);

    expect(plan.aActualizar).toHaveLength(1);
    expect(plan.cambios).toEqual([
      expect.objectContaining({ campo: "fechaPrimeraAplicacion", origen: "sync" }),
    ]);
  });

  it("un centinela reparado a null tambien dispara escritura", () => {
    // El caso real: la base tiene el ano 1 y el parser arreglado devuelve null.
    const antes = persona({ fechaPrimeraAplicacion: new Date("0001-01-01T05:00:00Z") });
    const ahora = persona({ fechaPrimeraAplicacion: null });
    const plan = planificarSync([ahora], new Map([[antes.emailNormalizado, guardada(antes)]]), ctx);

    expect(plan.aActualizar).toHaveLength(1);
    expect(plan.cambios[0]).toMatchObject({ campo: "fechaPrimeraAplicacion", valorNuevo: null });
  });

  /**
   * EL RIESGO DE ESTE CAMBIO, y por eso tiene test propio. `compararCampos` compara
   * `String(valor)`. Si una fecha leida de la base y la misma fecha recien parseada
   * de la hoja no dieran la MISMA cadena, cada sync veria un diff falso en cada
   * persona y reescribiria la base entera —4.599 filas y 4.599 de bitacora— todos los
   * dias, sin que nada fallara. Dos `Date` del mismo instante si dan la misma cadena;
   * este test es el que se entera si eso deja de ser cierto.
   */
  it("la MISMA fecha no produce un diff falso (si no, el sync reescribe todo cada dia)", () => {
    const instante = new Date("2026-08-20T23:58:12-05:00");
    const antes = persona({
      fechaPrimeraAplicacion: instante,
      fechaUltimaAplicacion: instante,
    });
    // Otro objeto Date, el mismo instante: es lo que pasa en cada corrida real.
    const ahora = persona({
      fechaPrimeraAplicacion: new Date(instante.getTime()),
      fechaUltimaAplicacion: new Date(instante.getTime()),
    });
    const plan = planificarSync([ahora], new Map([[antes.emailNormalizado, guardada(antes)]]), ctx);

    expect(plan.aActualizar).toEqual([]);
    expect(plan.cambios).toEqual([]);
  });

  it("dos nulls tampoco producen un diff falso", () => {
    const antes = persona({ fechaPrimeraAplicacion: null, fechaUltimaAplicacion: null });
    const ahora = persona({ fechaPrimeraAplicacion: null, fechaUltimaAplicacion: null });
    const plan = planificarSync([ahora], new Map([[antes.emailNormalizado, guardada(antes)]]), ctx);

    expect(plan.aActualizar).toEqual([]);
  });
});
