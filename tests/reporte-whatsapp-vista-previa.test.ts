import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { programs, reportesWhatsapp } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vistaPreviaDelReporte } from "@/lib/reporte-whatsapp/vista-previa";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const AHORA = new Date("2026-10-13T11:00:00-05:00");
const ORIGEN = "https://crm.retia.test";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  await db.execute(sql`
    alter table reportes_whatsapp
    drop constraint if exists reportes_whatsapp_activo_completo_chk
  `);
});

beforeEach(async () => {
  await vaciar();
});

afterAll(async () => cerrar());

async function crearPrograma(
  slug: string,
  opciones: { reporte?: boolean; horaCierre?: number | null } = {},
) {
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug,
    nombre: `Programa ${slug}`,
    ticketUsd: "1000",
  }).returning();
  if (opciones.reporte !== false) {
    await db.insert(reportesWhatsapp).values({
      programId: programa.id,
      activo: true,
      horas: [11],
      horaCierre: opciones.horaCierre ?? null,
      metricas: ["costo_por_agenda"],
    });
  }
  return programa;
}

async function vista(programa: Awaited<ReturnType<typeof crearPrograma>>) {
  return vistaPreviaDelReporte(db, {
    programId: programa.id,
    programa: programa.nombre,
    slug: programa.slug,
    origen: ORIGEN,
    ahora: AHORA,
  });
}

describe("vista previa del reporte por WhatsApp", () => {
  it("avisa cuando el programa no tiene reporte", async () => {
    const programa = await crearPrograma("sin-reporte", { reporte: false });

    await expect(vista(programa)).resolves.toEqual({
      dia: null,
      cierre: null,
      aviso: "Todavía no hay reporte configurado.",
    });
  });

  it("arma el reporte del dia con el enlace al CRM", async () => {
    const programa = await crearPrograma("uno");

    const resultado = await vista(programa);

    expect(resultado.aviso).toBeNull();
    expect(resultado.dia).toMatch(/^🚦 Semáforo de pauta ·/);
    expect(resultado.dia).toContain("CRM: https://crm.retia.test");
    expect(resultado.dia).toMatch(/revisar el pixel o los UTM\.$/);
    expect(resultado.cierre).toBeNull();
  });

  it("arma tambien el cierre cuando tiene hora configurada", async () => {
    const programa = await crearPrograma("con-cierre", { horaCierre: 18 });

    const resultado = await vista(programa);

    expect(resultado.aviso).toBeNull();
    expect(resultado.cierre).toMatch(/^🌙 Cierre del lunes 12-oct/);
  });
});
