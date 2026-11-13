import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { calls, cohorts, deals, leads, miembrosPrograma, programs, sources, submissions, users, usuariosProgramasAlcance } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { bandejaMcp, buscarLeadsMcp, fichaDeDealMcp, fichaDeLeadMcp, opcionesDeFiltrosMcp, tableroDeDealsMcp } from "@/lib/mcp/herramientas/operacion";
import { filtrosDeLeads } from "@/lib/queries/filtros-de-leads";
import { leadsDelPrograma } from "@/lib/queries/leads";
import { bandejaParaActor, fichaDeDealVisible, fichaDeLeadParaActor, tableroDeDealsParaActor } from "@/lib/queries/operacion";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let closerId: string;
let otroCloserId: string;
let gerenteId: string;
let csId: string;
let paidId: string;
let leadId: string;
let dealId: string;
let dealAjenoId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));

beforeEach(async () => {
  await vaciar();
  const [a] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "operacion-a", nombre: "Operación A", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "operacion-b", nombre: "Operación B", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  const [closer, otro, gerente, cs, paid] = await db.insert(users).values([
    { email: "closer-operacion@retia.test", nombre: "Closer", rol: "closer", closerId: "Closer" },
    { email: "otro-operacion@retia.test", nombre: "Otro", rol: "closer", closerId: "Otro" },
    { email: "gerente-operacion@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "cs-operacion@retia.test", nombre: "CS", rol: "customer_success" },
    { email: "paid-operacion@retia.test", nombre: "Paid", rol: "paid_trafficker" },
  ]).returning();
  closerId = closer.id;
  otroCloserId = otro.id;
  gerenteId = gerente.id;
  csId = cs.id;
  paidId = paid.id;
  await db.insert(miembrosPrograma).values([
    { userId: closerId, programId: programaA },
    { userId: otroCloserId, programId: programaA },
    { userId: csId, programId: programaA },
  ]);
  await db.insert(usuariosProgramasAlcance).values({ userId: paidId, programId: programaA });
  const [cohorte] = await db.insert(cohorts).values({
    programId: programaA,
    codigo: "A1",
    metaCupos: 10,
    precioUsd: "797",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-12-01",
    fechaInicioClases: "2026-12-02",
    estado: "activo",
  }).returning();
  const [fuente] = await db.insert(sources).values({ programId: programaA, nombre: "Formulario" }).returning();
  const [lead, leadAjeno] = await db.insert(leads).values([
    { fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programaA, emailNormalizado: "ana@retia.test", nombre: "Ana", telefono: "3001234567" },
    { fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programaA, emailNormalizado: "beto@retia.test", nombre: "Beto" },
  ]).returning();
  leadId = lead.id;
  const [envio] = await db.insert(submissions).values({
    leadId,
    sourceId: fuente.id,
    token: "ana",
    fechaEnvio: new Date("2026-11-01T12:00:00-05:00"),
    respuestas: { Calendly: "https://calendly.test/secreto", Necesidad: "Vender más" },
  }).returning();
  const [propio, ajeno] = await db.insert(deals).values([
    { programId: programaA, leadId, submissionOrigenId: envio.id, cohortId: cohorte.id, ownerUserId: closerId, etapa: "agendado" },
    { programId: programaA, leadId: leadAjeno.id, cohortId: cohorte.id, ownerUserId: otroCloserId, etapa: "agendado" },
  ]).returning();
  dealId = propio.id;
  dealAjenoId = ajeno.id;
  await db.insert(calls).values({
    programId: programaA,
    dealId,
    closerUserId: closerId,
    resultado: "agendada",
    fechaAgenda: new Date("2020-01-01T12:00:00-05:00"),
    emailLead: "ana@retia.test",
    origen: "calendly",
  });
}, 60_000);

afterAll(async () => cerrar());

function contexto(userId: string, rol: ContextoMcp["rol"]): ContextoMcp {
  const session = {
    user: {
      id: userId,
      email: `${rol}@retia.test`,
      name: rol,
      rol,
      operaComoCloser: false,
      closerId: rol === "closer" ? "Closer" : null,
      alcanceLimitado: rol === "closer" || rol === "customer_success",
    },
  } as Session;
  return { db, session, rol, tokenId: crypto.randomUUID(), escritura: false };
}

describe("herramientas MCP de operación", () => {
  it("buscar_leads conserva filtros y paginación de la función de la página", async () => {
    const entrada = { programa: "operacion-a", q: "ana", deal: "con" as const, pagina: 1 };
    const directo = await leadsDelPrograma(db, programaA, { ...filtrosDeLeads(entrada, 0).filtro, porPagina: 50 });
    const salida = await buscarLeadsMcp.ejecutar(contexto(gerenteId, "gerente"), entrada);
    const filas = salida.estructurado.filas as { id_de_la_persona: string; enlace_de_la_persona: string }[];
    expect(filas.map((fila) => fila.id_de_la_persona)).toEqual(directo.filas.map((fila) => fila.id));
    expect(filas[0]?.enlace_de_la_persona).toMatch(`/p/operacion-a/leads/${leadId}`);
    expect(buscarLeadsMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:leadQuality|leadValue|fechaUltimaAplicacion|numAplicaciones|tieneDeal|soloParciales|correosSinConfirmar|haySiguiente|canal)"\s*:/);
  });

  it("un closer no puede forjar un programa fuera de sus membresías", async () => {
    await expect(buscarLeadsMcp.ejecutar(contexto(closerId, "closer"), {
      programa: "operacion-b", q: "ana", pagina: 1,
    })).rejects.toThrow("No existe ese programa");
  });

  it("ficha_de_lead aplica la misma proyección básica de Customer Success", async () => {
    const ctx = contexto(csId, "customer_success");
    const directo = await fichaDeLeadParaActor(db, programaA, leadId, { rol: "customer_success", operaComoCloser: false });
    const salida = await fichaDeLeadMcp.ejecutar(ctx, fichaDeLeadMcp.entrada.parse({ programa: "operacion-a", id: leadId, detalle: "completa" }));
    const ficha = salida.estructurado.ficha as { envios: Record<string, unknown>[]; deals: Record<string, unknown>[]; enlace: string };
    expect(salida.estructurado.basico).toBe(true);
    expect(ficha.envios).toHaveLength(directo!.ficha.envios.length);
    expect(JSON.stringify(ficha)).not.toContain("calendly.test/secreto");
    expect(ficha.envios.every((envio) => !("campos" in envio) && !("cambios" in envio))).toBe(true);
    expect(ficha.deals.every((deal) => !("dueno" in deal))).toBe(true);
    expect(JSON.stringify(ficha)).not.toMatch(/"closer"\s*:/);
    expect(fichaDeLeadMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:dealId|leadId|programId|leadQuality|leadValue|ownerNombre|enlaceLead)"\s*:/);
    const compacta = await fichaDeLeadMcp.ejecutar(ctx, fichaDeLeadMcp.entrada.parse({ programa: "operacion-a", id: leadId }));
    expect(JSON.stringify((compacta.estructurado.ficha as { envios: unknown[] }).envios)).not.toMatch(/"(?:campos|cambios)"\s*:/);
    const gerencia = await fichaDeLeadMcp.ejecutar(contexto(gerenteId, "gerente"), fichaDeLeadMcp.entrada.parse({ programa: "operacion-a", id: leadId, detalle: "completa" }));
    expect((gerencia.estructurado.ficha as { deals: Record<string, unknown>[] }).deals[0]).toHaveProperty("dueno", "Closer");
  });

  it("ficha_de_deal conserva la ficha visible y oculta como 404 el deal de otro dueño", async () => {
    const ctx = contexto(closerId, "closer");
    const directo = await fichaDeDealVisible(db, programaA, dealId, ctx.session, "closer");
    const salida = await fichaDeDealMcp.ejecutar(ctx, fichaDeDealMcp.entrada.parse({ programa: "operacion-a", id: dealId }));
    expect((salida.estructurado.ficha as { id_del_deal: string }).id_del_deal).toBe(directo!.ficha.dealId);
    expect(fichaDeDealMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:dealId|leadId|programId|leadQuality|leadValue|ownerNombre|enlaceLead)"\s*:/);
    await expect(fichaDeDealMcp.ejecutar(ctx, fichaDeDealMcp.entrada.parse({ programa: "operacion-a", id: dealAjenoId })))
      .rejects.toThrow("No existe ese deal");
  });

  it("tablero_de_deals conserva el resultado paginado y declara filtros sin mezclar opciones", async () => {
    const ctx = contexto(closerId, "closer");
    const directo = await tableroDeDealsParaActor(db, programaA, ctx.session, { q: "ana", vista: "todo" });
    const salida = await tableroDeDealsMcp.ejecutar(ctx, tableroDeDealsMcp.entrada.parse({ programa: "operacion-a", q: "ana", vista: "todo" }));
    const tablero = salida.estructurado.tablero as { total: number; columnas: { tarjetas: { id_del_deal: string; enlace: string }[] }[] };
    expect(tablero.total).toBe(directo.tablero.total);
    expect(salida.estructurado).toMatchObject({ pagina: 1, hay_otra_pagina: false });
    expect(salida.estructurado).not.toHaveProperty("opciones");
    expect(salida.estructurado.filtros_aplicados).toEqual(expect.arrayContaining([expect.objectContaining({ campo: "cohorte", nombre: "A1", origen: "por_defecto", como_quitarlo: 'pide cohorte: "todas"' })]));
    expect(tablero.columnas.flatMap((c) => c.tarjetas).map((t) => t.id_del_deal)).toEqual([dealId]);
    expect(tableroDeDealsMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:dealId|leadId|ownerUserId|leadQuality|leadValue|enlaceLead|enProximaCohorte)"\s*:/);
  });

  it("resuelve dueño por nombre o id, falla de forma accionable y separa las opciones", async () => {
    const ctx = contexto(gerenteId, "gerente");
    const porNombre = await tableroDeDealsMcp.ejecutar(ctx, tableroDeDealsMcp.entrada.parse({ programa: "operacion-a", dueno: "Closer" }));
    const porId = await tableroDeDealsMcp.ejecutar(ctx, tableroDeDealsMcp.entrada.parse({ programa: "operacion-a", dueno: closerId }));
    expect((porNombre.estructurado.tablero as { total: number }).total).toBe((porId.estructurado.tablero as { total: number }).total);
    await expect(tableroDeDealsMcp.ejecutar(ctx, tableroDeDealsMcp.entrada.parse({ programa: "operacion-a", dueno: "Nadie" }))).rejects.toThrow(/Opciones:/);
    const opciones = await opcionesDeFiltrosMcp.ejecutar(ctx, opcionesDeFiltrosMcp.entrada.parse({ programa: "operacion-a" }));
    expect(opciones.estructurado.opciones).toMatchObject({ duenos: expect.arrayContaining([expect.objectContaining({ id: closerId, nombre: "Closer" })]), cohorte_activa: expect.objectContaining({ codigo: "A1" }) });
    expect(opciones.estructurado.opciones).not.toHaveProperty("owners");
    expect(opcionesDeFiltrosMcp.salida.safeParse(opciones.estructurado).success).toBe(true);
  });

  it("opciones de filtros proyecta dimensiones comerciales por rol", async () => {
    const pedir = (userId: string, rol: ContextoMcp["rol"], de: "tablero" | "hechos") =>
      opcionesDeFiltrosMcp.ejecutar(contexto(userId, rol), opcionesDeFiltrosMcp.entrada.parse({ programa: "operacion-a", de }));
    for (const de of ["tablero", "hechos"] as const) {
      const paid = (await pedir(paidId, "paid_trafficker", de)).estructurado.opciones as Record<string, unknown>;
      expect(paid).not.toHaveProperty("duenos");
      const gerente = (await pedir(gerenteId, "gerente", de)).estructurado.opciones as Record<string, unknown>;
      expect(gerente).toHaveProperty("duenos");
      if (de === "hechos") {
        const hechosPaid = paid.hechos as Record<string, { dimensiones: string[] }>;
        const hechosGerente = gerente.hechos as Record<string, { dimensiones: string[] }>;
        for (const hecho of Object.values(hechosPaid)) {
          expect(hecho.dimensiones).not.toContain("dueno");
          expect(hecho.dimensiones).not.toContain("registrado_por");
        }
        expect(hechosGerente.abono.dimensiones).toEqual(expect.arrayContaining(["dueno", "registrado_por"]));
      }
    }
  });

  it("un dueño ambiguo falla con ambos ids y declara el dueño pedido", async () => {
    const [duplicado] = await db.insert(users).values({ email: "closer-duplicado@retia.test", nombre: "Closer", rol: "closer", closerId: "Closer duplicado" }).returning();
    const [persona] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programaA, emailNormalizado: "duplicado@retia.test", nombre: "Duplicado" }).returning();
    await db.insert(deals).values({ programId: programaA, leadId: persona.id, ownerUserId: duplicado.id, etapa: "contactado" });
    const ctx = contexto(gerenteId, "gerente");
    await expect(tableroDeDealsMcp.ejecutar(ctx, tableroDeDealsMcp.entrada.parse({ programa: "operacion-a", dueno: "Closer" })))
      .rejects.toThrow(new RegExp(`${closerId}.*${duplicado.id}|${duplicado.id}.*${closerId}`));
    const pedido = await tableroDeDealsMcp.ejecutar(ctx, tableroDeDealsMcp.entrada.parse({ programa: "operacion-a", dueno: closerId }));
    expect(pedido.estructurado.filtros_aplicados).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: "dueno", id: closerId, origen: "pedido" }),
    ]));
  });

  it("cohorte todas incluye una cohorte que el valor predeterminado excluye", async () => {
    const [otra] = await db.insert(cohorts).values({
      programId: programaA, codigo: "A0", metaCupos: 10, precioUsd: "797",
      fechaInicioVentas: "2026-07-01", fechaCierreVentas: "2026-08-01", fechaInicioClases: "2026-08-02", estado: "cerrado",
    }).returning();
    const [persona] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programaA, emailNormalizado: "otra-cohorte@retia.test", nombre: "Otra cohorte" }).returning();
    await db.insert(deals).values({ programId: programaA, leadId: persona.id, cohortId: otra.id, ownerUserId: closerId, etapa: "contactado" });
    const ctx = contexto(gerenteId, "gerente");
    const predeterminado = await tableroDeDealsMcp.ejecutar(ctx, tableroDeDealsMcp.entrada.parse({ programa: "operacion-a" }));
    const todas = await tableroDeDealsMcp.ejecutar(ctx, tableroDeDealsMcp.entrada.parse({ programa: "operacion-a", cohorte: "todas" }));
    expect((todas.estructurado.tablero as { total: number }).total)
      .toBe((predeterminado.estructurado.tablero as { total: number }).total + 1);
  });

  it("bandeja conserva el alcance y las secciones de la composición de página", async () => {
    const ctx = contexto(closerId, "closer");
    const directo = await bandejaParaActor(db, programaA, ctx.session, "closer");
    const salida = await bandejaMcp.ejecutar(ctx, { programa: "operacion-a" });
    const llamadas = salida.estructurado.llamadas_por_registrar as { id_del_deal: string; enlace: string }[];
    expect(llamadas.map((fila) => fila.id_del_deal)).toEqual(directo!.inbox.llamadasDeHoy.map((fila) => fila.dealId));
    expect(llamadas[0]?.enlace).toMatch(`/p/operacion-a/deals/${dealId}`);
    expect(bandejaMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:dealId|leadId|unclaimed|pendienteSetteo|llamadasSueltas|llamadasDeHoy|llamadasSinCloser|saldoLegible|enlaceLead)"\s*:/);
  });
});
