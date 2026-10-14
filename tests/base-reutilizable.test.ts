import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leads, motivos, plataformasPago, programs, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, crearBaseReutilizable, type BaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

type ClienteConsultable = {
  query: <T>(consulta: string) => Promise<{ rows: T[] }>;
};

function clienteDe(db: Db): ClienteConsultable {
  return (db as Db & { $client: ClienteConsultable }).$client;
}

async function contenidoPublico(db: Db): Promise<Record<string, unknown>> {
  const cliente = clienteDe(db);
  const resultado = await cliente.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const contenido: Record<string, unknown> = {};
  for (const { tablename } of resultado.rows) {
    const tabla = `"${tablename.replaceAll('"', '""')}"`;
    const filas = await cliente.query<{ filas: unknown }>(
      `SELECT coalesce(json_agg(fila ORDER BY id), '[]'::json) AS filas FROM ${tabla} AS fila`,
    );
    contenido[tablename] = filas.rows[0]?.filas;
  }
  return contenido;
}

describe("crearBaseReutilizable", () => {
  let reutilizable: Awaited<ReturnType<typeof crearBaseReutilizable>>;
  let fresca: BaseDePrueba;

  beforeAll(async () => {
    reutilizable = await crearBaseReutilizable();
    fresca = await crearBaseDePrueba();
  });

  afterAll(async () => {
    await reutilizable.cerrar();
    await fresca.cerrar();
  });

  it("restaura todas las tablas y sus semillas de forma idempotente", async () => {
    const [programa] = await reutilizable.db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa", nombre: "Programa", ticketUsd: "1000" })
      .returning();
    await reutilizable.db.insert(sources).values({ programId: programa.id, nombre: "Typeform" });
    await reutilizable.db.insert(leads).values({ programId: programa.id, emailNormalizado: "ana@correo.co" });

    const [motivo] = await reutilizable.db.select({ id: motivos.id }).from(motivos).limit(1);
    await reutilizable.db.delete(motivos).where(eq(motivos.id, motivo.id));
    await reutilizable.db.insert(plataformasPago).values({ nombre: "Pasarela temporal" });

    const esperado = await contenidoPublico(fresca.db);
    expect(await contenidoPublico(reutilizable.db)).not.toEqual(esperado);

    await reutilizable.vaciar();
    const restaurado = await contenidoPublico(reutilizable.db);
    expect(restaurado).toEqual(esperado);
    expect(restaurado.motivos).toEqual(esperado.motivos);
    expect(restaurado.plataformas_pago).toEqual(esperado.plataformas_pago);

    await reutilizable.vaciar();
    expect(await contenidoPublico(reutilizable.db)).toEqual(esperado);
  });
});
