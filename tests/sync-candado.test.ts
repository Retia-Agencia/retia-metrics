import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { programs, sources, syncRuns } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { sincronizarPersonas, SyncEnCursoError } from "@/lib/sheets/sync";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * F-03 y F-07 son el mismo bug: la corrida se guardaba colgada de UNA fuente elegida
 * a dedo (`sources[0]`). De ahi salian dos males:
 *  - Sin llave por programa no habia sobre que poner un candado, asi que dos syncs
 *    simultaneos del mismo programa se pisaban (F-03). Con `neon-http` cada consulta
 *    es su propia sesion HTTP, asi que el candado no puede ser un lock de sesion: es
 *    el indice unico parcial `sync_runs_una_corriendo_por_programa_idx` (ADR 0005),
 *    y el INSERT de la corrida ES tomar el candado.
 *  - La corrida quedaba atribuida a UNA fuente (el formulario viejo de Comunicarte)
 *    habiendo leido las dos (F-07). Ahora guarda TODAS en `fuentes_leidas`.
 *
 * Base PGlite con TODAS las migraciones reales aplicadas: el indice unico parcial es
 * el de verdad, no una copia. `leerPestana` sale a Google, asi que se mockea.
 */

// El mock devuelve una matriz por (sheetId|tab): encabezado + una fila de persona.
// Los encabezados cumplen OBLIGATORIOS_FORMULARIO ("correo electronico", "submitted at").
const filasPorFuente = new Map<string, string[][]>();

vi.mock("@/lib/sheets/leer", () => ({
  leerPestana: vi.fn(async (sheetId: string, tab: string) => {
    return filasPorFuente.get(`${sheetId}|${tab}`) ?? [];
  }),
}));

let db: Db;
let cerrar: () => Promise<void>;

/** Siembra un programa y devuelve su id. */
async function sembrarPrograma(slug: string): Promise<string> {
  const [p] = await db
    .insert(programs)
    .values({ slug, nombre: slug, ticketUsd: "1000" })
    .returning();
  return p.id;
}

/**
 * Siembra una fuente de personas y registra su matriz mock (encabezado + `filas`
 * personas con correos distintos). Devuelve el id de la fuente.
 */
async function sembrarFuente(
  programId: string,
  opciones: { nombre: string; tab: string; orden: number; filas: number },
): Promise<string> {
  const sheetId = `sheet-${opciones.nombre}`;
  const [f] = await db
    .insert(sources)
    .values({
      programId,
      nombre: opciones.nombre,
      tipo: "google_sheet",
      sheetId,
      tab: opciones.tab,
      destino: "people",
      orden: opciones.orden,
    })
    .returning();

  const encabezado = ["correo electronico", "submitted at", "nombre completo"];
  const cuerpo: string[][] = [];
  for (let i = 0; i < opciones.filas; i++) {
    cuerpo.push([`${opciones.nombre}-${i}@correo.co`, "1/1/2026 10:00:00", `Persona ${i}`]);
  }
  filasPorFuente.set(`${sheetId}|${opciones.tab}`, [encabezado, ...cuerpo]);
  return f.id;
}

/** Inserta a mano una corrida `corriendo` con un `iniciado` dado. Simula un sync vivo o muerto. */
async function insertarCorridaViva(programId: string, iniciado: Date): Promise<string> {
  const [c] = await db
    .insert(syncRuns)
    .values({ programId, estado: "corriendo", iniciado })
    .returning();
  return c.id;
}

beforeEach(async () => {
  filasPorFuente.clear();
  ({ db, cerrar } = await crearBaseDePrueba());
});

afterEach(async () => {
  await cerrar();
});

describe("el candado por programa del sync (F-03)", () => {
  it("un segundo sync del mismo programa mientras el primero corre es rechazado con 409", async () => {
    const programId = await sembrarPrograma("comunicarte");
    await sembrarFuente(programId, { nombre: "Formulario actual", tab: "Actual", orden: 1, filas: 3 });
    // Una corrida viva y reciente ocupa el candado.
    await insertarCorridaViva(programId, new Date());

    const error = await sincronizarPersonas(programId, db).catch((e) => e);

    expect(error).toBeInstanceOf(SyncEnCursoError);
    expect((error as SyncEnCursoError).status).toBe(409);
  });

  it("la corrida viva no se toca cuando la segunda choca: sigue en 'corriendo' y sin errores", async () => {
    // La trampa de 2d: si el 409 se lanzara dentro del try grande, marcaria como
    // 'error' la corrida VIVA de otro proceso. Debe quedar intacta.
    const programId = await sembrarPrograma("comunicarte");
    await sembrarFuente(programId, { nombre: "Formulario actual", tab: "Actual", orden: 1, filas: 3 });
    const vivaId = await insertarCorridaViva(programId, new Date());

    await sincronizarPersonas(programId, db).catch((e) => e);

    const [viva] = await db.select().from(syncRuns).where(eq(syncRuns.id, vivaId));
    expect(viva.estado).toBe("corriendo");
    expect(viva.errores).toBeNull();
    expect(viva.terminado).toBeNull();
  });

  it("dos programas distintos no comparten candado: los dos syncs corren y terminan en 'ok'", async () => {
    const progA = await sembrarPrograma("comunicarte");
    const progB = await sembrarPrograma("tactical-investor");
    await sembrarFuente(progA, { nombre: "Form A", tab: "A", orden: 1, filas: 2 });
    await sembrarFuente(progB, { nombre: "Form B", tab: "B", orden: 1, filas: 2 });

    await sincronizarPersonas(progA, db);
    await sincronizarPersonas(progB, db);

    const corridas = await db.select().from(syncRuns);
    expect(corridas).toHaveLength(2);
    expect(corridas.every((c) => c.estado === "ok")).toBe(true);
    expect(new Set(corridas.map((c) => c.programId))).toEqual(new Set([progA, progB]));
  });
});

describe("el reaper de corridas abandonadas", () => {
  it("una corrida 'corriendo' mas vieja que el umbral queda en 'error' con su motivo, y la nueva arranca", async () => {
    const programId = await sembrarPrograma("comunicarte");
    await sembrarFuente(programId, { nombre: "Form", tab: "A", orden: 1, filas: 2 });
    // 20 minutos: mas alla del umbral de 10. La funcion que la abrio ya se cayo.
    const muertaId = await insertarCorridaViva(programId, new Date(Date.now() - 20 * 60_000));

    await sincronizarPersonas(programId, db);

    const [muerta] = await db.select().from(syncRuns).where(eq(syncRuns.id, muertaId));
    expect(muerta.estado).toBe("error");
    expect(muerta.terminado).not.toBeNull();
    expect((muerta.errores as string[])[0]).toContain("abandonada");

    // La nueva corrida arranco y termino bien: el candado quedo libre.
    const nuevas = await db
      .select()
      .from(syncRuns)
      .where(and(eq(syncRuns.programId, programId), eq(syncRuns.estado, "ok")));
    expect(nuevas).toHaveLength(1);
  });

  it("una corrida 'corriendo' mas nueva que el umbral NO se toca, y la nueva choca con 409", async () => {
    const programId = await sembrarPrograma("comunicarte");
    await sembrarFuente(programId, { nombre: "Form", tab: "A", orden: 1, filas: 2 });
    // 5 minutos: dentro del umbral de 10. Es un sync que de verdad sigue vivo.
    const vivaId = await insertarCorridaViva(programId, new Date(Date.now() - 5 * 60_000));

    const error = await sincronizarPersonas(programId, db).catch((e) => e);

    expect(error).toBeInstanceOf(SyncEnCursoError);
    const [viva] = await db.select().from(syncRuns).where(eq(syncRuns.id, vivaId));
    expect(viva.estado).toBe("corriendo");
    expect(viva.errores).toBeNull();
  });
});

describe("fuentes_leidas y el programa de la corrida (F-07)", () => {
  it("guarda nombre, tab y filas de CADA fuente leida (el caso Comunicarte, dos formularios)", async () => {
    const programId = await sembrarPrograma("comunicarte");
    await sembrarFuente(programId, { nombre: "Formulario anterior", tab: "Anterior", orden: 1, filas: 5 });
    await sembrarFuente(programId, { nombre: "Formulario actual", tab: "Actual", orden: 2, filas: 8 });

    await sincronizarPersonas(programId, db);

    const [corrida] = await db.select().from(syncRuns).where(eq(syncRuns.programId, programId));
    const fuentes = corrida.fuentesLeidas as { nombre: string; tab: string; filas: number }[];
    // Las dos fuentes, en orden, cada una con SU conteo: ninguna queda fuera (F-07).
    expect(fuentes).toEqual([
      { nombre: "Formulario anterior", tab: "Anterior", filas: 5 },
      { nombre: "Formulario actual", tab: "Actual", filas: 8 },
    ]);
  });

  it("la corrida queda con el program_id del programa sincronizado", async () => {
    const programId = await sembrarPrograma("tactical-investor");
    await sembrarFuente(programId, { nombre: "Form", tab: "A", orden: 1, filas: 3 });

    await sincronizarPersonas(programId, db);

    const [corrida] = await db.select().from(syncRuns);
    expect(corrida.programId).toBe(programId);
  });
});
