import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import {
  abonos,
  calls,
  changeLog,
  cohorts,
  people,
  plataformasPago,
  productos,
  programs,
  sales,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import { anularRegistro } from "@/lib/mutations/anulaciones";
import { registrarLlamada } from "@/lib/mutations/registro";
import { cajaRecaudada, embudoDelRango } from "@/lib/queries/dashboard";
import { saldoDeVenta } from "@/lib/queries/ventas";
import { conteosPorPrograma } from "@/lib/queries/nerd-stats";

/**
 * Ticket 029 (ADR 0026): anular una llamada, una venta o un abono.
 *
 * Lo que se prueba aca no es que la columna se escriba —eso lo garantiza el CHECK de
 * la base— sino las tres cosas que si se pueden romper en silencio: la CASCADA (una
 * venta anulada no puede dejar abonos vivos sumando a la caja), los PERMISOS, y que
 * las cifras del dashboard y de `/nerd-stats` bajen de verdad despues de anular.
 *
 * Igual que el resto: una sola base PGlite para el archivo y `limpiar()` entre tests.
 */

let base: BaseDePrueba;
let db: Db;

async function limpiar(): Promise<void> {
  await db.delete(changeLog);
  await db.delete(abonos);
  await db.delete(sales);
  await db.delete(calls);
  await db.delete(people);
  await db.delete(cohorts);
  await db.delete(productos);
  await db.delete(programs);
  await db.delete(plataformasPago);
  await db.delete(users);
}

beforeAll(async () => {
  base = await crearBaseDePrueba();
  db = base.db;
}, 60_000);
afterAll(async () => {
  await base.cerrar();
});
beforeEach(limpiar);

const RANGO = { desde: "2026-09-01", hasta: "2026-09-30" };

/** Un programa con su cohorte (activa por defecto) y una persona. */
async function sembrarEscenario({ estado = "activo" as "activo" | "cerrado" } = {}) {
  const [programa] = await db
    .insert(programs)
    .values({ slug: "programa", nombre: "Programa", ticketUsd: "797" })
    .returning();
  const [cohorte] = await db
    .insert(cohorts)
    .values({
      programId: programa.id,
      codigo: "C1",
      metaCupos: 30,
      precioUsd: "797",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado,
    })
    .returning();
  const [persona] = await db
    .insert(people)
    .values({ programId: programa.id, emailNormalizado: "lead@correo.com" })
    .returning();
  return { programId: programa.id, cohortId: cohorte.id, personId: persona.id };
}

/** Una llamada cerrada con su venta y dos abonos, tal como los escribe `/mi-dia`. */
async function sembrarCierreCompleto(
  ctx: { programId: string; cohortId: string; personId: string },
  closerId = "Kevin",
) {
  const [llamada] = await db
    .insert(calls)
    .values({
      programId: ctx.programId,
      cohortId: ctx.cohortId,
      personId: ctx.personId,
      closerId,
      resultado: "cerrada",
      fechaLlamada: new Date("2026-09-10T17:00:00Z"),
      origen: "app",
    })
    .returning();
  const [venta] = await db
    .insert(sales)
    .values({
      programId: ctx.programId,
      cohortId: ctx.cohortId,
      personId: ctx.personId,
      callId: llamada.id,
      closerId,
      fecha: "2026-09-10",
      precioAplicadoUsd: "797",
      moneda: "USD",
    })
    .returning();
  const filas = await db
    .insert(abonos)
    .values([
      { saleId: venta.id, programId: ctx.programId, fecha: "2026-09-10", monto: "400", closerId },
      { saleId: venta.id, programId: ctx.programId, fecha: "2026-09-15", monto: "397", closerId },
    ])
    .returning();
  return { llamadaId: llamada.id, saleId: venta.id, abonoIds: filas.map((f) => f.id) };
}

async function sesion(
  rol: "gerente" | "closer" | "developer",
  closerId: string | null,
  nombre = "Kevin",
): Promise<Session> {
  const [usuario] = await db
    .insert(users)
    .values({ email: `${nombre.toLowerCase()}@retiagrowth.com`, nombre, rol, closerId })
    .returning();
  return { user: { id: usuario.id, rol, closerId }, expires: "2099-01-01T00:00:00Z" } as Session;
}

/** Cuanta caja ve el dashboard del programa en el rango, en USD. */
async function cajaEnUsd(programId: string): Promise<number> {
  const caja = await cajaRecaudada({ programId, rango: RANGO, closerId: null }, db);
  return caja.find((c) => c.moneda === "USD")?.total ?? 0;
}

describe("anular una venta", () => {
  it("anula sus abonos en la misma escritura y la caja del rango baja entera", async () => {
    const ctx = await sembrarEscenario();
    const { saleId } = await sembrarCierreCompleto(ctx);
    const jefe = await sesion("gerente", null, "Michael");

    expect(await cajaEnUsd(ctx.programId)).toBe(797);

    const resultado = await anularRegistro(
      jefe,
      { tipo: "venta", id: saleId, motivo: "El pago se cayo" },
      db,
    );

    expect(resultado).toEqual({ llamadas: 0, ventas: 1, abonos: 2 });
    expect(await cajaEnUsd(ctx.programId)).toBe(0);

    // Ni un abono vivo colgando de una venta anulada: eso seguiria sumando a la caja,
    // que se calcula desde `abonos` y no desde `sales` (ADR 0013).
    const filas = await db.select().from(abonos).where(eq(abonos.saleId, saleId));
    expect(filas.every((f) => f.anuladoEn !== null)).toBe(true);
    expect(filas.every((f) => f.motivoAnulacion === "El pago se cayo")).toBe(true);
  });

  it("deja en change_log quien anulo, cuando y por que", async () => {
    const ctx = await sembrarEscenario();
    const { saleId } = await sembrarCierreCompleto(ctx);
    const jefe = await sesion("gerente", null, "Michael");

    await anularRegistro(jefe, { tipo: "venta", id: saleId, motivo: "Duplicada" }, db);

    const bitacora = await db.select().from(changeLog);
    // Una fila por registro anulado: la venta y sus dos abonos.
    expect(bitacora).toHaveLength(3);
    expect(bitacora.every((f) => f.campo === "anulado_en")).toBe(true);
    expect(bitacora.every((f) => f.valorNuevo === "Duplicada")).toBe(true);
    expect(bitacora.every((f) => f.userId === jefe.user.id)).toBe(true);
  });

  it("no se puede anular dos veces: la segunda no pisa al autor de la primera", async () => {
    const ctx = await sembrarEscenario();
    const { saleId } = await sembrarCierreCompleto(ctx);
    const primero = await sesion("gerente", null, "Michael");
    const segundo = await sesion("gerente", null, "Dana");

    await anularRegistro(primero, { tipo: "venta", id: saleId, motivo: "Primera" }, db);
    await expect(
      anularRegistro(segundo, { tipo: "venta", id: saleId, motivo: "Segunda" }, db),
    ).rejects.toThrow(/ya estaba anulad/i);

    const [venta] = await db.select().from(sales).where(eq(sales.id, saleId));
    expect(venta.anuladoPor).toBe(primero.user.id);
    expect(venta.motivoAnulacion).toBe("Primera");
  });
});

describe("anular una llamada cerrada", () => {
  it("arrastra su venta y los abonos de esa venta", async () => {
    const ctx = await sembrarEscenario();
    const { llamadaId, saleId } = await sembrarCierreCompleto(ctx);
    const jefe = await sesion("gerente", null, "Michael");

    const resultado = await anularRegistro(
      jefe,
      { tipo: "llamada", id: llamadaId, motivo: "Se registro al lead equivocado" },
      db,
    );

    expect(resultado).toEqual({ llamadas: 1, ventas: 1, abonos: 2 });
    const [venta] = await db.select().from(sales).where(eq(sales.id, saleId));
    expect(venta.anuladoEn).not.toBeNull();
    expect(await cajaEnUsd(ctx.programId)).toBe(0);

    // El embudo tambien baja: la llamada no cuenta como agenda, ni como show, ni
    // como cierre, y la venta no cuenta como venta.
    const embudo = await embudoDelRango({ programId: ctx.programId, rango: RANGO, closerId: null }, db);
    expect(embudo).toMatchObject({ agendas: 0, llamadasConShow: 0, cierres: 0, ventas: 0 });
  });

  it("una llamada NO cerrada no arrastra nada", async () => {
    const ctx = await sembrarEscenario();
    const [llamada] = await db
      .insert(calls)
      .values({
        programId: ctx.programId,
        cohortId: ctx.cohortId,
        personId: ctx.personId,
        closerId: "Kevin",
        resultado: "no_show",
        fechaLlamada: new Date("2026-09-10T17:00:00Z"),
      })
      .returning();
    const jefe = await sesion("gerente", null, "Michael");

    const resultado = await anularRegistro(
      jefe,
      { tipo: "llamada", id: llamada.id, motivo: "Se repitio" },
      db,
    );
    expect(resultado).toEqual({ llamadas: 1, ventas: 0, abonos: 0 });
  });

  it("se niega si es una cerrada sin venta enlazada y la persona tiene una venta viva", async () => {
    // Imita una fila anterior al ticket 029 (o venida de la hoja): la venta existe
    // pero no apunta a ninguna llamada, asi que la cascada no puede encontrarla.
    const ctx = await sembrarEscenario();
    const [llamada] = await db
      .insert(calls)
      .values({
        programId: ctx.programId,
        cohortId: ctx.cohortId,
        personId: ctx.personId,
        closerId: "Kevin",
        resultado: "cerrada",
        fechaLlamada: new Date("2026-09-10T17:00:00Z"),
        origen: "sheets",
      })
      .returning();
    await db.insert(sales).values({
      programId: ctx.programId,
      cohortId: ctx.cohortId,
      personId: ctx.personId,
      closerId: "Kevin",
      fecha: "2026-09-10",
      precioAplicadoUsd: "797",
    });
    const jefe = await sesion("gerente", null, "Michael");

    await expect(
      anularRegistro(jefe, { tipo: "llamada", id: llamada.id, motivo: "Mala" }, db),
    ).rejects.toThrow(/no tiene su venta enlazada/i);

    // Y despues de anular la venta a mano, la llamada si se deja anular.
    const [venta] = await db.select().from(sales);
    await anularRegistro(jefe, { tipo: "venta", id: venta.id, motivo: "Mala" }, db);
    await expect(
      anularRegistro(jefe, { tipo: "llamada", id: llamada.id, motivo: "Mala" }, db),
    ).resolves.toMatchObject({ llamadas: 1, ventas: 0 });
  });
});

describe("anular un abono", () => {
  it("no toca la venta y el saldo se recalcula solo", async () => {
    const ctx = await sembrarEscenario();
    const { saleId, abonoIds } = await sembrarCierreCompleto(ctx);
    const jefe = await sesion("gerente", null, "Michael");

    expect(await saldoDeVenta(saleId, db)).toMatchObject({ abonado: "797.00", saldo: "0.00" });

    const resultado = await anularRegistro(
      jefe,
      { tipo: "abono", id: abonoIds[1], motivo: "El pago fue devuelto" },
      db,
    );

    expect(resultado).toEqual({ llamadas: 0, ventas: 0, abonos: 1 });
    const [venta] = await db.select().from(sales).where(eq(sales.id, saleId));
    expect(venta.anuladoEn).toBeNull();
    // El saldo no se guarda en ninguna columna: sale de `saldo.ts`, asi que baja solo.
    expect(await saldoDeVenta(saleId, db)).toMatchObject({
      abonado: "400.00",
      saldo: "397.00",
      pagadaCompleta: false,
    });
    expect(await cajaEnUsd(ctx.programId)).toBe(400);
  });
});

describe("quien puede anular (ADR 0026 punto 6)", () => {
  it("un closer no puede anular lo que registro otro closer", async () => {
    const ctx = await sembrarEscenario();
    const { saleId } = await sembrarCierreCompleto(ctx, "Dana");
    const kevin = await sesion("closer", "Kevin");

    await expect(
      anularRegistro(kevin, { tipo: "venta", id: saleId, motivo: "No es mia" }, db),
    ).rejects.toThrow(/otro closer/i);
  });

  it("un closer si anula lo suyo mientras la cohorte siga activa", async () => {
    const ctx = await sembrarEscenario();
    const { saleId } = await sembrarCierreCompleto(ctx, "Kevin");
    const kevin = await sesion("closer", "Kevin");

    await expect(
      anularRegistro(kevin, { tipo: "venta", id: saleId, motivo: "Me equivoque" }, db),
    ).resolves.toMatchObject({ ventas: 1, abonos: 2 });
  });

  it("un closer no puede anular en una cohorte cerrada; un gerente si", async () => {
    const ctx = await sembrarEscenario({ estado: "cerrado" });
    const { saleId } = await sembrarCierreCompleto(ctx, "Kevin");
    const kevin = await sesion("closer", "Kevin");

    await expect(
      anularRegistro(kevin, { tipo: "venta", id: saleId, motivo: "Tarde" }, db),
    ).rejects.toThrow(/cohorte ya no está activa/i);

    const jefe = await sesion("gerente", null, "Michael");
    await expect(
      anularRegistro(jefe, { tipo: "venta", id: saleId, motivo: "Corrigiendo el trimestre" }, db),
    ).resolves.toMatchObject({ ventas: 1 });
  });

  it("sin motivo no se anula", async () => {
    const ctx = await sembrarEscenario();
    const { saleId } = await sembrarCierreCompleto(ctx);
    const jefe = await sesion("gerente", null, "Michael");

    await expect(
      anularRegistro(jefe, { tipo: "venta", id: saleId, motivo: "   " }, db),
    ).rejects.toThrow(/por que anulas/i);

    const [venta] = await db.select().from(sales).where(eq(sales.id, saleId));
    expect(venta.anuladoEn).toBeNull();
  });
});

describe("de punta a punta, sobre lo que escribe /mi-dia", () => {
  /**
   * Los demas tests siembran las filas a mano, asi que probarian la cascada aunque
   * `registrarLlamada` se olvidara de escribir `sales.callId`. Este parte del
   * registro REAL: si ese enlace se pierde, anular la llamada dejaria la venta viva
   * sumando al embudo y **nadie lo notaria**, que es exactamente el fallo que este
   * ticket existe para evitar.
   */
  it("una llamada registrada por un closer se anula con su venta y su abono", async () => {
    const ctx = await sembrarEscenario();
    const [producto] = await db
      .insert(productos)
      .values({ programId: ctx.programId, nombre: "Programa completo", precioLista: "797" })
      .returning();
    const [plataforma] = await db
      .insert(plataformasPago)
      .values({ nombre: "PayPal" })
      .returning();
    const kevin = await sesion("closer", "Kevin");

    const { llamada } = await registrarLlamada(
      kevin,
      {
        programId: ctx.programId,
        personId: ctx.personId,
        resultado: "cerrada",
        venta: {
          productoId: producto.id,
          precioAplicadoUsd: "797",
          fecha: "2026-09-10",
          monto: "400",
          plataformaId: plataforma.id,
        },
      },
      db,
    );

    expect(await cajaEnUsd(ctx.programId)).toBe(400);

    const resultado = await anularRegistro(
      kevin,
      { tipo: "llamada", id: llamada.id, motivo: "Le di a cerrada por error" },
      db,
    );

    expect(resultado).toEqual({ llamadas: 1, ventas: 1, abonos: 1 });
    expect(await cajaEnUsd(ctx.programId)).toBe(0);
    const embudo = await embudoDelRango(
      { programId: ctx.programId, rango: RANGO, closerId: null },
      db,
    );
    expect(embudo).toMatchObject({ agendas: 0, cierres: 0, ventas: 0 });
  });
});

describe("las cifras quedan de acuerdo entre pantallas", () => {
  it("/nerd-stats y el dashboard bajan igual despues de una anulacion", async () => {
    const ctx = await sembrarEscenario();
    const { llamadaId } = await sembrarCierreCompleto(ctx);
    const jefe = await sesion("gerente", null, "Michael");

    const antes = await conteosPorPrograma(db);
    expect(antes[0]).toMatchObject({ llamadas: 1, ventas: 1, abonos: 2 });

    await anularRegistro(jefe, { tipo: "llamada", id: llamadaId, motivo: "Mala" }, db);

    const despues = await conteosPorPrograma(db);
    expect(despues[0]).toMatchObject({ llamadas: 0, ventas: 0, abonos: 0 });
    // Y el dashboard dice lo mismo, que es lo que el ticket pide comprobar: las dos
    // pantallas leen tablas distintas y tienen que contar la misma realidad.
    const embudo = await embudoDelRango({ programId: ctx.programId, rango: RANGO, closerId: null }, db);
    expect(embudo).toMatchObject({ cierres: 0, ventas: 0 });
    expect(await cajaEnUsd(ctx.programId)).toBe(0);
  });
});
