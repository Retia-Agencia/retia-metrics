import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, changeLog, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  conteosPorOrigen,
  conteosPorPrograma,
  ultimosCambiosDesdeLaApp,
  usuariosActivosPorRol,
} from "@/lib/queries/nerd-stats";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 025 — las lecturas de `/nerd-stats`, sobre PGlite con las migraciones
 * reales (ADR 0020).
 *
 * El caso que mas importa es el ultimo: la bitacora NO puede devolver el nombre ni
 * el correo de un lead. Es un criterio de aceptacion, y sin test se cumple hoy por
 * como esta escrita la consulta y se rompe el dia que alguien agregue una columna
 * "para ver que cambio".
 */

let db: Db;
let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
let gerenteId: string;
let personaId: string;

const CORREO_LEAD = "lead.privado@ejemplo.com";
const NOMBRE_LEAD = "Lead Privado";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente" })
    .returning();
  gerenteId = g.id;
  await db.insert(users).values([
    { email: "dev@retiagrowth.com", rol: "developer" },
    { email: "ana@retiagrowth.com", rol: "closer", closerId: "Ana" },
    // Inactivo: no debe contarse.
    { email: "viejo@retiagrowth.com", rol: "closer", closerId: "Viejo", activo: false },
  ]);

  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ slug: "programa-b", nombre: "Programa B", ticketUsd: "1497.00" })
    .returning();
  programaB = b.id;

  const [persona] = await db
    .insert(leads)
    .values({
      programId: programaA,
      emailNormalizado: CORREO_LEAD,
      nombre: NOMBRE_LEAD,
    })
    .returning();
  personaId = persona.id;
});

afterEach(async () => {
  await cerrar();
});

describe("conteosPorPrograma", () => {
  it("cuenta cada entidad por separado, sin inflarse entre si", async () => {
    // Dos llamadas y dos deals en el MISMO programa: con joins en vez de
    // subconsultas, cada conteo saldria en 4.
    //
    // Los dos deals del mismo lead solo pueden coexistir si uno esta CERRADO: el
    // indice unico parcial del ADR 0037 deja un solo deal abierto por lead y
    // programa, y eso lo muerde `tests/modelo-crm-indices.test.ts`.
    const dealsSembrados = await db
      .insert(deals)
      .values([
        { leadId: personaId, programId: programaA },
        { leadId: personaId, programId: programaA, etapa: "cierre_perdido" as const },
      ])
      .returning();
    await db.insert(calls).values([
      { programId: programaA, dealId: dealsSembrados[0].id, origen: "app" },
      { programId: programaA, dealId: dealsSembrados[0].id, origen: "sheets", huellaFila: "h1" },
    ]);
    await db.insert(abonos).values({
      dealId: dealsSembrados[0].id,
      programId: programaA,
      fecha: "2026-09-17",
      monto: "100.00",
    });

    const filas = await conteosPorPrograma(db);
    const a = filas.find((f) => f.slug === "programa-a")!;
    expect(a).toMatchObject({ personas: 1, llamadas: 2, deals: 2, abonos: 1 });
  });

  it("un programa sin nada sale en cero, no se omite", async () => {
    const filas = await conteosPorPrograma(db);
    expect(filas.find((f) => f.slug === "programa-b")).toMatchObject({
      personas: 0,
      llamadas: 0,
      deals: 0,
      abonos: 0,
    });
    expect(programaB).toBeTruthy();
  });
});

describe("conteosPorOrigen", () => {
  it("separa lo que entro por la hoja de lo que se registro en la app", async () => {
    await db.insert(calls).values([
      { programId: programaA, origen: "app" },
      { programId: programaA, origen: "sheets", huellaFila: "h1" },
      { programId: programaA, origen: "sheets", huellaFila: "h2" },
    ]);
    // El desglose de VENTAS por origen se fue con `sales` (ticket 038): delataba
    // su origen por `huellaFila`, y un deal no nace de una fila de hoja.
    const { llamadas } = await conteosPorOrigen(db);
    expect(llamadas.find((l) => l.origen === "app")?.total).toBe(1);
    expect(llamadas.find((l) => l.origen === "sheets")?.total).toBe(2);
  });
});

describe("usuariosActivosPorRol", () => {
  it("cuenta solo activos y agrupa por rol", async () => {
    const filas = await usuariosActivosPorRol(db);
    const porRol = Object.fromEntries(filas.map((f) => [f.rol, f.total]));
    expect(porRol).toEqual({ gerente: 1, developer: 1, closer: 1 });
  });
});

describe("ultimosCambiosDesdeLaApp", () => {
  it("trae solo los cambios con origen app, del mas nuevo al mas viejo", async () => {
    await db.insert(changeLog).values([
      {
        tabla: "programs",
        campo: "nombre",
        origen: "sync",
        detectadoEn: new Date("2026-09-17T10:00:00Z"),
      },
      {
        tabla: "productos",
        campo: "precioLista",
        origen: "app",
        userId: gerenteId,
        detectadoEn: new Date("2026-09-17T11:00:00Z"),
      },
      {
        tabla: "cohorts",
        campo: "estado",
        origen: "app",
        userId: gerenteId,
        detectadoEn: new Date("2026-09-17T12:00:00Z"),
      },
    ]);

    const filas = await ultimosCambiosDesdeLaApp(15, db);
    expect(filas.map((f) => f.tabla)).toEqual(["cohorts", "productos"]);
    expect(filas[0].quien).toBe("gerente@retiagrowth.com");
  });

  it("respeta el limite", async () => {
    await db.insert(changeLog).values(
      Array.from({ length: 5 }, (_, i) => ({
        tabla: "productos",
        campo: `campo-${i}`,
        origen: "app" as const,
        detectadoEn: new Date(Date.UTC(2026, 8, 17, 10, i)),
      })),
    );
    expect(await ultimosCambiosDesdeLaApp(2, db)).toHaveLength(2);
  });

  it("NUNCA devuelve el nombre ni el correo de un lead, aunque la bitacora los tenga", async () => {
    // Asi es EXACTAMENTE como `lib/mutations/personas.ts` escribe la bitacora al
    // asignar responsable: la etiqueta es el nombre o el correo de la persona.
    await db.insert(changeLog).values({
      tabla: "leads",
      registroId: personaId,
      etiqueta: NOMBRE_LEAD,
      campo: "nombre",
      valorAnterior: null,
      valorNuevo: CORREO_LEAD,
      origen: "app",
      userId: gerenteId,
    });

    const filas = await ultimosCambiosDesdeLaApp(15, db);
    expect(filas).toHaveLength(1);
    // Lo que si sale: metadatos.
    expect(filas[0]).toMatchObject({ tabla: "leads", campo: "nombre" });
    // Lo que no puede salir, mirado sobre la fila entera y no columna por columna:
    // una columna nueva con datos del lead tambien haria fallar esto.
    const serializada = JSON.stringify(filas[0]);
    expect(serializada).not.toContain(NOMBRE_LEAD);
    expect(serializada).not.toContain(CORREO_LEAD);
  });
});
