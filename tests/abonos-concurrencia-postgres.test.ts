import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { registrarAbono, type AbonoRegistrado } from "@/lib/deals/abonos";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";
import { validarUrlLocal } from "../scripts/db-local-url";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { abonoDePrueba } from "./helpers/catalogo-de-prueba";
import type { Db } from "@/lib/db/tipos";

const url = process.env.DATABASE_URL_PRUEBA_POSTGRES;
// PGlite serializa las transacciones y no prueba la exclusion entre conexiones.
// Sin un Postgres local explicito se omite; el servicio del CI lo ejecuta siempre.
const conPostgres = url ? describe : describe.skip;

conPostgres("registrarAbono: concurrencia contra Postgres real", () => {
  it("dos conexiones abonan 600 sobre un saldo de 600: solo una entra y la otra se rechaza", async () => {
    validarUrlLocal(url!);
    const nombreBase = `prueba_abonos_${randomUUID().replaceAll("-", "")}`;
    const urlDePrueba = new URL(url!);
    urlDePrueba.pathname = `/${nombreBase}`;
    validarUrlLocal(urlDePrueba.toString());
    const admin = new Pool({ connectionString: url!, max: 1 });
    const clientes: Pool[] = [];
    let creada = false;

    try {
      // Las migraciones nombran public: una base desechable las aplica sin reescribirlas
      // ni tocar las tablas de la base indicada en la URL. El usuario local necesita CREATEDB.
      await admin.query(`create database "${nombreBase}"`);
      creada = true;
      const conectar = (nombre: string) => {
        const cliente = new Pool({
          connectionString: urlDePrueba.toString(),
          max: 1,
          application_name: nombre,
          statement_timeout: 15_000,
        });
        clientes.push(cliente);
        return cliente;
      };
      const control = conectar("prueba_abonos_control");
      const cliente1 = conectar("prueba_abonos_1");
      const cliente2 = conectar("prueba_abonos_2");
      const db = drizzle(control, { schema });
      const db1 = drizzle(cliente1, { schema });
      const db2 = drizzle(cliente2, { schema });
      await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });

      const [programa] = await db.insert(schema.programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "prueba", nombre: "Prueba" }).returning();
      const [closer] = await db.insert(schema.users).values({ email: "closer@prueba.local", rol: "closer", closerId: "Prueba" }).returning();
      const [lead] = await db.insert(schema.leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programa.id, emailNormalizado: "lead@prueba.local" }).returning();
      const [deal] = await db.insert(schema.deals).values({ programId: programa.id, leadId: lead.id, ownerUserId: closer.id, etapa: "ganado_parcial", valorVendidoUsd: "1000" }).returning();
      const [plataforma] = await db.insert(schema.plataformasPago).values({ nombre: "Plataforma concurrencia" }).returning();
      // El abono previo cuelga de la linea con cupo del deal (ADR 0137): el helper la crea.
      await abonoDePrueba(db as unknown as Db, { programId: programa.id, dealId: deal.id, monto: "400", moneda: "USD", fecha: "2026-09-28", comprobanteUrl: "https://prueba.local/400" });

      const actor = { userId: closer.id, rol: "closer", operaComoCloser: false } as const;
      const datos = { dealId: deal.id, monto: "600", fecha: "2026-09-28", plataformaId: plataforma.id, comprobanteUrl: "https://prueba.local/600" };
      const bloqueo = await control.connect();
      let pagos: Promise<PromiseSettledResult<AbonoRegistrado>[]> | undefined;
      let resultados: PromiseSettledResult<AbonoRegistrado>[] = [];
      try {
        await bloqueo.query("begin");
        await bloqueo.query("select id from deals where id = $1 for update", [deal.id]);
        pagos = Promise.allSettled([
          registrarAbono(db1, actor, datos),
          registrarAbono(db2, actor, datos),
        ]);

        // Ambos deben esperar EN la lectura bloqueante. Si se quita el for update del
        // registro, esperan al escribir y este control falla: no basta con terminar sin deuda.
        const limite = Date.now() + 5_000;
        let esperando = 0;
        do {
          const { rows: [fila] } = await admin.query<{ cantidad: number }>(`
            select count(*)::int as cantidad from pg_stat_activity
            where datname = $1
              and application_name in ('prueba_abonos_1', 'prueba_abonos_2')
              and wait_event_type = 'Lock' and lower(query) like '%for update%'
          `, [nombreBase]);
          esperando = fila.cantidad;
          if (esperando === 2) break;
          await new Promise((resolver) => setTimeout(resolver, 25));
        } while (Date.now() < limite);
        expect(esperando, "las dos conexiones esperan el bloqueo del deal antes de leer el saldo").toBe(2);
      } finally {
        try {
          await bloqueo.query("rollback");
        } finally {
          bloqueo.release();
          if (pagos) resultados = await pagos;
        }
      }

      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rechazados = resultados.filter((r) => r.status === "rejected");
      expect(rechazados).toHaveLength(1);
      // El perdedor entra con el deal ya en Completo: lo frena la reja del deal cerrado.
      expect(rechazados[0].reason).toMatchObject({ status: 409 });
      expect(rechazados[0].reason.message).toContain("El deal está cerrado");
      const saldo = (await saldosDeDeals(db, [deal.id])).get(deal.id)!;
      expect(saldo).toMatchObject({ abonado: 1000, saldo: 0, abonosVigentes: 2 });
      expect(saldo.saldo).toBeGreaterThanOrEqual(0);
      const [final] = await db.select().from(schema.deals).where(and(eq(schema.deals.id, deal.id), vigente(schema.deals)));
      expect(final.etapa).toBe("ganado_completo");
    } finally {
      try {
        await Promise.all(clientes.map((cliente) => cliente.end()));
      } finally {
        try {
          if (creada) await admin.query(`drop database "${nombreBase}"`);
        } finally {
          await admin.end();
        }
      }
    }
  }, 60_000);
});
