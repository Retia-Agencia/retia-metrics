import "./load-env";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { programs, cohorts, sources } from "../lib/db/schema";
import { MAPEO_FORMULARIO } from "../lib/sheets/mapeo";

/**
 * Siembra programas, cohortes y fuentes con los datos reales.
 * Idempotente: correrlo dos veces no duplica nada.
 *
 * SOLO ES LA SEMILLA INICIAL (ADR 0012, ticket 014). El dia a dia —crear un
 * programa, editar sus URLs, abrir o cerrar una cohorte, cambiar la meta o la TRM—
 * se hace desde `/ajustes/programas` sin tocar codigo ni correr este script. Este
 * archivo existe para arrancar una base vacia (local, `dev` o produccion la primera
 * vez), no para administrar el catalogo despues.
 */

/**
 * Los IDs de las hojas van por variable de entorno, no escritos aca.
 *
 * No son credenciales —quien tenga el ID sigue necesitando permiso de Google— pero
 * son la direccion exacta de las dos BBDD con todos los leads, y el permiso de una
 * hoja es una casilla que alguien puede cambiar a "cualquiera con el enlace" sin
 * enterarse de que el enlace ya esta publicado en un repo.
 */
function idDeHoja(variable: string): string {
  const v = process.env[variable];
  if (!v) {
    throw new Error(
      `Falta ${variable} en .env.local. Los IDs de las hojas ya no estan en el codigo: ` +
        `copialos de la URL de cada Google Sheet (la parte entre /d/ y /edit).`,
    );
  }
  return v;
}

const SHEET_COMUNICARTE = idDeHoja("SHEET_ID_COMUNICARTE");
const SHEET_TACTICAL = idDeHoja("SHEET_ID_TACTICAL");

async function main() {
  // ── Programas ───────────────────────────────────────────────
  const defsProgramas = [
    {
      slug: "comunicarte",
      nombre: "Comunicarte",
      ticketUsd: "797.00",
      recordPersonasPorDiaHabil: 73,
    },
    {
      slug: "tactical-investor",
      nombre: "Tactical Investor",
      ticketUsd: "1500.00",
      recordPersonasPorDiaHabil: 30,
    },
  ];

  const idPrograma: Record<string, string> = {};
  for (const d of defsProgramas) {
    const [existe] = await db.select().from(programs).where(eq(programs.slug, d.slug)).limit(1);
    if (existe) {
      await db.update(programs).set(d).where(eq(programs.id, existe.id));
      idPrograma[d.slug] = existe.id;
      console.log(`  = programa ${d.slug}`);
    } else {
      const [nuevo] = await db.insert(programs).values(d).returning();
      idPrograma[d.slug] = nuevo.id;
      console.log(`  + programa ${d.slug}`);
    }
  }

  // ── Cohortes ──────────────────────────────────────────────────
  const defsCohortes = [
    {
      programa: "comunicarte", codigo: "C1", metaCupos: 30, precioUsd: "697.00",
      fechaInicioClases: "2026-08-11", fechaCierreVentas: "2026-08-11", estado: "cerrado" as const,
      notas: "Cerro con 30 compradores. Lead a venta 2,64%, invitado a venta 21,5%.",
    },
    {
      programa: "comunicarte", codigo: "C2", metaCupos: 50, precioUsd: "797.00",
      fechaInicioClases: "2026-09-22", fechaCierreVentas: "2026-09-22", estado: "activo" as const,
      notas: "Precio subio de 697 a 797 el 13-ago. Se respeta el anterior a quien ya lo tenia cotizado.",
    },
    {
      programa: "tactical-investor", codigo: "C1", metaCupos: 30, precioUsd: "1500.00",
      fechaInicioClases: "2026-08-18", fechaCierreVentas: "2026-08-18", estado: "cerrado" as const,
      notas: "31 matriculados sobre meta de 30, pero solo 17 pasaron por el registro de llamadas.",
    },
    {
      programa: "tactical-investor", codigo: "C2", metaCupos: 50, precioUsd: "1500.00",
      fechaInicioClases: "2026-09-29", fechaCierreVentas: "2026-09-29", estado: "activo" as const,
      notas: "Meta de 50 cerrados por el equipo. Lo que entre por webinar es adicional.",
    },
  ];

  for (const { programa, ...d } of defsCohortes) {
    const programId = idPrograma[programa];
    const [existe] = await db
      .select().from(cohorts)
      .where(and(eq(cohorts.programId, programId), eq(cohorts.codigo, d.codigo))).limit(1);
    if (existe) {
      await db.update(cohorts).set({ ...d, programId }).where(eq(cohorts.id, existe.id));
      console.log(`  = cohorte ${programa} ${d.codigo}`);
    } else {
      await db.insert(cohorts).values({ ...d, programId });
      console.log(`  + cohorte ${programa} ${d.codigo}`);
    }
  }

  // ── Fuentes ─────────────────────────────────────────────────
  // Solo las de personas quedan activas: son las unicas con mapeo verificado.
  // Las de llamadas, ventas y pauta entran cuando se inspeccionen sus encabezados.
  const defsFuentes = [
    // Comunicarte
    { programa: "comunicarte", nombre: "Formulario actual", sheetId: SHEET_COMUNICARTE, tab: "New form", destino: "people", orden: 2, activo: true, mapeoColumnas: MAPEO_FORMULARIO },
    { programa: "comunicarte", nombre: "Formulario anterior", sheetId: SHEET_COMUNICARTE, tab: "Forms viejo", destino: "people", orden: 1, activo: true, mapeoColumnas: MAPEO_FORMULARIO },
    { programa: "comunicarte", nombre: "Registro de llamadas", sheetId: SHEET_COMUNICARTE, tab: "Registro de llamadas", destino: "calls", orden: 3, activo: false, mapeoColumnas: {} },
    { programa: "comunicarte", nombre: "Estudiantes", sheetId: SHEET_COMUNICARTE, tab: "Estudiantes Agosto", destino: "sales", orden: 4, activo: false, mapeoColumnas: {} },
    { programa: "comunicarte", nombre: "Pauta", sheetId: SHEET_COMUNICARTE, tab: "ROAS ESTUDIASTES AGOSTO", destino: "ad_spend", orden: 5, activo: false, mapeoColumnas: {} },

    // Tactical Investor
    { programa: "tactical-investor", nombre: "Formulario", sheetId: SHEET_TACTICAL, tab: "De Cero a Tactical Investor", destino: "people", orden: 1, activo: true, mapeoColumnas: MAPEO_FORMULARIO },
    { programa: "tactical-investor", nombre: "Registro de llamadas", sheetId: SHEET_TACTICAL, tab: "Registro de llamadas", destino: "calls", orden: 2, activo: false, mapeoColumnas: {} },
    { programa: "tactical-investor", nombre: "Estudiantes C1", sheetId: SHEET_TACTICAL, tab: "Estudiantes Cohort Julio", destino: "sales", orden: 3, activo: false, mapeoColumnas: {} },
    { programa: "tactical-investor", nombre: "Estudiantes C2", sheetId: SHEET_TACTICAL, tab: "Septiembre Estudiantes Cohort", destino: "sales", orden: 4, activo: false, mapeoColumnas: {} },
    { programa: "tactical-investor", nombre: "Pauta C1", sheetId: SHEET_TACTICAL, tab: "ROAS COHORT JULIO", destino: "ad_spend", orden: 5, activo: false, mapeoColumnas: {} },
  ];

  for (const { programa, ...d } of defsFuentes) {
    const programId = idPrograma[programa];
    const [existe] = await db
      .select().from(sources)
      .where(and(eq(sources.programId, programId), eq(sources.tab, d.tab!))).limit(1);
    if (existe) {
      await db.update(sources).set({ ...d, programId }).where(eq(sources.id, existe.id));
      console.log(`  = fuente ${programa} / ${d.tab}${d.activo ? "" : "  (inactiva)"}`);
    } else {
      await db.insert(sources).values({ ...d, programId });
      console.log(`  + fuente ${programa} / ${d.tab}${d.activo ? "" : "  (inactiva)"}`);
    }
  }

  console.log("\nSiembra completa.\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error("Fallo:", e); process.exit(1); });
