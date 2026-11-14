import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { abonos, calls, cohorts, dealEtapaHistorial, deals, gastoPauta, leads, miembrosPrograma, programs, sources, submissions, users, usuariosProgramasAlcance } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { capacidadesMcp } from "@/lib/mcp/herramientas/capacidades";
import { consultarHechosMcp } from "@/lib/mcp/herramientas/hechos";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { fichaDeLeadMcp } from "@/lib/mcp/herramientas/operacion";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let gerenteId: string;
let paidId: string;
let closerId: string;
let leadId: string;
let slug: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  slug = "hechos-a";
  const [programa, ajeno] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug, nombre: "Hechos A", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "hechos-b", nombre: "Hechos B", ticketUsd: "1500" },
  ]).returning();
  const [gerente, paid, closer] = await db.insert(users).values([
    { email: "gerente-hechos@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "paid-hechos@retia.test", nombre: "Paid", rol: "paid_trafficker" },
    { email: "closer-hechos@retia.test", nombre: "Nicolás", rol: "closer", closerId: "Nicolás" },
  ]).returning();
  gerenteId = gerente.id;
  paidId = paid.id;
  closerId = closer.id;
  await db.insert(miembrosPrograma).values({ userId: closerId, programId: programa.id });
  await db.insert(usuariosProgramasAlcance).values({ userId: paidId, programId: programa.id });
  const [cohorte] = await db.insert(cohorts).values({ programId: programa.id, codigo: "H-1", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01", estado: "activo" }).returning();
  const [fuente] = await db.insert(sources).values({ programId: programa.id, nombre: "Formulario" }).returning();
  const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: "hecho@retia.test", nombre: "Hecho", fechaPrimeraAplicacion: new Date("2026-11-01T12:00:00-05:00") }).returning();
  leadId = lead.id;
  const [envio] = await db.insert(submissions).values({ leadId, sourceId: fuente.id, token: "hecho", fechaEnvio: new Date("2026-11-05T10:00:00-05:00"), utmSource: "instagram", utmMedium: "paid_social" }).returning();
  const [deal] = await db.insert(deals).values({ programId: programa.id, leadId, submissionOrigenId: envio.id, cohortId: cohorte.id, ownerUserId: closer.id, etapa: "ganado_parcial", valorVendidoUsd: "797" }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, de: "agendado", a: "ganado_parcial", userId: closer.id, fecha: new Date("2026-11-06T12:00:00-05:00") });
  await db.insert(calls).values({ programId: programa.id, dealId: deal.id, closerUserId: closer.id, resultado: "show", fechaAgenda: new Date("2026-11-06T09:00:00-05:00"), fechaLlamada: new Date("2026-11-06T09:00:00-05:00"), origen: "app" });
  await db.insert(abonos).values([
    { programId: programa.id, dealId: deal.id, fecha: "2026-11-07", monto: "100", moneda: "USD", registradoPorUserId: closer.id },
    { programId: programa.id, dealId: deal.id, fecha: "2026-11-07", monto: "200000", moneda: "COP", registradoPorUserId: closer.id },
    { programId: programa.id, dealId: deal.id, fecha: "2026-11-07", monto: "50", moneda: "USD", registradoPorUserId: closer.id, anuladoEn: new Date(), anuladoPor: gerente.id, motivoAnulacion: "prueba" },
  ]);
  await db.insert(gastoPauta).values({ programId: programa.id, fecha: "2026-11-05", monto: "300000", moneda: "COP", origen: "manual", area: "paid" });
  expect(ajeno.id).not.toBe(programa.id);
});
afterAll(async () => cerrar());

function contexto(userId: string, rol: ContextoMcp["rol"]): ContextoMcp {
  const session = { user: { id: userId, email: `${rol}@retia.test`, name: rol, rol, operaComoCloser: false, closerId: rol === "closer" ? "Nicolás" : null, alcanceLimitado: rol === "closer" } } as Session;
  return { db, session, rol, tokenId: crypto.randomUUID(), escritura: false };
}

const periodo = { periodo: "custom" as const, desde: "2026-11-01", hasta: "2026-11-30" };

describe("consultar_hechos", () => {
  it.each([
    ["envio", "dia", "envios"], ["agenda", "dia", "agendas"], ["cita", "dia", "citas"],
    ["venta", "dia", "ventas"], ["abono", "dia", "abonos"], ["gasto", "dia", "monto"],
  ] as const)("%s lista y agrupa con totales paginados", async (hecho, dimension, medida) => {
    const base = { programa: slug, hecho, ...periodo, pagina: 1, tamano_de_pagina: 1 };
    const lista = (await consultarHechosMcp.ejecutar(contexto(gerenteId, "gerente"), consultarHechosMcp.entrada.parse(base))).estructurado;
    expect(lista.filas).toHaveLength(Math.min(1, lista.total as number));
    const grupo = (await consultarHechosMcp.ejecutar(contexto(gerenteId, "gerente"), consultarHechosMcp.entrada.parse({ ...base, agrupar_por: [dimension] }))).estructurado;
    expect(grupo.total).toBeGreaterThan(0);
    expect((grupo.filas as Record<string, unknown>[])[0]).toHaveProperty(medida);
  });

  it("excluye el abono anulado y separa COP de USD aunque no se pida moneda", async () => {
    const resultado = await consultarHechosMcp.ejecutar(contexto(gerenteId, "gerente"), consultarHechosMcp.entrada.parse({ programa: slug, hecho: "abono", ...periodo, agrupar_por: ["dia"], tamano_de_pagina: 50 }));
    const filas = resultado.estructurado.filas as Array<Record<string, unknown>>;
    expect(filas).toHaveLength(2);
    expect(new Set(filas.map((fila) => fila.moneda))).toEqual(new Set(["COP", "USD"]));
    expect(filas.reduce((total, fila) => total + Number(fila.abonos), 0)).toBe(2);
  });

  it("resuelve dueño por nombre igual que por id y cohorte todas no filtra", async () => {
    const pedir = async (valor: string) => consultarHechosMcp.ejecutar(contexto(gerenteId, "gerente"), consultarHechosMcp.entrada.parse({ programa: slug, hecho: "venta", ...periodo, filtros: { dueno: [valor], cohorte: ["todas"] } }));
    expect((await pedir("Nicolas")).estructurado.total).toBe((await pedir(closerId)).estructurado.total);
    await expect(pedir("Nadie")).rejects.toThrow(/en Hechos A.*Opciones/);
  });

  it("conserva sin dueño y sin cohorte, y rechaza todas junto con otra cohorte", async () => {
    const programId = (await db.select({ id: programs.id }).from(programs).where(eq(programs.slug, slug)))[0].id;
    const [sinAsignar] = await db.insert(leads).values({
      programId,
      emailNormalizado: "sin-asignar@retia.test",
      fechaPrimeraAplicacion: new Date("2026-11-01T12:00:00-05:00"),
    }).returning();
    const [dealSinAsignar] = await db.insert(deals).values({
      programId,
      leadId: sinAsignar.id,
      etapa: "agendado",
    }).returning();
    await db.insert(calls).values({
      programId,
      dealId: dealSinAsignar.id,
      fechaAgenda: new Date("2026-11-08T12:00:00-05:00"),
      origen: "app",
    });
    const pedir = (filtros: Record<string, (string | null)[]>) => consultarHechosMcp.ejecutar(
      contexto(gerenteId, "gerente"),
      consultarHechosMcp.entrada.parse({ programa: slug, hecho: "agenda", ...periodo, filtros, campos: ["dueno", "cohorte"] }),
    );
    const sinDueno = (await pedir({ dueno: [null] })).estructurado;
    expect(sinDueno.total).toBe(1);
    expect(sinDueno.filtros_aplicados).toContainEqual(expect.objectContaining({ campo: "dueno", id: null, nombre: "Sin dueño" }));
    const sinCohorte = (await pedir({ cohorte: [null] })).estructurado;
    expect(sinCohorte.total).toBe(1);
    expect(sinCohorte.filtros_aplicados).toContainEqual(expect.objectContaining({ campo: "cohorte", id: null, nombre: "Sin cohorte" }));
    await expect(pedir({ cohorte: ["todas", null] })).rejects.toMatchObject({ status: 422, message: "todas no se combina con otras cohortes" });
  });

  it("respeta frontera y permisos comerciales", async () => {
    await expect(consultarHechosMcp.ejecutar(contexto(paidId, "paid_trafficker"), consultarHechosMcp.entrada.parse({ programa: "hechos-b", hecho: "envio", ...periodo }))).rejects.toThrow("No existe ese programa");
    await expect(consultarHechosMcp.ejecutar(contexto(paidId, "paid_trafficker"), consultarHechosMcp.entrada.parse({ programa: slug, hecho: "venta", ...periodo, agrupar_por: ["dueno"] }))).rejects.toThrow("Tu rol no ve el trabajo por closer");
    await expect(consultarHechosMcp.ejecutar(contexto(gerenteId, "gerente"), consultarHechosMcp.entrada.parse({ programa: slug, hecho: "venta", ...periodo, agrupar_por: ["dueno"] }))).resolves.toBeDefined();
    expect(consultarHechosMcp.puede(contexto(closerId, "closer"))).toBe(false);
  });

  it("paid trafficker no puede pedir dimensiones del equipo mediante campos", async () => {
    for (const campo of ["dueno", "registrado_por"] as const) {
      await expect(consultarHechosMcp.ejecutar(
        contexto(paidId, "paid_trafficker"),
        consultarHechosMcp.entrada.parse({ programa: slug, hecho: "abono", ...periodo, campos: [campo] }),
      )).rejects.toMatchObject({ status: 403, message: "Tu rol no ve el trabajo por closer" });
    }
  });

  it("la proyección de paid trafficker quita siempre las dimensiones del equipo", async () => {
    const pedidos = [
      { programa: slug, hecho: "abono" as const, ...periodo },
      { programa: slug, hecho: "abono" as const, ...periodo, agrupar_por: ["dia" as const] },
    ];
    for (const pedido of pedidos) {
      const salida = await consultarHechosMcp.ejecutar(
        contexto(paidId, "paid_trafficker"),
        consultarHechosMcp.entrada.parse(pedido),
      );
      for (const fila of salida.estructurado.filas as Record<string, unknown>[]) {
        expect(fila).not.toHaveProperty("dueno");
        expect(fila).not.toHaveProperty("dueno_nombre");
        expect(fila).not.toHaveProperty("registrado_por");
        expect(fila).not.toHaveProperty("registrado_por_nombre");
      }
    }
  });

  it("gerencia recibe dueño y quién registró con sus nombres", async () => {
    const salida = await consultarHechosMcp.ejecutar(
      contexto(gerenteId, "gerente"),
      consultarHechosMcp.entrada.parse({ programa: slug, hecho: "abono", ...periodo, campos: ["dueno", "registrado_por"] }),
    );
    for (const fila of salida.estructurado.filas as Record<string, unknown>[]) {
      expect(fila).toMatchObject({
        dueno: closerId,
        dueno_nombre: "Nicolás",
        registrado_por: closerId,
        registrado_por_nombre: "Nicolás",
      });
    }
  });

  it("capacidades proyecta por rol y publica el esquema de hechos", async () => {
    const paid = await capacidadesMcp.ejecutar(contexto(paidId, "paid_trafficker"), { detalle: "esquema", herramienta: "consultar_hechos" });
    expect(paid.estructurado.acciones).toEqual([]);
    const consulta = (paid.estructurado.consultas as Array<{ hechos: Record<string, { dimensiones: string[] }> }>)[0];
    expect(consulta.hechos.venta.dimensiones).not.toContain("dueno");
    const gerente = await capacidadesMcp.ejecutar(contexto(gerenteId, "gerente"), { detalle: "esquema", herramienta: "consultar_hechos" });
    expect((gerente.estructurado.consultas as Array<{ hechos: Record<string, { dimensiones: string[] }> }>)[0].hechos.venta.dimensiones).toContain("dueno");
    const pendientes = gerente.estructurado.todavia_solo_en_la_app as Array<{ grupo: string; capacidad: string }>;
    expect(pendientes.length).toBeGreaterThan(0);
    expect(pendientes.every((fila) => ["operacion", "configuracion"].includes(fila.grupo))).toBe(true);
    expect(pendientes.every((fila) => fila.capacidad.length > 0 && !/Accion\b/.test(fila.capacidad))).toBe(true);
    expect(gerente.texto).toContain("todavía solo en la app");
  });

  it("ficha de lead acepta alias y canónico, pero no ambos", async () => {
    await expect(fichaDeLeadMcp.ejecutar(contexto(gerenteId, "gerente"), fichaDeLeadMcp.entrada.parse({ programa: slug, id: leadId }))).resolves.toBeDefined();
    await expect(fichaDeLeadMcp.ejecutar(contexto(gerenteId, "gerente"), fichaDeLeadMcp.entrada.parse({ programa: slug, id_de_la_persona: leadId }))).resolves.toBeDefined();
    expect(() => fichaDeLeadMcp.entrada.parse({ programa: slug, id: leadId, id_de_la_persona: leadId })).toThrow();
  });
});
