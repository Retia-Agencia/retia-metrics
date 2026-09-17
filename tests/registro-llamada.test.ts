import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  abonos,
  calls,
  cohorts,
  motivos,
  plataformasPago,
  productos,
  programs,
  sales,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import { cohorteActiva } from "@/lib/queries/cohortes";
import {
  registrarLlamada,
  type EntradaRegistroLlamada,
} from "@/lib/mutations/registro";

/**
 * Ticket 002 (ADR 0010, 0011, 0013, 0015): la cohorte activa de un programa y la
 * mutacion de registro nativo de una llamada, con su venta y primer abono si cerro.
 *
 * Los tests corren sobre PGlite en memoria y afirman leyendo la base despues de
 * llamar a la interfaz publica; el arrange siembra filas con inserts directos.
 *
 * Se crea UNA sola base para todo el archivo y se limpia entre tests, en vez de una
 * base por test: `crearBaseDePrueba` aplica las nueve migraciones reales y tarda
 * varios segundos, asi que una por test convertia este archivo en el mas lento del
 * repo (72s). El aislamiento lo da `limpiar()`, que vacia las tablas en orden de
 * llave foranea.
 */

let base: BaseDePrueba;
let db: Db;

/**
 * Vacia las tablas que tocan estos tests. El orden es el de las llaves foraneas:
 * `abonos` antes que `sales` y `plataformas_pago` (onDelete restrict, ADR 0013), y
 * `calls` antes que `motivos` (restrict, ADR 0015). Las migraciones 0003 y 0004
 * siembran plataformas y motivos reales; se borran tambien para que cada test
 * siembre los suyos sin chocar con el indice unico de `lower(nombre)`.
 */
async function limpiar(): Promise<void> {
  await db.delete(abonos);
  await db.delete(sales);
  await db.delete(calls);
  await db.delete(cohorts);
  await db.delete(productos);
  await db.delete(programs);
  await db.delete(plataformasPago);
  await db.delete(motivos);
}

// El timeout va explicito aca y no en `vitest.config.ts`: aplicar las nueve
// migraciones sobre PGlite pasa de los 10s por defecto de un hook cuando la maquina
// esta corriendo varias suites a la vez, y el config es compartido por todo el repo.
beforeAll(async () => {
  base = await crearBaseDePrueba();
  db = base.db;
}, 60_000);
afterAll(async () => {
  await base.cerrar();
});
beforeEach(limpiar);

/** Siembra un programa y devuelve su id. */
async function sembrarPrograma(slug = "comunicarte"): Promise<string> {
  const [prog] = await db
    .insert(programs)
    .values({ slug, nombre: slug, ticketUsd: "797" })
    .returning();
  return prog.id;
}

/**
 * Siembra una cohorte de un programa con un estado dado. Una cohorte activa
 * necesita `fechaInicioVentas` por el CHECK de la base (ADR 0022).
 */
async function sembrarCohorte(
  programId: string,
  estado: "activo" | "futuro" | "cerrado",
  codigo = "C1",
): Promise<string> {
  const [coh] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo,
      metaCupos: 10,
      precioUsd: "797",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: estado === "activo" ? "2026-09-01" : null,
      fechaCierreVentas: "2026-09-30",
      estado,
    })
    .returning();
  return coh.id;
}

/** Siembra un producto de un programa y devuelve su id. */
async function sembrarProducto(
  programId: string,
  { activo = true, nombre = "Programa completo" } = {},
): Promise<string> {
  const [prod] = await db
    .insert(productos)
    .values({ programId, nombre, precioLista: "797", moneda: "USD", activo })
    .returning();
  return prod.id;
}

/** Siembra una plataforma de pago y devuelve su id. */
async function sembrarPlataforma({ activo = true, nombre = "PayPal" } = {}): Promise<string> {
  const [plat] = await db.insert(plataformasPago).values({ nombre, activo }).returning();
  return plat.id;
}

/** Sesion de un closer logueado. `closerId` null = cuenta sin onboarding (ADR 0011). */
function sesionCloser(closerId: string | null): Session {
  return {
    user: { id: crypto.randomUUID(), rol: "closer", closerId },
    expires: "2099-01-01T00:00:00Z",
  } as Session;
}

describe("cohorteActiva", () => {
  it("devuelve null si el programa no tiene cohorte activa, sin reventar", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "futuro");

    await expect(cohorteActiva(programId, db)).resolves.toBeNull();
  });

  it("devuelve la cohorte con estado 'activo', no una 'futuro' ni 'cerrado'", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "cerrado", "C1");
    const activaId = await sembrarCohorte(programId, "activo", "C2");
    await sembrarCohorte(programId, "futuro", "C3");

    const cohorte = await cohorteActiva(programId, db);
    expect(cohorte?.id).toBe(activaId);
    expect(cohorte?.estado).toBe("activo");
  });

  it("no devuelve la cohorte activa de OTRO programa", async () => {
    const programId = await sembrarPrograma();
    const otro = await sembrarPrograma("tactical-investor");
    await sembrarCohorte(otro, "activo");

    await expect(cohorteActiva(programId, db)).resolves.toBeNull();
  });
});

describe("registrarLlamada", () => {
  it("rechaza si session.user.closerId es null", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");

    const input: EntradaRegistroLlamada = { programId, resultado: "show" };
    await expect(registrarLlamada(sesionCloser(null), input, db)).rejects.toThrow(
      /identificador de closer/i,
    );
  });

  it("rechaza si el programa no tiene cohorte activa", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "futuro");

    const input: EntradaRegistroLlamada = { programId, resultado: "show" };
    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow(
      /cohorte activa/i,
    );
  });

  it("rechaza 'reagendada' sin fechaSeguimiento", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");

    const input: EntradaRegistroLlamada = { programId, resultado: "reagendada" };
    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow(
      /fecha de seguimiento/i,
    );
  });

  it("rechaza 'compromiso_pago' sin fechaSeguimiento", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");

    const input: EntradaRegistroLlamada = { programId, resultado: "compromiso_pago" };
    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow(
      /fecha de seguimiento/i,
    );
  });

  it("rechaza 'perdida' sin motivoId", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");

    const input: EntradaRegistroLlamada = { programId, resultado: "perdida" };
    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow(
      /motivo/i,
    );
  });

  it("rechaza 'cerrada' sin los datos de la venta", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");

    const input: EntradaRegistroLlamada = { programId, resultado: "cerrada" };
    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow(
      /venta/i,
    );
  });

  it("rechaza un producto que no pertenece al programa de la llamada", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");
    const otroPrograma = await sembrarPrograma("tactical-investor");
    const productoAjeno = await sembrarProducto(otroPrograma);

    const input: EntradaRegistroLlamada = {
      programId,
      resultado: "cerrada",
      venta: {
        productoId: productoAjeno,
        precioAplicadoUsd: "797",
        fecha: "2026-09-15",
        monto: "400",
      },
    };
    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow(
      /producto/i,
    );
  });

  it("rechaza un producto desactivado", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");
    const productoId = await sembrarProducto(programId, { activo: false });

    const input: EntradaRegistroLlamada = {
      programId,
      resultado: "cerrada",
      venta: {
        productoId,
        precioAplicadoUsd: "797",
        fecha: "2026-09-15",
        monto: "400",
      },
    };
    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow(
      /producto/i,
    );
  });

  it("rechaza una plataforma de pago desactivada", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");
    const productoId = await sembrarProducto(programId);
    const plataformaId = await sembrarPlataforma({ activo: false });

    const input: EntradaRegistroLlamada = {
      programId,
      resultado: "cerrada",
      venta: {
        productoId,
        precioAplicadoUsd: "797",
        fecha: "2026-09-15",
        monto: "400",
        plataformaId,
      },
    };
    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow(
      /plataforma/i,
    );
  });

  it("una llamada sin cierre se guarda con origen 'app', el closerId de la sesion y la cohorte activa", async () => {
    const programId = await sembrarPrograma();
    const cohortId = await sembrarCohorte(programId, "activo");

    const { llamada, venta, abono } = await registrarLlamada(
      sesionCloser("Dana"),
      { programId, resultado: "show", emailLead: "lead@ejemplo.com" },
      db,
    );

    expect(llamada.origen).toBe("app");
    expect(llamada.closerId).toBe("Dana");
    expect(llamada.cohortId).toBe(cohortId);
    expect(llamada.resultado).toBe("show");
    // `huellaFila` null: Postgres admite varios NULL en el indice unico, asi que no
    // choca con el dedup de filas de Sheets (ADR 0010).
    expect(llamada.huellaFila).toBeNull();
    // No cerro: no se toca sales ni abonos.
    expect(venta).toBeNull();
    expect(abono).toBeNull();
    expect(await db.select().from(sales)).toHaveLength(0);
    expect(await db.select().from(abonos)).toHaveLength(0);
  });

  it("guarda el motivo de una llamada perdida como catalogo (ADR 0015)", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");
    const [motivo] = await db.insert(motivos).values({ nombre: "Dinero" }).returning();

    const { llamada } = await registrarLlamada(
      sesionCloser("Dana"),
      { programId, resultado: "perdida", motivoId: motivo.id },
      db,
    );

    expect(llamada.motivoId).toBe(motivo.id);
  });

  it("una llamada cerrada guarda la venta y su primer abono en el mismo registro", async () => {
    const programId = await sembrarPrograma();
    const cohortId = await sembrarCohorte(programId, "activo");
    const productoId = await sembrarProducto(programId);
    const plataformaId = await sembrarPlataforma();

    const { llamada, venta, abono } = await registrarLlamada(
      sesionCloser("Dana"),
      {
        programId,
        resultado: "cerrada",
        emailLead: "lead@ejemplo.com",
        venta: {
          productoId,
          precioAplicadoUsd: "797",
          fecha: "2026-09-15",
          monto: "750",
          plataformaId,
          comprobanteUrl: "https://ejemplo.com/comprobante.pdf",
        },
      },
      db,
    );

    expect(llamada.resultado).toBe("cerrada");
    expect(venta?.cohortId).toBe(cohortId);
    expect(venta?.productoId).toBe(productoId);
    expect(venta?.precioAplicadoUsd).toBe("797.00");
    expect(venta?.emailComprador).toBe("lead@ejemplo.com");
    expect(venta?.closerId).toBe("Dana");
    // `sales.fecha` = la fecha del primer abono (decision comentada en la mutacion).
    expect(venta?.fecha).toBe("2026-09-15");
    // El monto de la venta NUNCA se deriva del abono (ADR 0013).
    expect(venta?.montoAbonado).toBeNull();

    // El abono apunta a la venta y conserva su moneda al lado del monto.
    expect(abono?.saleId).toBe(venta?.id);
    expect(abono?.monto).toBe("750.00");
    expect(abono?.moneda).toBe("USD");
    expect(abono?.plataformaId).toBe(plataformaId);
    expect(abono?.closerId).toBe("Dana");
    expect(abono?.origen).toBe("app");

    // Una sola llamada, una sola venta, un solo abono.
    expect(await db.select().from(calls)).toHaveLength(1);
    expect(await db.select().from(sales)).toHaveLength(1);
    expect(await db.select().from(abonos)).toHaveLength(1);
  });

  it("si falla el insert del abono no queda ni la venta ni la llamada", async () => {
    const programId = await sembrarPrograma();
    await sembrarCohorte(programId, "activo");
    const productoId = await sembrarProducto(programId);

    // `abonos.monto` es numeric(12,2): once digitos enteros lo desbordan. El precio
    // aplicado de la venta (numeric(10,2)) se deja chico a proposito, asi que el
    // UNICO insert que revienta es el del abono, ya con la llamada y la venta
    // escritas dentro del mismo lote atomico.
    const input: EntradaRegistroLlamada = {
      programId,
      resultado: "cerrada",
      venta: {
        productoId,
        precioAplicadoUsd: "797",
        fecha: "2026-09-15",
        monto: "99999999999",
      },
    };

    await expect(registrarLlamada(sesionCloser("Dana"), input, db)).rejects.toThrow();

    expect(await db.select().from(calls)).toHaveLength(0);
    expect(await db.select().from(sales)).toHaveLength(0);
    expect(await db.select().from(abonos)).toHaveLength(0);
  });
});
