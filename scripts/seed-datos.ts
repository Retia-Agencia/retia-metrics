import "./load-env";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { programs, cohorts, sources, productos, categoriasRecurso } from "../lib/db/schema";
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
      fechaInicioClases: "2026-08-11", fechaInicioVentas: null, fechaCierreVentas: "2026-08-11",
      estado: "cerrado" as const,
      notas: "Cerro con 30 compradores. Lead a venta 2,64%, invitado a venta 21,5%.",
    },
    {
      programa: "comunicarte", codigo: "C2", metaCupos: 50, precioUsd: "797.00",
      fechaInicioClases: "2026-09-22", fechaInicioVentas: "2026-08-14", fechaCierreVentas: "2026-09-21",
      estado: "activo" as const,
      notas: "Precio subio de 697 a 797 el 13-ago. Se respeta el anterior a quien ya lo tenia cotizado.",
    },
    {
      programa: "tactical-investor", codigo: "C1", metaCupos: 30, precioUsd: "1500.00",
      fechaInicioClases: "2026-08-18", fechaInicioVentas: null, fechaCierreVentas: "2026-08-18",
      estado: "cerrado" as const,
      notas: "31 matriculados sobre meta de 30, pero solo 17 pasaron por el registro de llamadas.",
    },
    {
      programa: "tactical-investor", codigo: "C2", metaCupos: 50, precioUsd: "1500.00",
      fechaInicioClases: "2026-09-29", fechaInicioVentas: "2026-08-19", fechaCierreVentas: "2026-09-29",
      estado: "activo" as const,
      notas: "Meta de 50 cerrados por el equipo. Lo que entre por webinar es adicional.",
    },
  ];

  for (const { programa, ...d } of defsCohortes) {
    const programId = idPrograma[programa];
    const [existe] = await db
      .select().from(cohorts)
      .where(and(eq(cohorts.programId, programId), eq(cohorts.codigo, d.codigo))).limit(1);
    if (existe) {
      // Una cohorte existente se administra desde /ajustes; no se pisa lo demas. La
      // ventana de venta (ADR 0022) SI se re-siembra: la migracion 0009 la corrigio
      // en las bases ya pobladas y la semilla debe dejar el mismo valor de origen.
      await db
        .update(cohorts)
        .set({
          fechaInicioVentas: d.fechaInicioVentas,
          fechaCierreVentas: d.fechaCierreVentas,
        })
        .where(eq(cohorts.id, existe.id));
      console.log(`  = cohorte ${programa} ${d.codigo} (ventana de venta actualizada)`);
    } else {
      await db.insert(cohorts).values({ ...d, programId });
      console.log(`  + cohorte ${programa} ${d.codigo}`);
    }
  }

  // ── Productos ─────────────────────────────────────────────────
  // Semilla inicial de productos por programa (ticket 017, ADR 0016). El dia a dia
  // —crear, editar, desactivar— se hace desde /productos sin tocar este script.
  // Los slugs literales estan permitidos aqui: el contrato de extension (ADR 0012)
  // solo cubre lib/, app/ y components/, no scripts/.
  const defsProductos = [
    { programa: "comunicarte", nombre: "Programa completo", precioLista: "797.00", moneda: "USD" },
    { programa: "comunicarte", nombre: "Reserva de cupo", precioLista: "400.00", moneda: "USD" },
    { programa: "tactical-investor", nombre: "Programa completo", precioLista: "1500.00", moneda: "USD" },
  ];

  for (const { programa, ...d } of defsProductos) {
    const programId = idPrograma[programa];
    const [existe] = await db
      .select().from(productos)
      .where(and(eq(productos.programId, programId), eq(productos.nombre, d.nombre))).limit(1);
    // Solo inserta lo que falta: un producto existente se edita desde /productos y
    // re-sembrar no debe pisar esos cambios (quedarian fuera de change_log).
    if (existe) {
      console.log(`  = producto ${programa} / ${d.nombre} (ya existe, no se toca)`);
    } else {
      await db.insert(productos).values({ ...d, programId });
      console.log(`  + producto ${programa} / ${d.nombre}`);
    }
  }

  // ── Fuentes ─────────────────────────────────────────────────
  // Una fuente es el INTAKE DE LEADS del programa y nada mas (ADR 0039). Las filas
  // de llamadas, ventas y pauta se fueron con la columna `destino`: en el modelo v2
  // esos hechos NACEN en el CRM (ADR 0037) y no entran de una hoja.
  //
  // ⚠️ `Formulario anterior` nace INACTIVA. No es un detalle de siembra: el indice
  // `sources_una_activa_por_programa_idx` deja UNA sola fuente activa por programa,
  // asi que sembrarla activa haria fallar el seed. Se conserva como fila porque la
  // etapa 7 recupera sus 55 personas con sus envios, y esos `submissions.source_id`
  // necesitan apuntar a algo que diga la verdad.
  const defsFuentes = [
    // Comunicarte
    { programa: "comunicarte", nombre: "Formulario actual", sheetId: SHEET_COMUNICARTE, tab: "New form", orden: 2, activo: true, mapeoColumnas: MAPEO_FORMULARIO },
    { programa: "comunicarte", nombre: "Formulario anterior", sheetId: SHEET_COMUNICARTE, tab: "Forms viejo", orden: 1, activo: false, mapeoColumnas: MAPEO_FORMULARIO },

    // Tactical Investor
    { programa: "tactical-investor", nombre: "Formulario", sheetId: SHEET_TACTICAL, tab: "De Cero a Tactical Investor", orden: 1, activo: true, mapeoColumnas: MAPEO_FORMULARIO },
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

  // ── Categorias de recurso ─────────────────────────────────────
  // Catalogo del ticket 022 (ADR 0017, ADR 0012). Solo la semilla inicial: el dia a
  // dia se administra desde /ajustes/catalogos. Idempotente: solo inserta lo que
  // falta, comparando sin distinguir mayusculas (el indice unico es sobre lower()).
  const defsCategoriasRecurso = ["Brochure", "Pagina web", "Guion", "Formulario", "Calendly", "Drive"];

  const categoriasExistentes = await db.select().from(categoriasRecurso);
  const nombresExistentes = new Set(categoriasExistentes.map((c) => c.nombre.toLowerCase()));
  for (const nombre of defsCategoriasRecurso) {
    if (nombresExistentes.has(nombre.toLowerCase())) {
      console.log(`  = categoria de recurso ${nombre} (ya existe, no se toca)`);
    } else {
      await db.insert(categoriasRecurso).values({ nombre });
      console.log(`  + categoria de recurso ${nombre}`);
    }
  }

  console.log("\nSiembra completa.\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error("Fallo:", e); process.exit(1); });
