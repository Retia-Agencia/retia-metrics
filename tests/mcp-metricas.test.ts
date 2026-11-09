import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { calls, deals, dealEtapaHistorial, leads, miembrosPrograma, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { consultarMetricaMcp, resumenDelHubMcp } from "@/lib/mcp/herramientas/metricas";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { resumenDeMetrica } from "@/lib/queries/metricas-con-filas";
import { vistaDeLista } from "@/lib/queries/vista-metrica";
import { armarVistaDelDashboard, resolverContextoDeVista } from "@/lib/queries/vista-dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let fuenteA: string;
let fuenteB: string;
let gerenteId: string;
let paidId: string;
let closerId: string;

const HOY = "2026-11-06";
const RANGO = { desde: "2026-11-01", hasta: HOY };

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));

beforeEach(async () => {
  await vaciar();
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  programaB = b.id;
  const [origenA, origenB] = await db.insert(sources).values([
    { programId: programaA, nombre: "Formulario A" },
    { programId: programaB, nombre: "Formulario B" },
  ]).returning();
  fuenteA = origenA.id;
  fuenteB = origenB.id;
  const [gerente, paid, closer] = await db.insert(users).values([
    { email: "gerente-metricas@retia.test", rol: "gerente" },
    { email: "paid-metricas@retia.test", rol: "paid_trafficker" },
    { email: "closer-metricas@retia.test", rol: "closer", closerId: "Ana" },
  ]).returning();
  gerenteId = gerente.id;
  paidId = paid.id;
  closerId = closer.id;
  await db.insert(miembrosPrograma).values({ userId: closerId, programId: programaA });

  async function venta(programId: string, correo: string, anulada = false) {
    const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: correo }).returning();
    await db.insert(submissions).values({
      sourceId: programId === programaA ? fuenteA : fuenteB,
      leadId: lead.id,
      token: correo,
      fechaEnvio: new Date("2026-11-05T08:00:00-05:00"),
      utmSource: "facebook",
      utmMedium: "paid_social",
    });
    const [deal] = await db.insert(deals).values({
      programId,
      leadId: lead.id,
      ownerUserId: closerId,
      etapa: "ganado_parcial",
      valorVendidoUsd: "797",
      comisionPorcentaje: "10",
      anuladoEn: anulada ? new Date("2026-11-05T12:00:00-05:00") : null,
      anuladoPor: anulada ? gerenteId : null,
      motivoAnulacion: anulada ? "Corrección de prueba" : null,
    }).returning();
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id,
      a: "ganado_parcial",
      fecha: new Date("2026-11-05T10:00:00-05:00"),
    });
    return deal;
  }

  const vigente = await venta(programaA, "vigente@retia.test");
  await venta(programaA, "anulada@retia.test", true);
  await venta(programaB, "otro-programa@retia.test");
  await db.insert(calls).values({
    programId: programaA,
    dealId: vigente.id,
    closerUserId: closerId,
    closerId: "Ana",
    resultado: "agendada",
    fechaAgenda: new Date("2026-11-06T15:00:00-05:00"),
    createdAt: new Date("2026-11-05T09:00:00-05:00"),
  });
}, 60_000);

afterAll(async () => cerrar());

function contexto(userId: string, rol: ContextoMcp["rol"]): ContextoMcp {
  return {
    db,
    session: { user: { id: userId, email: `${rol}@retia.test`, name: rol } } as Session,
    rol,
    tokenId: crypto.randomUUID(),
    escritura: false,
  };
}

describe("herramientas MCP de métricas", () => {
  it("resumen_del_hub conserva la cifra de la página y excluye anuladas y otro programa", async () => {
    const entradaDeVista = { programId: programaA, hoy: HOY, periodo: { preset: "custom" as const, a: RANGO, comparaciones: [] }, preset: "custom" };
    const contextoVista = await resolverContextoDeVista(entradaDeVista, db);
    const pagina = await armarVistaDelDashboard(entradaDeVista, db, contextoVista);

    const salida = await resumenDelHubMcp.ejecutar(contexto(gerenteId, "gerente"), {
      programa: "programa-a", periodo: "custom", desde: RANGO.desde, hasta: RANGO.hasta,
    });
    const estructurado = salida.estructurado as {
      cifras: { ventas: { valor: number }; vendido: { valor: number } };
      tasas: { asistencia: { valor: number | null }; cita_a_venta: { valor: number | null } };
    };

    expect(pagina.embudo.cierres).toBe(1);
    expect(estructurado.cifras.ventas.valor).toBe(pagina.embudo.cierres);
    expect(estructurado.cifras.vendido.valor).toBe(pagina.dinero.vendido);
    expect(estructurado.tasas.asistencia.valor).toBe(pagina.embudo.razonShow.valor);
    expect(estructurado.tasas.cita_a_venta.valor).toBe(pagina.embudo.agendaAVenta);
    expect(resumenDelHubMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(Object.keys(salida.estructurado)).not.toContain("vista");
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:contratadoUsd|embudo|cierres|dinero)"\s*:/);
    expect(salida.texto).toContain("cobertura");
  });

  it("consultar_metrica conserva el número de la función de página", async () => {
    const [pagina] = await resumenDeMetrica("cierres", { programId: programaA, rango: RANGO, hoy: HOY }, db);
    const salida = await consultarMetricaMcp.ejecutar(contexto(gerenteId, "gerente"), {
      programa: "programa-a", metrica: "cierres", periodo: "custom", desde: RANGO.desde, hasta: RANGO.hasta, pagina: 1,
    });
    const resumen = salida.estructurado.resumen as { total: number };

    expect(pagina.subtotal.cantidad).toBe(1);
    expect(resumen.total).toBe(pagina.subtotal.cantidad);
    expect(consultarMetricaMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:contratadoUsd|embudo|cierres|dinero)"\s*:/);
  });

  it("consultar_metrica aplica los filtros de origen igual que la función de página", async () => {
    const busqueda = { periodo: "custom", a_desde: RANGO.desde, a_hasta: RANGO.hasta, comparar: "no" };
    const pagina = await vistaDeLista({
      programId: programaA,
      metrica: "registros",
      busqueda,
      hoy: HOY,
      source: "facebook",
      pagina: 1,
    }, db);
    const salida = await consultarMetricaMcp.ejecutar(contexto(gerenteId, "gerente"), {
      programa: "programa-a",
      metrica: "registros",
      periodo: "custom",
      desde: RANGO.desde,
      hasta: RANGO.hasta,
      source: "facebook",
      pagina: 1,
    });
    const resumen = salida.estructurado.resumen as { total: number };

    expect(resumen.total).toBe(pagina?.lista.subtotal.cantidad);
  });

  it("consultar_metrica convierte una combinación inexistente en error de aplicación", async () => {
    await expect(consultarMetricaMcp.ejecutar(contexto(gerenteId, "gerente"), {
      programa: "programa-a",
      metrica: "caja",
      periodo: "hoy",
      pago: "completo",
      pagina: 1,
    })).rejects.toMatchObject({ status: 404, message: "No existe esa lista" });
  });

  it("una llamada forjada de un closer a otro programa no confirma que exista", async () => {
    await expect(consultarMetricaMcp.ejecutar(contexto(closerId, "closer"), {
      programa: "programa-b", metrica: "no_agendaron", periodo: "hoy", pagina: 1,
    })).rejects.toMatchObject({ status: 404, message: "No existe ese programa" });
  });

  it("paid trafficker no recibe closers, deals ni montos", async () => {
    const salida = await consultarMetricaMcp.ejecutar(contexto(paidId, "paid_trafficker"), {
      programa: "programa-a", metrica: "agendas_creadas", periodo: "custom", desde: RANGO.desde, hasta: RANGO.hasta, pagina: 1,
    });
    const filas = salida.estructurado.filas as Array<{ responsable: unknown; valor: unknown }>;

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ responsable: null, valor: null });
    expect(JSON.stringify(salida.estructurado)).not.toContain("Ana");
  });
});
