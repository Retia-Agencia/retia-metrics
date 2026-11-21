import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  crearCohorte,
  editarCohorte,
  type EntradaCohorte,
} from "@/lib/catalogo/cohortes";
import { hoyEnBogota } from "@/lib/format";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
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
let vaciar: () => Promise<void>;
let actorId: string;
let programId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [u] = await db.insert(users).values({ email: "gerente@retia.co", rol: "gerente" }).returning();
  actorId = u.id;
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "por-definir", nombre: "Por definir" })
    .returning();
  programId = p.id;
});

afterAll(async () => cerrar());

/** Una cohorte futura "por definir": precio y meta de cupos (obligatorios) y nada de fechas. */
function porDefinir(sobre: Partial<EntradaCohorte> = {}): EntradaCohorte {
  return {
    programId,
    codigo: "C1",
    metaCupos: 30,
    fechaInicioClases: "",
    fechaInicioVentas: "",
    fechaCierreVentas: "",
    ...sobre,
  } as EntradaCohorte;
}

describe("cohorte por definir (ticket 227)", () => {
  it("se crea una cohorte futura sin ninguna de las tres fechas", async () => {
    const cohorte = await crearCohorte(db, actorId, porDefinir());
    expect(cohorte.estado).toBe("futuro");
    expect(cohorte.fechaInicioClases).toBeNull();
    expect(cohorte.fechaInicioVentas).toBeNull();
    expect(cohorte.fechaCierreVentas).toBeNull();
  });

  it("al definir una ventana que incluye hoy, el estado calculado pasa a activo", async () => {
    const cohorte = await crearCohorte(db, actorId, porDefinir());
    const activa = await editarCohorte(db, actorId, cohorte.id, porDefinir({
      fechaInicioClases: hoyEnBogota(),
      fechaInicioVentas: hoyEnBogota(),
      // ADR 0137: sin cierre la ventana esta incompleta y la cohorte sigue "por definir".
      fechaCierreVentas: hoyEnBogota(),
    }));
    expect(activa.estado).toBe("activo");
    expect(activa.fechaInicioVentas).toBe(hoyEnBogota());
  });
});
