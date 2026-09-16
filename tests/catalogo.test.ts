import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { changeLog, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Catalogo } from "@/lib/catalogo/molde";
import { ErrorDeApp } from "@/lib/errors";
import { plataformasDePago } from "@/lib/catalogo/plataformas";
import { motivos } from "@/lib/catalogo/motivos";
import { origenes } from "@/lib/catalogo/origenes";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 011 estreno el molde con plataformas de pago; el ticket 012 agrega los
 * catalogos `motivos` y `origenes`. Los tres cumplen el mismo contrato (ADR 0012),
 * asi que las conductas se prueban una sola vez, parametrizadas por catalogo. Si
 * un catalogo nuevo entra al molde, se agrega una fila a `CATALOGOS` y hereda toda
 * la bateria, sin copiar tests.
 *
 * Base PGlite NUEVA por test (beforeEach/afterEach): cada caso mira `change_log` y
 * conteos sembrados, asi que compartir base filtraria filas entre tests y volveria
 * las aserciones dependientes del orden. Una base en memoria por test es hermetica
 * y barata.
 */

let db: Db;
let cerrar: () => Promise<void>;
let userId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  // userId es FK de change_log.userId: insertamos un usuario de prueba directo.
  const [u] = await db
    .insert(users)
    .values({ email: "tester@retiagrowth.com", rol: "gerente" })
    .returning();
  userId = u.id;
});

afterEach(async () => {
  await cerrar();
});

/** Filas de change_log de un registro concreto. */
async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

/** Cada catalogo del molde, con lo minimo que cambia entre uno y otro. */
interface CasoCatalogo {
  /** Titulo legible del bloque describe. */
  titulo: string;
  /** Fabrica del catalogo; recibe la base de prueba. */
  fabrica: (db: Db) => Catalogo<{ nombre: string }>;
  /** Nombre real de la tabla, como llega a change_log.tabla. */
  nombreTabla: string;
  /** Semillas que la migracion deja activas. */
  semillas: string[];
  /** Fragmento del mensaje de error 409 ("una plataforma de pago"). */
  entidad: string;
  /** Una semilla existente, para probar el choque de nombre sin distinguir case. */
  semillaExistente: string;
  /** La misma semilla en otra caja, que debe chocar por el indice lower(nombre). */
  semillaEnOtraCaja: string;
  /** Nombres nuevos que no chocan con ninguna semilla, para crear/editar. */
  nuevos: { crear: string; duplicable: string; editarA: string; desactivar: string };
}

const CATALOGOS: CasoCatalogo[] = [
  {
    titulo: "plataformas de pago",
    fabrica: plataformasDePago,
    nombreTabla: "plataformas_pago",
    semillas: [
      "PayPal",
      "MercadoPago",
      "Zelle",
      "DollarApp",
      "Bancolombia",
      "Global66",
      "Hotmart",
    ],
    entidad: "una plataforma de pago",
    semillaExistente: "PayPal",
    semillaEnOtraCaja: "paypal",
    nuevos: {
      crear: "Wise",
      duplicable: "Payoneer",
      editarA: "Payoneer Global",
      desactivar: "Skrill",
    },
  },
  {
    titulo: "motivos",
    fabrica: motivos,
    nombreTabla: "motivos",
    semillas: [
      "Dinero",
      "Horario",
      "Sin fit",
      "Viaje",
      "Otro programa",
      "Decisión de un tercero",
      "Sin respuesta",
      "Sin motivo",
    ],
    entidad: "un motivo",
    semillaExistente: "Dinero",
    semillaEnOtraCaja: "dinero",
    nuevos: {
      crear: "Miedo",
      duplicable: "Indeciso",
      editarA: "Muy indeciso",
      desactivar: "Distancia",
    },
  },
  {
    titulo: "origenes",
    fabrica: origenes,
    nombreTabla: "origenes",
    semillas: [
      "Agenda del día",
      "Follow-up",
      "Cola de descartados",
      "Cola de setteo",
      "Masivos",
      "Lanzamiento",
      "Referido",
    ],
    entidad: "un origen",
    semillaExistente: "Referido",
    semillaEnOtraCaja: "referido",
    nuevos: {
      crear: "Webinar",
      duplicable: "Evento",
      editarA: "Evento presencial",
      desactivar: "Podcast",
    },
  },
];

describe.each(CATALOGOS)("molde de catalogo — $titulo", (caso) => {
  it("a. la migracion deja sembradas las semillas activas", async () => {
    const cat = caso.fabrica(db);
    const filas = await cat.listar();
    expect(filas).toHaveLength(caso.semillas.length);
    expect(filas.every((f) => f.activo)).toBe(true);
    expect(filas.map((f) => f.nombre).sort()).toEqual([...caso.semillas].sort());
  });

  it("b. crear agrega una fila y deja change_log con origen app, userId y etiqueta", async () => {
    const cat = caso.fabrica(db);
    const creada = await cat.crear(userId, { nombre: caso.nuevos.crear });

    expect(creada.nombre).toBe(caso.nuevos.crear);
    expect(creada.activo).toBe(true);
    expect(await cat.listar()).toHaveLength(caso.semillas.length + 1);

    const log = await logDe(creada.id);
    expect(log).toHaveLength(1);
    expect(log[0].campo).toBe("nombre");
    expect(log[0].valorAnterior).toBeNull();
    expect(log[0].valorNuevo).toBe(caso.nuevos.crear);
    expect(log[0].origen).toBe("app");
    expect(log[0].userId).toBe(userId);
    expect(log[0].etiqueta).toBe(caso.nuevos.crear);
    expect(log[0].tabla).toBe(caso.nombreTabla);
  });

  it("c. crear rechaza input invalido (solo espacios) con ZodError y no escribe nada", async () => {
    const cat = caso.fabrica(db);
    const antes = await cat.listar();

    await expect(cat.crear(userId, { nombre: "   " })).rejects.toBeInstanceOf(ZodError);

    expect(await cat.listar()).toHaveLength(antes.length);
    // Ninguna fila nueva en change_log (solo el usuario, que no toca change_log).
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("d. crear rechaza un nombre duplicado sin distinguir mayusculas con ErrorDeApp 409", async () => {
    const cat = caso.fabrica(db);
    // La semilla en otra caja choca con la existente por el indice lower(nombre).
    const error = await cat.crear(userId, { nombre: caso.semillaEnOtraCaja }).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(409);
    expect((error as ErrorDeApp).message).toBe(`Ya existe ${caso.entidad} con ese nombre.`);
    // No se agrego nada.
    expect(await cat.listar()).toHaveLength(caso.semillas.length);
  });

  it("e. editar registra solo los campos que cambiaron; sin cambios no escribe", async () => {
    const cat = caso.fabrica(db);
    const creada = await cat.crear(userId, { nombre: caso.nuevos.duplicable });
    const logTrasCrear = (await logDe(creada.id)).length;

    // Editar con el MISMO nombre: no cambia nada, no escribe en change_log.
    await cat.editar(userId, creada.id, { nombre: caso.nuevos.duplicable });
    expect(await logDe(creada.id)).toHaveLength(logTrasCrear);

    // Editar con un nombre distinto: registra solo el campo 'nombre'.
    const editada = await cat.editar(userId, creada.id, { nombre: caso.nuevos.editarA });
    expect(editada.nombre).toBe(caso.nuevos.editarA);

    const log = await logDe(creada.id);
    const cambioNombre = log.filter(
      (l) => l.campo === "nombre" && l.valorAnterior === caso.nuevos.duplicable,
    );
    expect(cambioNombre).toHaveLength(1);
    expect(cambioNombre[0].valorNuevo).toBe(caso.nuevos.editarA);
    expect(cambioNombre[0].userId).toBe(userId);
  });

  it("f. editar un id inexistente lanza ErrorDeApp 404", async () => {
    const cat = caso.fabrica(db);
    const error = await cat
      .editar(userId, "00000000-0000-0000-0000-000000000000", { nombre: "X" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(404);
  });

  it("g. desactivar no borra la fila, la marca inactiva y registra activo true->false; dos veces no duplica", async () => {
    const cat = caso.fabrica(db);
    const creada = await cat.crear(userId, { nombre: caso.nuevos.desactivar });

    await cat.desactivar(userId, creada.id);

    // Sigue existiendo en la base (no DELETE), pero inactiva.
    const todas = await cat.listar();
    const enTodas = todas.find((f) => f.id === creada.id);
    expect(enTodas).toBeDefined();
    expect(enTodas!.activo).toBe(false);

    // Desaparece de los activos.
    const activas = await cat.listar({ soloActivos: true });
    expect(activas.find((f) => f.id === creada.id)).toBeUndefined();

    // Registro del cambio de activo.
    const cambiosActivo = (await logDe(creada.id)).filter((l) => l.campo === "activo");
    expect(cambiosActivo).toHaveLength(1);
    expect(cambiosActivo[0].valorAnterior).toBe("true");
    expect(cambiosActivo[0].valorNuevo).toBe("false");

    // Desactivar de nuevo no escribe otro registro.
    await cat.desactivar(userId, creada.id);
    expect((await logDe(creada.id)).filter((l) => l.campo === "activo")).toHaveLength(1);
  });
});

describe("guardian estatico — el molde nunca borra", () => {
  it("h. ningun archivo de lib/catalogo/ contiene .delete( ni delete from", () => {
    const dir = fileURLToPath(new URL("../lib/catalogo", import.meta.url));
    const archivos = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => path.join(dir, e.name));

    expect(archivos.length).toBeGreaterThan(0);

    for (const archivo of archivos) {
      const contenido = fs.readFileSync(archivo, "utf8").toLowerCase();
      expect(contenido, `${path.basename(archivo)} no puede borrar`).not.toContain(".delete(");
      expect(contenido, `${path.basename(archivo)} no puede borrar`).not.toContain("delete from");
    }
  });
});
