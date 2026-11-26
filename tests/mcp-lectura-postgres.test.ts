import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "@/lib/db/schema";
import { conexionDeUnPoolDePrueba, cadenaDeLecturaValida, type ConexionDeLectura } from "@/lib/db/mcp-lectura";
import { consultarDatos, ejecutarAcotado } from "@/lib/queries/mcp-lectura/consultar";
import { validarUrlLocal } from "../scripts/db-local-url";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const url = process.env.DATABASE_URL_PRUEBA_POSTGRES;
// El escape por `SET ROLE` solo existe con un usuario de sesión real: PGlite corre como superusuario y no lo prueba.
// Sin un Postgres local explícito se omite; el servicio del CI lo ejecuta siempre.
const conPostgres = url ? describe : describe.skip;

conPostgres("mcp_lectura contra Postgres real: el agente no escapa de su rol ni de su alcance", () => {
  const nombreBase = `prueba_lectura_${randomUUID().replaceAll("-", "")}`;
  const clave = `prueba-${randomUUID()}`;
  let admin: Pool;
  let pooladmin: Pool;
  let poolLectura: Pool;
  let conexion: ConexionDeLectura;
  let programaA: string;
  let programaB: string;
  let creada = false;

  beforeAll(async () => {
    validarUrlLocal(url!);
    const urlBase = new URL(url!);
    urlBase.pathname = `/${nombreBase}`;
    validarUrlLocal(urlBase.toString());
    admin = new Pool({ connectionString: url!, max: 1 });
    await admin.query(`create database "${nombreBase}"`);
    creada = true;
    pooladmin = new Pool({ connectionString: urlBase.toString(), max: 2 });
    const dbAdmin = drizzle(pooladmin, { schema });
    await migrate(dbAdmin, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    // Lo que hace la sesión padre fuera de la migración: dar LOGIN y contraseña al rol (aquí, una de prueba).
    await admin.query(`alter role mcp_lectura_login login password '${clave}'`);
    const [a, b] = await dbAdmin.insert(schema.programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "pg-a", nombre: "PG A" },
      { ...PROGRAMA_DE_PRUEBA, slug: "pg-b", nombre: "PG B" },
    ]).returning();
    programaA = a.id;
    programaB = b.id;
    const [closer] = await dbAdmin.insert(schema.users).values({ email: "closer@pg.test", nombre: "Closer", rol: "closer", closerId: "Closer" }).returning();
    for (const programa of [a, b]) {
      const [lead] = await dbAdmin.insert(schema.leads).values({ programId: programa.id, emailNormalizado: `${programa.slug}@pg.test`, nombre: programa.slug, fechaPrimeraAplicacion: new Date("2026-11-05T10:00:00-05:00") }).returning();
      await dbAdmin.insert(schema.deals).values({ programId: programa.id, leadId: lead.id, ownerUserId: closer.id, etapa: "agendado" });
    }
    const urlLectura = new URL(urlBase.toString());
    urlLectura.username = "mcp_lectura_login";
    urlLectura.password = clave;
    expect(cadenaDeLecturaValida(urlLectura.toString())).toBe(true);
    poolLectura = new Pool({ connectionString: urlLectura.toString(), max: 2, statement_timeout: 5_000, query_timeout: 7_000 });
    conexion = conexionDeUnPoolDePrueba(poolLectura);
  }, 120_000);

  afterAll(async () => {
    try {
      await poolLectura?.end();
      await pooladmin?.end();
      if (creada) await admin.query(`drop database "${nombreBase}"`);
    } finally {
      // El rol es del clúster: queda como lo deja la migración, sin LOGIN ni contraseña.
      await admin?.query("alter role mcp_lectura_login nologin password null").catch(() => undefined);
      await admin?.end();
    }
  });

  const acotado = (texto: string, programaIds: string[] = [programaA], limite = 10) =>
    ejecutarAcotado(conexion, { sql: texto, programaIds, veEquipo: true, limite });

  it("lee las vistas de su alcance y nada más", async () => {
    const r = await consultarDatos(conexion, { sql: "select programa, count(*) as n from mcp_lectura.deals group by programa", programaIds: [programaA], veEquipo: true });
    expect(r.filas).toEqual([{ programa: "pg-a", n: 1 }]);
    const ambos = await consultarDatos(conexion, { sql: "select programa from mcp_lectura.deals order by programa", programaIds: [programaA, programaB], veEquipo: false });
    expect(ambos.filas.map((f) => f.programa)).toEqual(["pg-a", "pg-b"]);
  });

  it("el usuario de la sesión ES el rol de lectura: no hay a dónde subir", async () => {
    const r = await acotado("select current_user, session_user");
    expect(r.filas).toEqual([["mcp_lectura_login", "mcp_lectura_login"]]);
  });

  it("set_config('role', ...) y query_to_xml no recuperan el rol de la app", async () => {
    const intento = acotado("select query_to_xml('select * from public.deals', true, false, '') from (select set_config('role', 'postgres', true)) s");
    await expect(intento).rejects.toMatchObject({ code: "42501" });
    await expect(acotado("select set_config('session_authorization', 'postgres', true)")).rejects.toMatchObject({ code: "42501" });
  });

  it("SET ROLE y RESET ROLE no suben de privilegio ni con el control completo de la transacción", async () => {
    const dentro = async (sentencia: string) => conexion.transaccion(async (consultar) => {
      await consultar("select mcp_lectura.fijar_alcance($1::uuid[], $2::boolean)", [[programaA], true]);
      await consultar(sentencia);
      return consultar("select current_user");
    });
    await expect(dentro("set role postgres")).rejects.toMatchObject({ code: "42501" });
    await expect(dentro("set session authorization postgres")).rejects.toMatchObject({ code: "42501" });
    const reset = await dentro("reset role");
    expect(reset.filas).toEqual([["mcp_lectura_login"]]);
  });

  it("fijar_alcance no se puede llamar otra vez, ni antes de bajar a solo lectura ni después", async () => {
    await expect(acotado(`select mcp_lectura.fijar_alcance(array['${programaB}']::uuid[], true)`)).rejects.toMatchObject({ code: "42501" });
    await expect(conexion.transaccion(async (consultar) => {
      await consultar("select mcp_lectura.fijar_alcance($1::uuid[], $2::boolean)", [[programaA], true]);
      await consultar("select mcp_lectura.fijar_alcance($1::uuid[], $2::boolean)", [[programaB], true]);
    })).rejects.toMatchObject({ code: "42501" });
    // Sin alcance fijado, las vistas no devuelven nada (el agente no puede llegar a las vistas sin pasar por fijar_alcance).
    const vacio = await conexion.transaccion((consultar) => consultar("select count(*)::int from mcp_lectura.deals"));
    expect(vacio.filas).toEqual([[0]]);
  });

  it("no toca las tablas de la app ni la del alcance", async () => {
    await expect(acotado("select * from public.deals")).rejects.toMatchObject({ code: "42501" });
    await expect(acotado("select * from public.users")).rejects.toMatchObject({ code: "42501" });
    await expect(acotado("select * from mcp_lectura.alcance")).rejects.toMatchObject({ code: "42501" });
    await expect(acotado("select * from pg_catalog.pg_authid")).rejects.toMatchObject({ code: "42501" });
    await expect(acotado("select pg_read_file('/etc/passwd')")).rejects.toMatchObject({ code: "42501" });
  });

  it("no escribe: INSERT, UPDATE, DDL y el cambio a lectura-escritura fallan", async () => {
    await expect(acotado("with x as (update public.deals set etapa = 'registrado' returning 1) select * from x")).rejects.toBeTruthy();
    await expect(acotado("with x as (insert into mcp_lectura.alcance values (1, gen_random_uuid(), true) returning 1) select * from x")).rejects.toBeTruthy();
    await expect(acotado("select set_config('transaction_read_only', 'off', true)")).rejects.toMatchObject({ code: expect.stringMatching(/^2500[16]$/) });
    await expect(conexion.transaccion(async (consultar) => {
      await consultar("select mcp_lectura.fijar_alcance($1::uuid[], $2::boolean)", [[programaA], true]);
      await consultar("set local transaction_read_only = on");
      await consultar("create table z (a int)");
    })).rejects.toMatchObject({ code: expect.stringMatching(/^(25006|42501)$/) });
  });

  it("el tope de tiempo corta una consulta lenta", async () => {
    const inicio = Date.now();
    await expect(acotado("select pg_sleep(30)")).rejects.toMatchObject({ code: "57014" });
    expect(Date.now() - inicio).toBeLessThan(10_000);
  }, 20_000);

  it("el tope de filas trae una de más, y un comentario final no lo rompe", async () => {
    const r = await acotado("select generate_series(1, 5000) -- fin", [programaA], 10);
    expect(r.filas).toHaveLength(11);
  });

  it("el alcance no sobrevive a la transacción ni se mezcla entre dos concurrentes", async () => {
    const [ra, rb] = await Promise.all([
      consultarDatos(conexion, { sql: "select programa, pg_sleep(0.3) is not null as ok from mcp_lectura.deals", programaIds: [programaA], veEquipo: true }),
      consultarDatos(conexion, { sql: "select programa, pg_sleep(0.3) is not null as ok from mcp_lectura.deals", programaIds: [programaB], veEquipo: true }),
    ]);
    expect(ra.filas.map((f) => f.programa)).toEqual(["pg-a"]);
    expect(rb.filas.map((f) => f.programa)).toEqual(["pg-b"]);
    const restos = await pooladmin.query("select count(*)::int as n from mcp_lectura.alcance");
    expect(restos.rows[0].n).toBe(0);
  });
});
