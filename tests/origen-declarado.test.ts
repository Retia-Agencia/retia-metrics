import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { areas, canales, dealEtapaHistorial, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ventasSinUtmPorAreaDeclarada } from "@/lib/queries/origen-declarado";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;

beforeEach(async () => ({ db, cerrar } = await crearBaseDePrueba()));
afterEach(async () => cerrar());

describe("ventas sin UTM por área declarada", () => {
  it("cuenta solo ventas vigentes del programa cuyo envío no trae UTM", async () => {
    const [programa, otroPrograma] = await db.insert(programs).values([
      { slug: "uno", nombre: "Uno", ticketUsd: "1000" },
      { slug: "dos", nombre: "Dos", ticketUsd: "1500" },
    ]).returning();
    const [referidos, pauta] = await db.insert(areas).values([{ nombre: "Referidos" }, { nombre: "Pauta" }]).returning();
    await db.insert(canales).values({ nombre: "Meta", utmSource: "facebook", utmMedium: "cpc", areaId: pauta.id });
    const [fuente, fuenteAjena] = await db.insert(sources).values([
      { programId: programa.id, nombre: "Formulario" },
      { programId: otroPrograma.id, nombre: "Formulario ajeno" },
    ]).returning();
    const [actor] = await db.insert(users).values({ email: "gerente@retia.local", rol: "gerente" }).returning();

    let n = 0;
    async function lead(programId: string) {
      const [fila] = await db.insert(leads).values({ programId, emailNormalizado: `l${++n}@correo.co` }).returning();
      return fila;
    }

    const conUtm = await lead(programa.id);
    const sinOrigen = await lead(programa.id);
    const sinUtm = await lead(programa.id);
    const ajeno = await lead(otroPrograma.id);
    const noVenta = await lead(programa.id);
    const anulado = await lead(programa.id);
    const [envioConUtm] = await db.insert(submissions).values({
      leadId: conUtm.id,
      sourceId: fuente.id,
      token: "utm",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "venta",
    }).returning();
    const [envioSinUtm] = await db.insert(submissions).values({ leadId: sinUtm.id, sourceId: fuente.id, token: "sin-utm" }).returning();

    const creados = await db.insert(deals).values([
      { leadId: conUtm.id, programId: programa.id, etapa: "ganado_parcial", areaDeclaradaId: referidos.id, submissionOrigenId: envioConUtm.id },
      { leadId: sinOrigen.id, programId: programa.id, etapa: "ganado_parcial", areaDeclaradaId: referidos.id },
      { leadId: sinUtm.id, programId: programa.id, etapa: "ganado_completo", areaDeclaradaId: referidos.id, submissionOrigenId: envioSinUtm.id },
      { leadId: ajeno.id, programId: otroPrograma.id, etapa: "ganado_parcial", areaDeclaradaId: referidos.id },
      { leadId: noVenta.id, programId: programa.id, etapa: "compromiso_verbal", areaDeclaradaId: referidos.id },
      { leadId: anulado.id, programId: programa.id, etapa: "ganado_completo", areaDeclaradaId: referidos.id, anuladoEn: new Date(), anuladoPor: actor.id, motivoAnulacion: "duplicado" },
    ]).returning();

    // La venta es la primera entrada a Abonado o Completo del historial, igual que en el
    // dashboard: el deal de Compromiso Verbal no tiene esa entrada.
    const enElRango = new Date("2026-09-15T15:00:00Z");
    await db.insert(dealEtapaHistorial).values(
      creados
        .filter((d) => d.etapa === "ganado_parcial" || d.etapa === "ganado_completo")
        .map((d) => ({ dealId: d.id, de: "compromiso_verbal" as const, a: d.etapa, fecha: enElRango })),
    );
    // Vendido fuera del rango: no cuenta aunque sea sin UTM y tenga área.
    const tarde = await lead(programa.id);
    const [fuera] = await db.insert(deals).values(
      { leadId: tarde.id, programId: programa.id, etapa: "ganado_parcial", areaDeclaradaId: referidos.id },
    ).returning();
    await db.insert(dealEtapaHistorial).values({ dealId: fuera.id, de: "compromiso_verbal", a: "ganado_parcial", fecha: new Date("2026-10-15T15:00:00Z") });

    expect(await ventasSinUtmPorAreaDeclarada(db, programa.id, { desde: "2026-09-01", hasta: "2026-09-30" })).toEqual([
      { areaId: referidos.id, nombre: "Referidos", ventas: 2 },
    ]);
    expect(fuenteAjena.id).toBeTruthy();
  });
});
