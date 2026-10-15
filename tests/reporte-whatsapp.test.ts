import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  guardarReporte,
  reporteDelPrograma,
  type EntradaReporteWhatsapp,
} from "@/lib/catalogo/reportes-whatsapp";
import {
  changeLog,
  cohorts,
  objetivos,
  programs,
  reportesWhatsapp,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let gerenteId: string;
let closerId: string;
let programId: string;
let cohortId: string;

const configuracion: EntradaReporteWhatsapp = {
  activo: true,
  horas: [8, 11, 14, 17],
  horaCierre: 20,
  metricas: ["costo_por_agenda"],
};

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "reporte-whatsapp",
    nombre: "Reporte WhatsApp",
    ticketUsd: "1000.00",
  }).returning();
  programId = programa.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId,
    codigo: "R-1",
    metaCupos: 20,
    precioUsd: "1000.00",
    fechaInicioClases: "2026-11-01",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-11-01",
    estado: "activo",
  }).returning();
  cohortId = cohorte.id;
  const [gerente] = await db.insert(users).values({
    email: "gerente-reporte@retia.test",
    rol: "gerente",
  }).returning();
  gerenteId = gerente.id;
  const [closer] = await db.insert(users).values({
    email: "closer-reporte@retia.test",
    rol: "closer",
    closerId: "closer reporte",
  }).returning();
  closerId = closer.id;
}, 60_000);

afterAll(async () => {
  await cerrar();
});

const gerente = () => ({ id: gerenteId, rol: "gerente" as const });

async function cargarUmbral() {
  await db.insert(objetivos).values({
    cohortId,
    area: null,
    metrica: "costo_por_agenda",
    meta: "50000.00",
    aceptable: "65000.00",
    moneda: "COP",
  });
}

describe("configuracion del reporte por WhatsApp", () => {
  it("crea y luego edita la misma fila con change_log", async () => {
    await cargarUmbral();
    const creada = await guardarReporte(db, gerente(), programId, configuracion);
    const editada = await guardarReporte(db, gerente(), programId, {
      ...configuracion,
      horas: [15, 9],
    });

    expect(editada.id).toBe(creada.id);
    expect(editada.horas).toEqual([9, 15]);
    expect(await db.select().from(reportesWhatsapp)).toHaveLength(1);
    const cambios = await db.select().from(changeLog).where(eq(changeLog.registroId, creada.id));
    expect(cambios.some((cambio) => cambio.campo === "programId")).toBe(true);
    expect(cambios.some((cambio) => cambio.campo === "horas" && cambio.valorAnterior !== null)).toBe(true);
  });

  it("rechaza costo por agenda sin umbral y no mueve la tabla", async () => {
    await expect(guardarReporte(db, gerente(), programId, configuracion)).rejects.toMatchObject({
      status: 422,
      message: "No hay umbral de Costo por agenda en la cohorte activa: cárgalo en Programa › Ventas.",
    });
    expect(await db.select().from(reportesWhatsapp)).toHaveLength(0);
  });

  it("guarda horas del día y cierre entre 0 y 23 sin necesitar destino", async () => {
    await cargarUmbral();
    await expect(guardarReporte(db, gerente(), programId, configuracion)).resolves.toMatchObject({
      programId,
      activo: true,
      horas: [8, 11, 14, 17],
      horaCierre: 20,
      metricas: ["costo_por_agenda"],
    });
  });

  it("rechaza a un closer y no mueve la tabla", async () => {
    await cargarUmbral();
    await expect(guardarReporte(
      db,
      { id: closerId, rol: "closer" },
      programId,
      configuracion,
    )).rejects.toMatchObject({
      status: 403,
      message: "Solo quien administra configura el reporte.",
    });
    expect(await reporteDelPrograma(db, programId)).toBeNull();
  });

  it.each([-1, 24])("rechaza la hora %s", async (hora) => {
    await cargarUmbral();
    await expect(guardarReporte(db, gerente(), programId, {
      ...configuracion,
      horas: [hora],
    })).rejects.toMatchObject({ status: 400 });
    expect(await db.select().from(reportesWhatsapp)).toHaveLength(0);
  });
});
