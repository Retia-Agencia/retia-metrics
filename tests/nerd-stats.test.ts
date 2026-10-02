import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  abonos,
  calls,
  changeLog,
  deals,
  leadContactos,
  leads,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  conteosPorOrigen,
  conteosPorPrograma,
  fuentesConSalud,
  textoDeFuentesLeidas,
  ultimosCambiosDesdeLaApp,
  usuariosActivosPorRol,
} from "@/lib/queries/nerd-stats";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

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
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1497.00" })
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
        tabla: "motivos",
        campo: "nombre",
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
    expect(filas.map((f) => f.tabla)).toEqual(["cohorts", "motivos"]);
    expect(filas[0].quien).toBe("gerente@retiagrowth.com");
  });

  it("respeta el limite", async () => {
    await db.insert(changeLog).values(
      Array.from({ length: 5 }, (_, i) => ({
        tabla: "motivos",
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

/**
 * Ticket 068: lo que el modelo nuevo hace visible. Los envios por programa, los leads "unidos
 * por telefono" sin resolver (050) y las fuentes marcadas (107, que reemplazo al 055).
 */
describe("conteosPorPrograma sobre el modelo nuevo (068)", () => {
  it("cuenta envios completos y parciales del programa de su fuente, y los leads unidos sin resolver", async () => {
    const [fuente] = await db.insert(sources).values({ programId: programaA, nombre: "Typeform" }).returning();
    await db.insert(submissions).values([
      { leadId: personaId, sourceId: fuente.id, token: "t1", esParcial: false },
      { leadId: personaId, sourceId: fuente.id, token: "t1", esParcial: true },
      { leadId: personaId, sourceId: fuente.id, token: "t2", esParcial: false },
    ]);
    // Dos correos sin confirmar en el MISMO lead cuentan un lead, no dos.
    await db.insert(leadContactos).values([
      { leadId: personaId, programId: programaA, tipo: "correo", valor: "otro1@ejemplo.com", confirmado: false },
      { leadId: personaId, programId: programaA, tipo: "correo", valor: "otro2@ejemplo.com", confirmado: false },
      // Confirmado: ya no es un pendiente.
      { leadId: personaId, programId: programaA, tipo: "correo", valor: "bueno@ejemplo.com", confirmado: true },
    ]);

    const filas = await conteosPorPrograma(db);
    expect(filas.find((f) => f.slug === "programa-a")).toMatchObject({ envios: 2, parciales: 1, unidosPorTelefono: 1 });
    // El programa es frontera: nada de A se cuela en B.
    expect(filas.find((f) => f.slug === "programa-b")).toMatchObject({ envios: 0, parciales: 0, unidosPorTelefono: 0 });
  });
});

describe("fuentesConSalud (068)", () => {
  it("lista las fuentes ACTIVAS con su salud, y una sin envios sale marcada", async () => {
    await db.insert(sources).values([
      { programId: programaA, nombre: "Activa" },
      { programId: programaB, nombre: "Apagada", activo: false },
    ]);
    const filas = await fuentesConSalud(db);
    expect(filas.map((f) => f.nombre)).toEqual(["Activa"]);
    expect(filas[0]).toMatchObject({ programaNombre: "Programa A", estado: "sin_envios", marcada: true, rota: false });
  });

  it("una fuente al dia no se marca; la columna rota la marca aunque reciba", async () => {
    const [fuente] = await db.insert(sources).values({ programId: programaA, nombre: "Typeform" }).returning();
    const ahora = new Date("2026-09-20T12:00:00Z");
    await db.insert(submissions).values({
      leadId: personaId,
      sourceId: fuente.id,
      token: "t1",
      esParcial: true,
      createdAt: new Date("2026-09-20T11:00:00Z"),
    });
    expect((await fuentesConSalud(db, ahora))[0]).toMatchObject({ estado: "al_dia", marcada: false });

    await db.update(sources).set({ estado: "rota" });
    expect((await fuentesConSalud(db, ahora))[0]).toMatchObject({ estado: "al_dia", rota: true, marcada: true });
  });
});

describe("textoDeFuentesLeidas (068, ADR 0031)", () => {
  it("una corrida sin el dato muestra —, nunca un nombre inventado", () => {
    expect(textoDeFuentesLeidas(null)).toBe("—");
    expect(
      textoDeFuentesLeidas([
        { nombre: "Hoja", tab: "New form", filas: 1234 },
        { nombre: "Forms", tab: "Viejo", filas: 55 },
      ]),
    ).toBe("Hoja (1.234) + Forms (55)");
  });
});

describe("la guarda de /nerd-stats (068, ADR 0025)", () => {
  it("no escribe el rol a mano: pasa por paginaDeAccesoTotal", () => {
    const fuente = readFileSync("app/(app)/nerd-stats/page.tsx", "utf8");
    expect(fuente).toContain("await paginaDeAccesoTotal()");
    expect(fuente).not.toMatch(/paginaConRol\(|requireRole\(|"developer"/);
  });
});
