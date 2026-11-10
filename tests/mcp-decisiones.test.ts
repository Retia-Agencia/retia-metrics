import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  abonos,
  cohorts,
  cuentasPublicitarias,
  deals,
  dealEtapaHistorial,
  calls,
  gastoPauta,
  leads,
  miembrosPrograma,
  pautaObjetos,
  programs,
  sources,
  submissions,
  tasasCambio,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { carteraVencidaMcp, origenDelProgramaMcp, pautaRoasMcp } from "@/lib/mcp/herramientas/decisiones";
import { carteraVencida } from "@/lib/queries/cartera";
import { hoyEnBogota } from "@/lib/format";
import { resolverFiltroStudents, studentsDelPrograma } from "@/lib/queries/estudiantes";
import { origenDelPrograma, resumenDeOrigen } from "@/lib/queries/origen";
import { estadoDeCobertura } from "@/lib/cobertura";
import { cargarRoasDePauta, MOTIVO_GASTO_POR_CANAL } from "@/lib/queries/roas-de-pauta";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let cohorteA: string;
let fuenteA: string;
let fuenteB: string;
let gerenteId: string;
let paidId: string;
let closerId: string;
let actorId: string;
let anuncioDbId: string;
let secuencia = 0;

const HOY = "2026-11-06";
const RANGO = { desde: "2026-11-01", hasta: HOY };

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));

beforeEach(async () => {
  await vaciar();
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "decision-a", nombre: "Decisión A", ticketUsd: "800" },
    { ...PROGRAMA_DE_PRUEBA, slug: "decision-b", nombre: "Decisión B", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  programaB = b.id;
  const [ca] = await db.insert(cohorts).values({
    programId: programaA,
    codigo: "A1",
    metaCupos: 10,
    precioUsd: "800",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-11-30",
    fechaInicioClases: "2026-12-01",
    estado: "activo",
  }).returning();
  cohorteA = ca.id;
  await db.insert(cohorts).values({
    programId: programaB,
    codigo: "B1",
    metaCupos: 10,
    precioUsd: "1500",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-11-30",
    fechaInicioClases: "2026-12-01",
    estado: "activo",
  });
  const [sa, sb] = await db.insert(sources).values([
    { programId: programaA, nombre: "Formulario A" },
    { programId: programaB, nombre: "Formulario B" },
  ]).returning();
  fuenteA = sa.id;
  fuenteB = sb.id;
  const [gerente, paid, closer, actor] = await db.insert(users).values([
    { email: "gerente-decision@retia.test", rol: "gerente" },
    { email: "paid-decision@retia.test", rol: "paid_trafficker" },
    { email: "closer-decision@retia.test", rol: "closer", closerId: "Closer" },
    { email: "actor-decision@retia.test", rol: "developer" },
  ]).returning();
  gerenteId = gerente.id;
  paidId = paid.id;
  closerId = closer.id;
  actorId = actor.id;
  await db.insert(miembrosPrograma).values({ userId: closerId, programId: programaA });

  const cuenta = (await db.insert(cuentasPublicitarias).values({
    programId: programaA,
    idMeta: "cuenta-a",
    nombre: "Cuenta A",
    moneda: "COP",
    zonaHoraria: "America/Bogota",
  }).returning())[0];
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId: programaA, idMeta: "camp-a", nivel: "campana", nombre: "Campaña A", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId: programaA, idMeta: "set-a", nivel: "conjunto", padreIdMeta: "camp-a", nombre: "Conjunto A", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId: programaA, idMeta: "ad-a", nivel: "anuncio", padreIdMeta: "set-a", nombre: "Anuncio A", estado: "ACTIVE" },
  ]).returning();
  anuncioDbId = objetos.find((objeto) => objeto.idMeta === "ad-a")!.id;
  await db.insert(tasasCambio).values({
    vigenteDesde: "2026-11-02",
    vigenteHasta: HOY,
    pesosPorDolar: "4000",
    fuente: "prueba",
  });
  await db.insert(gastoPauta).values({
    programId: programaA,
    fecha: "2026-11-02",
    monto: "400000",
    moneda: "COP",
    origen: "meta_api",
    pautaObjetoId: anuncioDbId,
  });
});

afterAll(async () => cerrar());

function contexto(userId: string, rol: ContextoMcp["rol"]): ContextoMcp {
  return {
    db,
    session: {
      user: {
        id: userId,
        email: `${rol}@retia.test`,
        name: rol,
        rol,
        operaComoCloser: false,
        closerId: rol === "closer" ? "Closer" : null,
        alcanceLimitado: rol === "closer",
      },
    } as Session,
    rol,
    tokenId: crypto.randomUUID(),
    escritura: false,
  };
}

async function lead(programId: string, correo: string) {
  return (await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: correo, nombre: correo.split("@")[0] }).returning())[0];
}

async function dealVencido(args: {
  programId?: string;
  correo: string;
  anulado?: boolean;
  moneda?: string;
  cohortId?: string;
  valorVendidoUsd?: string;
  abono?: string;
  fechaLimitePago?: string;
}) {
  const programId = args.programId ?? programaA;
  const persona = await lead(programId, args.correo);
  const [deal] = await db.insert(deals).values({
    programId,
    leadId: persona.id,
    cohortId: args.cohortId ?? (programId === programaA ? cohorteA : null),
    etapa: "ganado_parcial",
    valorVendidoUsd: args.valorVendidoUsd ?? "800",
    fechaLimitePago: args.fechaLimitePago ?? "2026-10-31",
    ownerUserId: closerId,
    anuladoEn: args.anulado ? new Date("2026-11-01T12:00:00-05:00") : null,
    anuladoPor: args.anulado ? actorId : null,
    motivoAnulacion: args.anulado ? "Duplicado" : null,
  }).returning();
  await db.insert(abonos).values({
    programId,
    dealId: deal.id,
    fecha: "2026-10-20",
    monto: args.abono ?? "200",
    moneda: args.moneda ?? "USD",
  });
  return deal;
}

async function envio(programId: string, sourceId: string, correo: string, utmId: string | null) {
  const persona = await lead(programId, correo);
  const [fila] = await db.insert(submissions).values({
    sourceId,
    leadId: persona.id,
    token: `token-${++secuencia}`,
    fechaEnvio: new Date("2026-11-01T10:00:00-05:00"),
    utmSource: utmId ? "facebook" : null,
    utmMedium: utmId ? "paid_social" : null,
    utmId,
  }).returning();
  return { persona, fila };
}

describe("cartera_vencida", () => {
  it("conserva la cartera de Students, excluye anulados y otro programa, y muestra moneda", async () => {
    const vigente = await dealVencido({ correo: "vigente@retia.test" });
    await dealVencido({ correo: "anulado@retia.test", anulado: true });
    await dealVencido({ programId: programaB, correo: "otro@retia.test" });
    const directa = await carteraVencida(db, programaA, HOY, cohorteA);
    const salida = await carteraVencidaMcp.ejecutar(contexto(gerenteId, "gerente"), {
      programa: "decision-a",
      cohorte: cohorteA,
    });
    const filas = salida.estructurado.filas as Array<{ id_del_deal: string; saldo: { moneda: string; legible: string } }>;

    expect(directa.vencidos.map((fila) => fila.dealId)).toEqual([vigente.id]);
    expect(filas.map((fila) => fila.id_del_deal)).toEqual(directa.vencidos.map((fila) => fila.dealId));
    expect(salida.estructurado).toMatchObject({ pagina: 1, hay_otra_pagina: false });
    expect(filas[0].saldo).toMatchObject({ moneda: "USD", legible: "USD 600,00" });
    expect(carteraVencidaMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:dealId|leadId|ownerUserId|nombreLead|emailLead|fechaLimite|fechaPropia|diasDeAtraso|acuerdoPago|enlaceLead|fechaDeCorte)"\s*:/);
  });

  it("compone la pertenencia y el orden de Students con los saldos y vencimientos de cartera", async () => {
    const [otraCohorte] = await db.insert(cohorts).values({
      programId: programaA,
      codigo: "A2",
      metaCupos: 10,
      precioUsd: "800",
      fechaInicioVentas: "2027-01-01",
      fechaCierreVentas: "2027-01-31",
      fechaInicioClases: "2027-02-01",
      estado: "cerrado",
    }).returning();
    const saldoMenor = await dealVencido({
      correo: "alfa@retia.test", cohortId: cohorteA, valorVendidoUsd: "700", abono: "300", fechaLimitePago: "2026-10-20",
    });
    const saldoMayor = await dealVencido({
      correo: "zulu@retia.test", cohortId: cohorteA, valorVendidoUsd: "900", abono: "100", fechaLimitePago: "2026-10-30",
    });
    const excluido = await dealVencido({
      correo: "excluido@retia.test", cohortId: otraCohorte.id, valorVendidoUsd: "1000", abono: "50",
    });
    const resueltos = resolverFiltroStudents({
      cohortes: [{ id: cohorteA, estado: "activo" }, { id: otraCohorte.id, estado: "cerrado" }],
      cohorte: cohorteA,
      orden: "saldo:desc",
    });
    const [students, cartera] = await Promise.all([
      studentsDelPrograma(db, programaA, resueltos.filtro, hoyEnBogota()),
      carteraVencida(db, programaA, hoyEnBogota(), resueltos.cohorte?.id),
    ]);
    const salida = await carteraVencidaMcp.ejecutar(contexto(gerenteId, "gerente"), {
      programa: "decision-a",
      cohorte: cohorteA,
      orden: "saldo:desc",
    });
    const filas = salida.estructurado.filas as Array<{
      id_del_deal: string;
      saldo: { valor: number; moneda: string } | null;
      fecha_limite: string;
      dias_de_atraso: number;
    }>;
    const vencidosPorId = new Map(cartera.vencidos.map((fila) => [fila.dealId, fila]));
    const idsSegunStudents = students.filter((fila) => vencidosPorId.has(fila.dealId)).map((fila) => fila.dealId);

    expect(cartera.vencidos.map((fila) => fila.dealId)).toEqual([saldoMenor.id, saldoMayor.id]);
    expect(idsSegunStudents).toEqual([saldoMayor.id, saldoMenor.id]);
    expect(filas.map((fila) => fila.id_del_deal)).toEqual(idsSegunStudents);
    expect(filas).toEqual(idsSegunStudents.map((id) => {
      const directa = vencidosPorId.get(id)!;
      return expect.objectContaining({
        id_del_deal: id,
        saldo: directa.moneda === null ? null : { valor: directa.saldo, moneda: directa.moneda, legible: expect.any(String) },
        fecha_limite: directa.fechaLimite,
        dias_de_atraso: directa.diasDeAtraso,
      });
    }));
    expect(filas.map((fila) => fila.id_del_deal)).not.toContain(excluido.id);
  });

  it("un closer no puede forjar un programa sin membresía y un rol sin capacidad ve el mismo 404", async () => {
    await expect(carteraVencidaMcp.ejecutar(contexto(closerId, "closer"), { programa: "decision-b" }))
      .rejects.toMatchObject({ status: 404, message: "No existe ese programa" });
    await expect(carteraVencidaMcp.ejecutar(contexto(paidId, "paid_trafficker"), { programa: "decision-a" }))
      .rejects.toMatchObject({ status: 404, message: "No existe ese programa" });
  });
});

describe("pauta_roas", () => {
  it("coincide con la fila del Hub y declara cobertura incompleta, moneda, anulados y frontera", async () => {
    const pagado = await envio(programaA, fuenteA, "pagado@retia.test", "ad-a");
    const [venta] = await db.insert(deals).values({
      programId: programaA,
      leadId: pagado.persona.id,
      submissionOrigenId: pagado.fila.id,
      ownerUserId: closerId,
      etapa: "ganado_completo",
      valorVendidoUsd: "300",
    }).returning();
    await db.insert(dealEtapaHistorial).values({ dealId: venta.id, a: "ganado_completo", fecha: new Date("2026-11-03T12:00:00-05:00") });
    const anulado = await envio(programaA, fuenteA, "anulado-roas@retia.test", "ad-a");
    await db.insert(deals).values({
      programId: programaA,
      leadId: anulado.persona.id,
      submissionOrigenId: anulado.fila.id,
      ownerUserId: closerId,
      etapa: "ganado_completo",
      valorVendidoUsd: "900",
      anuladoEn: new Date("2026-11-03T12:00:00-05:00"),
      anuladoPor: actorId,
      motivoAnulacion: "Duplicado",
    });
    await envio(programaB, fuenteB, "otro-roas@retia.test", null);

    const directa = await cargarRoasDePauta(db, programaA, RANGO, HOY);
    const salida = await pautaRoasMcp.ejecutar(contexto(paidId, "paid_trafficker"), {
      programa: "decision-a",
      periodo: "custom",
      desde: RANGO.desde,
      hasta: RANGO.hasta,
      nivel: "total",
    });
    const roas = salida.estructurado.roas as { valor: number | null; estado: string; faltan: number };

    expect(salida.estructurado.envios).toBe(directa.total.registros);
    expect(salida.estructurado.ventas).toBe(directa.total.ventas);
    expect(roas).toMatchObject({ valor: null, estado: "no_calculable", faltan: 1 });
    expect(pautaRoasMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:registros|agendas|shows|noShows|contratadoUsd|gastoUsd|cobertura)"\s*:/);
    expect(salida.texto).toContain("ROAS: —");
    expect(salida.texto).toContain("USD 300,00");
  });

  it("nivel canal: gasto y ROAS no disponibles (null con motivo) aunque haya gasto real; nunca 0", async () => {
    await envio(programaA, fuenteA, "canal-roas@retia.test", "ad-a");
    const directa = await cargarRoasDePauta(db, programaA, RANGO, HOY);
    expect(directa.total.gastoUsd).toBeGreaterThan(0);
    const canal = directa.canales[0]!;
    const salida = await pautaRoasMcp.ejecutar(contexto(paidId, "paid_trafficker"), {
      programa: "decision-a", periodo: "custom", desde: RANGO.desde, hasta: RANGO.hasta, nivel: "canal", id: canal.id!,
    });
    const roas = salida.estructurado.roas as { valor: number | null; motivo: string | null; estado: string };
    expect(salida.estructurado.gasto).toBeNull();
    expect(roas).toMatchObject({ valor: null, estado: "no_calculable", motivo: MOTIVO_GASTO_POR_CANAL });
    expect(pautaRoasMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(salida.texto).toContain("gasto: —");
    expect(salida.texto).not.toContain("Sin pauta");
  });

  it("madurez: una cita pendiente válida da el MISMO estado parcial en la tarjeta y en el MCP", async () => {
    // El gasto cubre el día del envío (1-nov): sin esto el ROAS sería no calculable por gasto, no por madurez.
    await db.insert(tasasCambio).values({ vigenteDesde: "2026-11-01", vigenteHasta: "2026-11-01", pesosPorDolar: "4000", fuente: "prueba" });
    await db.insert(gastoPauta).values({ programId: programaA, fecha: "2026-11-01", monto: "400000", moneda: "COP", origen: "meta_api", pautaObjetoId: anuncioDbId });
    const e = await envio(programaA, fuenteA, "madurez@retia.test", "ad-a");
    const [venta] = await db.insert(deals).values({ programId: programaA, leadId: e.persona.id, submissionOrigenId: e.fila.id,
      ownerUserId: closerId, etapa: "ganado_completo", valorVendidoUsd: "300" }).returning();
    await db.insert(dealEtapaHistorial).values({ dealId: venta.id, a: "ganado_completo", fecha: new Date("2026-11-03T12:00:00-05:00") });
    const abierto = await envio(programaA, fuenteA, "madurez-abierto@retia.test", "ad-a");
    const [dealAbierto] = await db.insert(deals).values({ programId: programaA, leadId: abierto.persona.id, submissionOrigenId: abierto.fila.id,
      ownerUserId: closerId, etapa: "agendado" }).returning();
    await db.insert(calls).values({ programId: programaA, dealId: dealAbierto.id, resultado: "agendada",
      fechaAgenda: new Date(Date.now() + 5 * 86_400_000), createdAt: new Date("2026-11-03T09:00:00-05:00") });
    const directa = await cargarRoasDePauta(db, programaA, RANGO, HOY);
    const salida = await pautaRoasMcp.ejecutar(contexto(paidId, "paid_trafficker"), {
      programa: "decision-a", periodo: "custom", desde: RANGO.desde, hasta: RANGO.hasta, nivel: "total",
    });
    const roas = salida.estructurado.roas as { valor: number | null; estado: string; agendas_pendientes: number };
    expect(directa.agendasPendientes).toBe(1);
    expect(estadoDeCobertura(directa.total.roas)).toBe("parcial");
    expect(roas).toMatchObject({ estado: "parcial", agendas_pendientes: 1 });
    expect(roas.valor).toBe(directa.total.roas.valor);
    // 403 F0 (10-nov): con una agenda pendiente la salida copiaba `agendasPendientes` y el `.strict()` la rechazaba
    // en producción ("Error interno"); el contrato tiene que aceptar la misma salida que el handler devuelve.
    expect(pautaRoasMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(salida.texto).toContain("parcial: 1 agenda pendiente");
  });

  it("una llamada forjada por un closer falla como programa desconocido", async () => {
    await expect(pautaRoasMcp.ejecutar(contexto(closerId, "closer"), {
      programa: "decision-a",
      periodo: "hoy",
      nivel: "total",
    })).rejects.toMatchObject({ status: 404, message: "No existe ese programa" });
  });
});

describe("origen_del_programa", () => {
  it("coincide con la proyección del Hub y siempre muestra Sin UTM con conteo y porcentaje", async () => {
    await envio(programaA, fuenteA, "sin-utm@retia.test", null);
    await envio(programaA, fuenteA, "paid@retia.test", "ad-a");
    await envio(programaB, fuenteB, "otro-origen@retia.test", null);
    const directa = await origenDelPrograma(db, { programId: programaA, rango: RANGO, hoy: HOY });
    const salida = await origenDelProgramaMcp.ejecutar(contexto(gerenteId, "gerente"), {
      programa: "decision-a",
      periodo: "custom",
      desde: RANGO.desde,
      hasta: RANGO.hasta,
    });
    const canales = salida.estructurado.canales as Array<{ nombre: string; envios: number; porcentaje_del_total: number | null }>;
    const sinUtm = canales.find((fila) => fila.nombre === "Sin UTM");

    expect(canales).toEqual(resumenDeOrigen(directa).map((fila) => ({
      nombre: fila.nombre,
      envios: fila.registros,
      agendadas: fila.agendas,
      porcentaje_del_total: fila.porcentajeDelTotal,
      porcentaje_de_agendadas: fila.porcentajeAgenda,
    })));
    expect(sinUtm).toMatchObject({ envios: 1, porcentaje_del_total: 0.5 });
    expect(origenDelProgramaMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:clave|registros|agendas|porcentajeDelTotal|porcentajeAgenda|totalRegistros|contenidoNoReconocido|precision)"\s*:/);
    expect(salida.texto).toContain("Sin UTM: 1 (50,0%)");
    expect(salida.texto).not.toContain("utm_");
  });

  it("un rol sin la capacidad del Hub recibe programa desconocido", async () => {
    await expect(origenDelProgramaMcp.ejecutar(contexto(closerId, "closer"), {
      programa: "decision-a",
      periodo: "hoy",
    })).rejects.toMatchObject({ status: 404, message: "No existe ese programa" });
  });
});
