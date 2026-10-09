import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { cohorts, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  activarCohorte,
  crearCohorte,
  editarCohorte,
  type EntradaCohorte,
} from "@/lib/catalogo/cohortes";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 227: una cohorte FUTURA puede quedar "por definir" (sin inicio de clases ni cierre
 * de ventas) porque Gerencia la crea antes de saber las fechas. La reja dura es el CHECK
 * `cohorts_definida_si_no_es_futura` en la base (ADR 0005); el `superRefine` del esquema zod
 * la ataja antes con un 400 por campo. Aqui se prueban las dos capas: la amable (zod) y, forzando
 * el camino que se salta zod (`activarCohorte`), la dura (el choque real contra el CHECK).
 *
 * Base PGlite NUEVA por test: comparten tabla `cohorts` y no deben filtrarse filas.
 */

let db: Db;
let cerrar: () => Promise<void>;
let actorId: string;
let programId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [u] = await db.insert(users).values({ email: "gerente@retia.co", rol: "gerente" }).returning();
  actorId = u.id;
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "por-definir", nombre: "Por definir", ticketUsd: "797.00" })
    .returning();
  programId = p.id;
});

afterEach(async () => cerrar());

/** Una cohorte futura "por definir": precio y meta de cupos (obligatorios) y nada de fechas. */
function porDefinir(sobre: Partial<EntradaCohorte> = {}): EntradaCohorte {
  return {
    programId,
    codigo: "C1",
    metaCupos: 30,
    precioUsd: "797.00",
    fechaInicioClases: "",
    fechaInicioVentas: "",
    fechaCierreVentas: "",
    estado: "futuro",
    ...sobre,
  } as EntradaCohorte;
}

async function errorDe(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error("se esperaba un error y la operacion tuvo exito");
}

describe("cohorte por definir (ticket 227)", () => {
  it("se crea una cohorte futura sin ninguna de las tres fechas", async () => {
    const cohorte = await crearCohorte(db, actorId, porDefinir());
    expect(cohorte.estado).toBe("futuro");
    expect(cohorte.fechaInicioClases).toBeNull();
    expect(cohorte.fechaInicioVentas).toBeNull();
    expect(cohorte.fechaCierreVentas).toBeNull();
  });

  it("el esquema (zod) rechaza con 400 crear una cohorte NO futura sin las fechas", async () => {
    // Cerrada: el CHECK exige inicio de clases y cierre de ventas; el superRefine lo ataja antes.
    const error = await errorDe(() => crearCohorte(db, actorId, porDefinir({ estado: "cerrado" })));
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message).toContain("inicio de clases");

    // Activa sin inicio de ventas: también lo ataja el superRefine (ADR 0022).
    const error2 = await errorDe(() =>
      crearCohorte(db, actorId, porDefinir({ estado: "activo", fechaInicioClases: "2026-10-01", fechaCierreVentas: "2026-09-30" })),
    );
    expect((error2 as ErrorDeApp).message).toBe("Una cohorte activa necesita fecha de inicio de ventas.");
  });

  it("forzado, el CHECK de la base rechaza activar una por-definir (el choque real)", async () => {
    // Futura con inicio de ventas pero SIN clases ni cierre: zod la deja crear. Al activarla,
    // `activarCohorte` se salta zod y llega a la base: solo `cohorts_definida_si_no_es_futura`
    // puede fallar (el inicio de ventas satisface el otro CHECK). Es el choque real, no fabricado.
    const cohorte = await crearCohorte(
      db,
      actorId,
      porDefinir({ fechaInicioVentas: "2026-09-01" }),
    );
    expect(cohorte.fechaInicioClases).toBeNull();
    expect(cohorte.fechaCierreVentas).toBeNull();

    const error = await errorDe(() => activarCohorte(db, actorId, cohorte.id));
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message).toContain("solo una cohorte futura");

    // La fila queda intacta: sigue futura y por definir.
    const [fila] = await db.select().from(cohorts).where(eq(cohorts.id, cohorte.id));
    expect(fila.estado).toBe("futuro");
  });

  it("al definir las tres fechas, la cohorte se puede activar", async () => {
    const cohorte = await crearCohorte(db, actorId, porDefinir());
    await editarCohorte(db, actorId, cohorte.id, porDefinir({
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
    }));
    const activa = await activarCohorte(db, actorId, cohorte.id);
    expect(activa.estado).toBe("activo");
    expect(activa.fechaInicioClases).toBe("2026-10-01");
  });
});
