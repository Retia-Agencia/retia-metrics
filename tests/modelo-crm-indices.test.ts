import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deals, leadContactos, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionCheck, esViolacionUnica } from "@/lib/db/errores";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 037 — las dos garantias del modelo nuevo que viven en la BASE y no en el
 * codigo (ADR 0005), mordidas en los dos sentidos: lo prohibido choca y lo
 * permitido convive.
 *
 * Son indices y no validaciones de zod por la razon de siempre: una garantia que
 * vive solo en el codigo se rompe el dia que alguien escribe por otro camino (un
 * script, el CLI de emergencia, una migracion). Y las dos protegen cifras, no
 * comodidad — dos deals abiertos del mismo lead cuentan la misma oportunidad dos
 * veces en el embudo, sin lanzar un solo error.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
let leadA: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" })
    .returning();
  const [b] = await db
    .insert(programs)
    .values({ slug: "programa-b", nombre: "Programa B", ticketUsd: "1000" })
    .returning();
  programaA = a.id;
  programaB = b.id;

  const [l] = await db
    .insert(leads)
    .values({ programId: programaA, emailNormalizado: "ana@correo.co" })
    .returning();
  leadA = l.id;
});

afterEach(async () => {
  await cerrar();
});

describe("un deal ABIERTO por lead y programa (ADR 0037)", () => {
  it("dos deals abiertos del mismo lead y programa chocan", async () => {
    await db.insert(deals).values({ leadId: leadA, programId: programaA });

    await expect(
      db.insert(deals).values({ leadId: leadA, programId: programaA }),
    ).rejects.toSatisfy(esViolacionUnica);
  });

  it("un deal abierto y uno en Cierre Perdido conviven: reaplicar abre un deal NUEVO", async () => {
    await db
      .insert(deals)
      .values({ leadId: leadA, programId: programaA, etapa: "cierre_perdido" });
    await db.insert(deals).values({ leadId: leadA, programId: programaA });

    const filas = await db.select().from(deals);
    expect(filas).toHaveLength(2);
  });

  it("tambien convive con uno en Completo: una segunda venta es otro deal", async () => {
    await db.insert(deals).values({ leadId: leadA, programId: programaA, etapa: "completo" });
    await db.insert(deals).values({ leadId: leadA, programId: programaA });

    expect(await db.select().from(deals)).toHaveLength(2);
  });

  it("dos CERRADOS del mismo lead conviven entre si", async () => {
    // El historial de intentos es el punto: tres cierres perdidos son tres noes.
    await db.insert(deals).values([
      { leadId: leadA, programId: programaA, etapa: "cierre_perdido" },
      { leadId: leadA, programId: programaA, etapa: "cierre_perdido" },
      { leadId: leadA, programId: programaA, etapa: "completo" },
    ]);

    expect(await db.select().from(deals)).toHaveLength(3);
  });

  it("`proxima_cohorte` SI ocupa el cupo: es un deal abierto, no un cierre", async () => {
    await db
      .insert(deals)
      .values({ leadId: leadA, programId: programaA, etapa: "proxima_cohorte" });

    await expect(
      db.insert(deals).values({ leadId: leadA, programId: programaA }),
    ).rejects.toSatisfy(esViolacionUnica);
  });

  it("🩸 un deal ANULADO libera el cupo: se puede crear el correcto", async () => {
    // El caso que hace falta de verdad: un closer registra el deal sobre el lead
    // equivocado, lo anula, y crea el bueno. Sin `AND anulado_en IS NULL` en el
    // indice, la base le rechaza el segundo por un registro que la app ya declaro
    // INEXISTENTE (ADR 0038) — y el mensaje diria que ya tiene un deal abierto,
    // que es justo lo que el closer acaba de deshacer.
    const [quienAnula] = await db
      .insert(users)
      .values({ email: "gerente@retiagrowth.com", rol: "gerente" })
      .returning();
    await db.insert(deals).values({
      leadId: leadA,
      programId: programaA,
      anuladoEn: new Date(),
      anuladoPor: quienAnula.id,
      motivoAnulacion: "lead equivocado",
    });

    await db.insert(deals).values({ leadId: leadA, programId: programaA });

    expect(await db.select().from(deals)).toHaveLength(2);
  });

  it("sin motivo no hay anulacion: los tres campos van juntos o no va ninguno", async () => {
    // ADR 0026 punto 6, y la garantia vive en la base (ADR 0005). Una fila anulada
    // sin quien ni por que es justo el estado que el ADR descarta.
    await expect(
      db.insert(deals).values({ leadId: leadA, programId: programaA, anuladoEn: new Date() }),
    ).rejects.toSatisfy(esViolacionCheck);
  });

  it("el mismo lead en OTRO programa no choca", async () => {
    const [enB] = await db
      .insert(leads)
      .values({ programId: programaB, emailNormalizado: "ana@correo.co" })
      .returning();

    await db.insert(deals).values({ leadId: leadA, programId: programaA });
    await db.insert(deals).values({ leadId: enB.id, programId: programaB });

    expect(await db.select().from(deals)).toHaveLength(2);
  });
});

describe("un contacto por (programa, tipo, valor) (ADR 0035)", () => {
  it("el mismo telefono dos veces en el mismo programa choca", async () => {
    await db
      .insert(leadContactos)
      .values({ leadId: leadA, programId: programaA, tipo: "telefono", valor: "3001112222" });

    const [otro] = await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "beto@correo.co" })
      .returning();

    await expect(
      db
        .insert(leadContactos)
        .values({ leadId: otro.id, programId: programaA, tipo: "telefono", valor: "3001112222" }),
    ).rejects.toSatisfy(esViolacionUnica);
  });

  it("el mismo valor como correo y como telefono no choca: el tipo es parte de la llave", async () => {
    await db.insert(leadContactos).values([
      { leadId: leadA, programId: programaA, tipo: "correo", valor: "3001112222" },
      { leadId: leadA, programId: programaA, tipo: "telefono", valor: "3001112222" },
    ]);

    expect(await db.select().from(leadContactos)).toHaveLength(2);
  });

  it("el mismo telefono en OTRO programa no choca: dos programas son dos leads", async () => {
    // ADR 0035 punto 2: la misma persona en dos programas NO se deduplica entre si.
    // Un unico global sobre el telefono haria imposible que existiera en los dos.
    const [enB] = await db
      .insert(leads)
      .values({ programId: programaB, emailNormalizado: "ana@correo.co" })
      .returning();

    await db.insert(leadContactos).values([
      { leadId: leadA, programId: programaA, tipo: "telefono", valor: "3001112222" },
      { leadId: enB.id, programId: programaB, tipo: "telefono", valor: "3001112222" },
    ]);

    expect(await db.select().from(leadContactos)).toHaveLength(2);
  });
});
