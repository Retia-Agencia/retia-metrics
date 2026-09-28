import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { changeLog, programs, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moldeDeCatalogo } from "@/lib/catalogo/molde";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * El bug del 28-sep, probado de punta a punta contra PGlite: editar un campo jsonb de
 * una fuente por el molde (como lo hace `/ajustes/fuentes`) tiene que registrar el JSON
 * REAL en `change_log`, y editar con el MISMO objeto (aunque llegue con las llaves en
 * otro orden) NO debe escribir ninguna fila ni tocar la fila.
 *
 * Antes, `aTexto` hacia `String(valor)` = "[object Object]" para todo objeto, asi que:
 *  - la bitacora guardaba "[object Object]" en vez del mapeo, y
 *  - el diff `aTexto(actual) !== aTexto(nuevo)` daba `false` para dos mapeos DISTINTOS,
 *    de modo que un cambio real del jsonb no se registraba y, cuando era lo unico que
 *    cambiaba, ni siquiera se escribia el `update`.
 *
 * Se usa el molde directo sobre `sources` (no `editarFuente`) para que el test sea
 * hermetico: `editarFuente` prueba el mapeo contra Google Sheets, que aqui no existe.
 */

let db: Db;
let cerrar: () => Promise<void>;
let userId: string;
let programId: string;

// Un esquema minimo que cubre las columnas jsonb y las de texto de una fuente. Solo
// para el test: el esquema real vive en `lib/catalogo/fuentes.ts`, pero arrastra la
// prueba contra la hoja. Lo que se ejercita aqui es el molde + `textoDeBitacora`.
const esquemaFuentePrueba = z.object({
  programId: z.string().uuid(),
  nombre: z.string().min(1),
  tipo: z.enum(["google_sheet", "upload", "webhook"]).default("google_sheet"),
  sheetId: z.string().nullable().default(null),
  tab: z.string().nullable().default(null),
  rango: z.string().default("A1:BZ"),
  mapeoColumnas: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  activo: z.boolean().default(true),
});

// La entrada del molde se tipa con el INPUT del esquema (los campos con default son
// opcionales), igual que `lib/catalogo/fuentes.ts` tipa el suyo. El molde re-parsea con
// zod en runtime de todos modos.
type EntradaFuentePrueba = z.input<typeof esquemaFuentePrueba>;

function moldeFuentesPrueba(base: Db) {
  return moldeDeCatalogo(
    {
      tabla: sources,
      nombreTabla: "sources",
      esquema: esquemaFuentePrueba as unknown as z.ZodType<EntradaFuentePrueba>,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "una fuente",
    },
    base,
  );
}

/** Filas de change_log de un registro concreto. */
async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [u] = await db
    .insert(users)
    .values({ email: "tester@retiagrowth.com", rol: "gerente" })
    .returning();
  userId = u.id;
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "prueba", nombre: "Programa de prueba", ticketUsd: "797.00" })
    .returning();
  programId = p.id;
});

afterEach(async () => {
  await cerrar();
});

describe("change_log de un campo jsonb (sources.mapeo_columnas)", () => {
  it("editar el mapeo guarda el JSON REAL, no '[object Object]'", async () => {
    const molde = moldeFuentesPrueba(db);
    const fuente = await molde.crear(userId, {
      programId,
      nombre: "Formulario",
      sheetId: "abc",
      tab: "Hoja 1",
      mapeoColumnas: { correo: "Correo" },
    });

    await molde.editar(userId, fuente.id, {
      programId,
      nombre: "Formulario",
      sheetId: "abc",
      tab: "Hoja 1",
      mapeoColumnas: { correo: "Correo", telefono: "Teléfono" },
    });

    const filas = await logDe(fuente.id);
    const edicion = filas.filter((f) => f.campo === "mapeoColumnas" && f.valorAnterior !== null);
    expect(edicion).toHaveLength(1);
    expect(edicion[0].valorAnterior).toBe('{"correo":"Correo"}');
    expect(edicion[0].valorNuevo).toBe('{"correo":"Correo","telefono":"Teléfono"}');
    // Nunca la cadena inutil.
    for (const f of filas) {
      expect(f.valorAnterior ?? "").not.toContain("[object Object]");
      expect(f.valorNuevo ?? "").not.toContain("[object Object]");
    }

    // Y la fila se escribio de verdad.
    const [fila] = await db.select().from(sources).where(eq(sources.id, fuente.id));
    expect(fila.mapeoColumnas).toEqual({ correo: "Correo", telefono: "Teléfono" });
  });

  it("editar con el MISMO mapeo (aunque en otro orden de llaves) NO escribe fila ni bitacora", async () => {
    const molde = moldeFuentesPrueba(db);
    const fuente = await molde.crear(userId, {
      programId,
      nombre: "Formulario",
      sheetId: "abc",
      tab: "Hoja 1",
      mapeoColumnas: { correo: "Correo", telefono: "Teléfono" },
    });

    const logInicial = await logDe(fuente.id);

    // Mismo contenido, llaves al reves: no es un cambio.
    await molde.editar(userId, fuente.id, {
      programId,
      nombre: "Formulario",
      sheetId: "abc",
      tab: "Hoja 1",
      mapeoColumnas: { telefono: "Teléfono", correo: "Correo" },
    });

    const logFinal = await logDe(fuente.id);
    expect(logFinal).toHaveLength(logInicial.length);
    expect(logFinal.some((f) => f.campo === "mapeoColumnas" && f.valorAnterior !== null)).toBe(false);
  });

  it("editar SOLO el jsonb (nada de texto cambia) tambien registra el cambio", async () => {
    // El caso peor del bug: cuando el jsonb era lo unico que cambiaba, el molde cortaba
    // con `if (cambiados.length === 0) return actual` y NO escribia ni el update ni la
    // bitacora. Con el diff arreglado, el update y la bitacora si ocurren.
    const molde = moldeFuentesPrueba(db);
    const fuente = await molde.crear(userId, {
      programId,
      nombre: "Formulario",
      sheetId: "abc",
      tab: "Hoja 1",
      mapeoColumnas: { correo: "Correo" },
    });

    await molde.editar(userId, fuente.id, {
      programId,
      nombre: "Formulario",
      sheetId: "abc",
      tab: "Hoja 1",
      mapeoColumnas: { correo: "Otra columna" },
    });

    const edicion = (await logDe(fuente.id)).filter(
      (f) => f.campo === "mapeoColumnas" && f.valorAnterior !== null,
    );
    expect(edicion).toHaveLength(1);
    expect(edicion[0].valorNuevo).toBe('{"correo":"Otra columna"}');

    const [fila] = await db.select().from(sources).where(eq(sources.id, fuente.id));
    expect(fila.mapeoColumnas).toEqual({ correo: "Otra columna" });
  });
});
