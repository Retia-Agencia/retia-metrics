import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { abonos, calls, programs, resultadoLlamadaEnum, sales } from "@/lib/db/schema";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 018 (ADR 0015): el resultado de llamada suma `cancelada` y
 * `compromiso_pago`. Afirmamos los 8 valores exactos de la tabla del ADR, en el
 * orden en que el codigo los declara, para que ampliar el enum no pueda divergir
 * en silencio de la decision.
 */
describe("enum resultado_llamada", () => {
  it("tiene exactamente los 8 valores de la tabla del ADR 0015", () => {
    expect(resultadoLlamadaEnum.enumValues).toEqual([
      "agendada",
      "show",
      "no_show",
      "cancelada",
      "reagendada",
      "compromiso_pago",
      "cerrada",
      "perdida",
    ]);
  });
});

describe("migracion 0008 sobre PGlite", () => {
  it("acepta una llamada con resultado compromiso_pago y fecha_seguimiento", async () => {
    const { db, cerrar } = await crearBaseDePrueba();
    try {
      const [prog] = await db
        .insert(programs)
        .values({ slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797" })
        .returning();

      const seguimiento = new Date("2026-09-25T00:00:00Z");
      const [llamada] = await db
        .insert(calls)
        .values({
          programId: prog.id,
          resultado: "compromiso_pago",
          fechaSeguimiento: seguimiento,
        })
        .returning();

      expect(llamada.resultado).toBe("compromiso_pago");
      expect(llamada.fechaSeguimiento).toEqual(seguimiento);
    } finally {
      await cerrar();
    }
  });

  it("no deja borrar una venta que ya tiene un abono (onDelete restrict)", async () => {
    const { db, cerrar } = await crearBaseDePrueba();
    try {
      const [prog] = await db
        .insert(programs)
        .values({ slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797" })
        .returning();
      const [venta] = await db
        .insert(sales)
        .values({ programId: prog.id })
        .returning();
      await db
        .insert(abonos)
        .values({ saleId: venta.id, programId: prog.id, fecha: "2026-09-15", monto: "750" });

      await expect(
        db.delete(sales).where(sql`${sales.id} = ${venta.id}`),
      ).rejects.toThrow();
    } finally {
      await cerrar();
    }
  });

  /**
   * El helper de base aplica la migracion sobre una base vacia, asi que no se puede
   * sembrar una venta ANTES de que corra el INSERT...SELECT de copia. Se prueba
   * honestamente de otra forma: se extrae el statement real del .sql de la migracion
   * y se corre sobre una venta sembrada despues. Asi el test valida el SQL que de
   * verdad viaja en la migracion, no una copia re-tecleada.
   */
  it("el INSERT...SELECT de la migracion convierte cada montoAbonado en un abono, y es idempotente", async () => {
    const { db, cerrar } = await crearBaseDePrueba();
    try {
      const sqlMigracion = fs.readFileSync(
        fileURLToPath(new URL("../drizzle/0008_registro_y_abonos.sql", import.meta.url)),
        "utf8",
      );
      const statementCopia = sqlMigracion
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .find((s) => s.includes('INSERT INTO "abonos"') && s.includes("monto_abonado"));
      expect(statementCopia, "el statement de copia debe existir en la migracion").toBeTruthy();

      const [prog] = await db
        .insert(programs)
        .values({ slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797" })
        .returning();
      const [venta] = await db
        .insert(sales)
        .values({ programId: prog.id, fecha: "2026-09-15", montoAbonado: "750", moneda: "USD" })
        .returning();

      // Corre el statement real de la migracion. Idempotencia: dos veces.
      await db.execute(sql.raw(statementCopia!));
      await db.execute(sql.raw(statementCopia!));

      const filas = await db.select().from(abonos);
      expect(filas).toHaveLength(1);
      expect(filas[0].saleId).toBe(venta.id);
      expect(filas[0].programId).toBe(prog.id);
      expect(filas[0].monto).toBe("750.00");
      expect(filas[0].moneda).toBe("USD");
      expect(filas[0].origen).toBe("sheets");
      expect(filas[0].fecha).toBe("2026-09-15");
    } finally {
      await cerrar();
    }
  });
});
