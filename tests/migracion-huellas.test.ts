import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abonos, deals, leads, programs, rarezasMigracion } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionCheck, esViolacionUnica } from "@/lib/db/errores";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * ADR 0059 punto 2 y ticket 080 — la migracion de las pestañas de gestion no duplica
 * porque LA BASE lo rechaza, no porque un `select` previo lo mire (ADR 0005). Mordido en
 * los dos sentidos: la misma huella choca, y lo nativo (huella nula) sigue conviviendo.
 *
 * 🩸 El caso que importa es el deal en Completo: no ocupa el cupo del lead, asi que sin la
 * huella una segunda corrida lo duplicaria sin un solo error.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programa: string;
let lead: string;

const HUELLA = "sheets:programa-a:Estudiantes Julio:ana@correo.co";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" })
    .returning();
  programa = p.id;
  const [l] = await db
    .insert(leads)
    .values({ programId: programa, emailNormalizado: "ana@correo.co" })
    .returning();
  lead = l.id;
});

afterEach(async () => {
  await cerrar();
});

describe("huella de migracion en deals (ADR 0059)", () => {
  it("dos deals en Completo con la MISMA huella chocan: la segunda corrida no duplica", async () => {
    await db
      .insert(deals)
      .values({ leadId: lead, programId: programa, etapa: "ganado_completo", huellaMigracion: HUELLA });

    await expect(
      db
        .insert(deals)
        .values({ leadId: lead, programId: programa, etapa: "ganado_completo", huellaMigracion: HUELLA }),
    ).rejects.toSatisfy(esViolacionUnica);
  });

  it("huellas distintas conviven: son dos ventas de la hoja", async () => {
    await db.insert(deals).values([
      { leadId: lead, programId: programa, etapa: "ganado_completo", huellaMigracion: HUELLA },
      { leadId: lead, programId: programa, etapa: "ganado_completo", huellaMigracion: `${HUELLA}:2` },
    ]);

    expect(await db.select().from(deals)).toHaveLength(2);
  });

  it("los deals nativos (huella nula) no compiten entre si", async () => {
    await db.insert(deals).values([
      { leadId: lead, programId: programa, etapa: "ganado_completo" },
      { leadId: lead, programId: programa, etapa: "ganado_completo" },
    ]);

    expect(await db.select().from(deals)).toHaveLength(2);
  });
});

describe("huella de migracion en abonos (ADR 0059)", () => {
  let deal: string;

  beforeEach(async () => {
    const [d] = await db
      .insert(deals)
      .values({ leadId: lead, programId: programa, etapa: "ganado_completo" })
      .returning();
    deal = d.id;
  });

  const abono = (huellaMigracion?: string) => ({
    dealId: deal,
    programId: programa,
    fecha: "2026-08-18",
    monto: "500",
    origen: "sheets",
    huellaMigracion,
  });

  it("dos abonos con la MISMA huella chocan", async () => {
    await db.insert(abonos).values(abono(HUELLA));

    await expect(db.insert(abonos).values(abono(HUELLA))).rejects.toSatisfy(esViolacionUnica);
  });

  it("los abonos nativos (huella nula) conviven", async () => {
    await db.insert(abonos).values([abono(), abono()]);

    expect(await db.select().from(abonos)).toHaveLength(2);
  });
});

describe("rarezas de la migracion (ticket 080)", () => {
  const rareza = (tipo: string, detalle = "Fecha de venta tomada del cierre de la C1") => ({
    programId: programa,
    huella: HUELLA,
    tipo,
    detalle,
  });

  it("la misma rareza de la misma fila no se duplica al correr dos veces", async () => {
    await db.insert(rarezasMigracion).values(rareza("fecha_aproximada"));

    await expect(
      db.insert(rarezasMigracion).values(rareza("fecha_aproximada")),
    ).rejects.toSatisfy(esViolacionUnica);
  });

  it("una fila puede tener varias rarezas de tipos distintos", async () => {
    await db
      .insert(rarezasMigracion)
      .values([rareza("fecha_aproximada"), rareza("plataforma_fuera_de_catalogo", "Plataforma: Bootcamp")]);

    expect(await db.select().from(rarezasMigracion)).toHaveLength(2);
  });

  it("una rareza sin detalle se rechaza: tiene que decir que tiene de raro", async () => {
    await expect(
      db.insert(rarezasMigracion).values(rareza("fecha_aproximada", "   ")),
    ).rejects.toSatisfy(esViolacionCheck);
  });
});
