import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, cohorts, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  activarCohorte,
  crearCohorte,
  editarCohorte,
  type EntradaCohorte,
} from "@/lib/catalogo/cohortes";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Las DOS ramas de `normalizando` en `lib/catalogo/cohortes.ts` que traducen un
 * error del driver a un `ErrorDeApp` 400: la violacion de indice unico (23505) y
 * la del CHECK `cohorts_activa_con_inicio_ventas` (23514, ADR 0022).
 *
 * Estaban sin cubrir. Aparecieron al unificar el helper `normalizando`, que vivia
 * duplicado byte a byte en nueve modulos: cohortes fue la UNICA excepcion legitima
 * (hace mas que traducir zod) y quedo componiendo sobre `lib/errors-zod.ts`. Una
 * rama que nadie muerde es una creencia, y esta en particular falla callada: si
 * dejara de traducir, el choque saldria como 500 "Error interno." y la pantalla
 * diria que el problema es del servidor cuando el problema es del dato.
 *
 * El choque lo produce la BASE, nunca un error fabricado a mano con
 * `{ code: "23505" }`: lo que se prueba es que la garantia dura (el indice y el
 * CHECK, que es donde vive la regla segun el ADR 0005) llega al usuario como un
 * mensaje que se puede accionar. Un error inventado probaria el `if`, no la regla.
 *
 * Base PGlite NUEVA por test: varios casos miran `change_log`, y compartir base
 * filtraria filas entre ellos.
 */

let db: Db;
let cerrar: () => Promise<void>;
let actorId: string;
let programaA: string;
let programaB: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  const [u] = await db
    .insert(users)
    .values({ email: "tester@retiagrowth.com", rol: "gerente" })
    .returning();
  actorId = u.id;

  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;

  const [b] = await db
    .insert(programs)
    .values({ slug: "programa-b", nombre: "Programa B", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;
});

afterEach(async () => {
  await cerrar();
});

/** Una cohorte valida; cada test cambia solo lo que le importa. */
function entrada(sobre: Partial<EntradaCohorte> = {}): EntradaCohorte {
  return {
    programId: programaA,
    codigo: "C1",
    metaCupos: 30,
    precioUsd: "797.00",
    fechaInicioClases: "2026-10-01",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-09-30",
    trmCohorte: "4000.00",
    estado: "futuro",
    ...sobre,
  } as EntradaCohorte;
}

/** Corre algo que debe fallar y devuelve el error, sin dejar pasar un exito callado. */
async function errorDe(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error("se esperaba un error y la operacion tuvo exito");
}

describe("cohortes: el indice unico (23505) sale como 400 y no como 500", () => {
  it("dos cohortes con el mismo codigo en el mismo programa chocan con un mensaje accionable", async () => {
    await crearCohorte(db, actorId, entrada({ codigo: "C1" }));

    const error = await errorDe(() => crearCohorte(db, actorId, entrada({ codigo: "C1" })));

    // Lo que importa: llega tipado, con status, y el texto nombra la causa real.
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message).toContain("el código ya existe");
  });

  it("el choque no deja la cohorte a medias ni basura en change_log", async () => {
    await crearCohorte(db, actorId, entrada({ codigo: "C1" }));
    const logAntes = await db.select().from(changeLog);

    await errorDe(() => crearCohorte(db, actorId, entrada({ codigo: "C1" })));

    // `ejecutarJuntas` es atomico: la fila que no entro no puede haber dejado rastro.
    const filas = await db.select().from(cohorts).where(eq(cohorts.programId, programaA));
    expect(filas).toHaveLength(1);
    expect(await db.select().from(changeLog)).toHaveLength(logAntes.length);
  });

  it("muerde en el otro sentido: el MISMO codigo en otro programa se permite", async () => {
    await crearCohorte(db, actorId, entrada({ codigo: "C1", programId: programaA }));
    const otra = await crearCohorte(db, actorId, entrada({ codigo: "C1", programId: programaB }));

    // El indice es (program_id, codigo). Si este test fallara, el indice seria
    // solo sobre `codigo` y la traduccion de arriba estaria cazando de mas.
    expect(otra.codigo).toBe("C1");
    expect(otra.programId).toBe(programaB);
  });

  it("editar una cohorte hacia un codigo ya tomado choca igual", async () => {
    await crearCohorte(db, actorId, entrada({ codigo: "C1" }));
    const segunda = await crearCohorte(db, actorId, entrada({ codigo: "C2" }));

    const error = await errorDe(() =>
      editarCohorte(db, actorId, segunda.id, entrada({ codigo: "C1" })),
    );

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message).toContain("el código ya existe");
  });
});

describe("cohortes: el CHECK de inicio de ventas (23514) sale como 400 y no como 500", () => {
  /**
   * `crearCohorte` y `editarCohorte` NO pueden llegar al CHECK: el `superRefine`
   * del esquema zod ataja "activa sin inicio de ventas" antes de tocar la base.
   * `activarCohorte` es el camino que se salta zod por completo —lee la fila y le
   * cambia el estado—, asi que es el unico que le llega a la garantia dura. Por eso
   * la rama existe, y por eso se prueba por aca.
   */
  it("activar una cohorte guardada sin fecha de inicio de ventas da un 400 claro", async () => {
    const cohorte = await crearCohorte(
      db,
      actorId,
      entrada({ estado: "futuro", fechaInicioVentas: null }),
    );
    expect(cohorte.fechaInicioVentas).toBeNull();

    const error = await errorDe(() => activarCohorte(db, actorId, cohorte.id));

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect((error as ErrorDeApp).message).toBe(
      "Una cohorte activa necesita fecha de inicio de ventas.",
    );
  });

  it("el rechazo del CHECK deja la fila intacta", async () => {
    const cohorte = await crearCohorte(
      db,
      actorId,
      entrada({ estado: "futuro", fechaInicioVentas: null }),
    );

    await errorDe(() => activarCohorte(db, actorId, cohorte.id));

    const [fila] = await db.select().from(cohorts).where(eq(cohorts.id, cohorte.id));
    expect(fila.estado).toBe("futuro");
  });

  it("muerde en el otro sentido: con fecha de inicio de ventas, activar funciona", async () => {
    const cohorte = await crearCohorte(
      db,
      actorId,
      entrada({ estado: "futuro", fechaInicioVentas: "2026-09-01" }),
    );

    const activa = await activarCohorte(db, actorId, cohorte.id);

    expect(activa.estado).toBe("activo");
  });
});
