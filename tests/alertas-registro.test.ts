import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { alertasActivas } from "@/lib/alertas/registro";
import { programs, sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const AHORA = new Date("2026-11-13T10:00:00-05:00");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

describe("registro de alertas tecnicas", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let sourceId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "alertas",
      nombre: "Programa Alertas",
      ticketUsd: "1000",
    }).returning();
    programId = programa.id;
    const [fuente] = await db.insert(sources).values({
      programId,
      nombre: "Formulario principal",
      tipo: "webhook",
      proveedor: "typeform",
      activo: true,
    }).returning();
    sourceId = fuente.id;
  });

  afterAll(async () => cerrar());

  it("publica un sobre pendiente y lo retira cuando se limpia el error, sin filtrar datos personales", async () => {
    await db.insert(submissions).values({
      sourceId,
      token: "reciente",
      createdAt: hace(1),
      leadQuality: "High",
    });
    const [sobre] = await db.insert(sobresCrudos).values({
      sourceId,
      programId,
      cuerpo: JSON.stringify({ nombre: "Nombre Privado", email: "privado@example.com" }),
      error: "fallo simulado",
    }).returning();

    const alertas = await alertasActivas(db, AHORA);

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      clave: `sobres_con_error:${sourceId}`,
      tipo: "sobres_con_error",
      severidad: "critica",
    });
    expect(JSON.stringify(alertas)).not.toContain("Nombre Privado");
    expect(JSON.stringify(alertas)).not.toContain("privado@example.com");

    await db.update(sobresCrudos).set({ error: null }).where(eq(sobresCrudos.id, sobre.id));
    expect(await alertasActivas(db, AHORA)).toEqual([]);
  });

  it("publica una fuente silenciosa despues de superar su umbral", async () => {
    await db.insert(submissions).values({
      sourceId,
      token: "silenciosa",
      createdAt: hace(49),
      leadQuality: "High",
    });

    const alertas = await alertasActivas(db, AHORA);

    expect(alertas).toHaveLength(2);
    const alerta = alertas.find((item) => item.tipo === "fuente_silenciosa");
    expect(alerta).toMatchObject({
      clave: `fuente_silenciosa:${sourceId}`,
      tipo: "fuente_silenciosa",
      severidad: "critica",
    });
    expect(alerta?.texto).toContain("49 horas sin envíos");
  });

  it("publica el silencio global cuando toda fuente activa lleva mas de tres horas sin envios", async () => {
    await db.insert(submissions).values({
      sourceId,
      token: "global-silenciosa",
      createdAt: hace(4),
      leadQuality: "High",
    });

    expect(await alertasActivas(db, AHORA)).toContainEqual(expect.objectContaining({
      clave: "sin_envios_global:todas",
      tipo: "sin_envios_global",
      severidad: "critica",
    }));
  });

  it("no publica el silencio global cuando hay un envio reciente", async () => {
    await db.insert(submissions).values({
      sourceId,
      token: "global-reciente",
      createdAt: hace(2),
      leadQuality: "High",
    });

    expect((await alertasActivas(db, AHORA)).some((alerta) => alerta.tipo === "sin_envios_global")).toBe(false);
  });

  it("no publica el silencio global cuando no hay fuentes activas", async () => {
    await db.update(sources).set({ activo: false }).where(eq(sources.id, sourceId));

    expect((await alertasActivas(db, AHORA)).some((alerta) => alerta.tipo === "sin_envios_global")).toBe(false);
  });
});
