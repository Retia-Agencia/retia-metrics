import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  abonos,
  cohorts,
  cuentasPublicitarias,
  deals,
  dealEtapaHistorial,
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
import { origenDelPrograma, resumenDeOrigen } from "@/lib/queries/origen";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
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

async function dealVencido(args: { programId?: string; correo: string; anulado?: boolean; moneda?: string }) {
  const programId = args.programId ?? programaA;
  const persona = await lead(programId, args.correo);
  const [deal] = await db.insert(deals).values({
    programId,
    leadId: persona.id,
    cohortId: programId === programaA ? cohorteA : null,
    etapa: "ganado_parcial",
    valorVendidoUsd: "800",
    fechaLimitePago: "2026-10-31",
    ownerUserId: closerId,
    anuladoEn: args.anulado ? new Date("2026-11-01T12:00:00-05:00") : null,
    anuladoPor: args.anulado ? actorId : null,
    motivoAnulacion: args.anulado ? "Duplicado" : null,
  }).returning();
  await db.insert(abonos).values({
    programId,
    dealId: deal.id,
    fecha: "2026-10-20",
    monto: "200",
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
    expect(filas[0].saldo).toMatchObject({ moneda: "USD", legible: "USD 600,00" });
    expect(carteraVencidaMcp.salida.safeParse(salida.estructurado).success).toBe(true);
    expect(JSON.stringify(salida.estructurado)).not.toMatch(/"(?:dealId|leadId|ownerUserId|nombreLead|emailLead|fechaLimite|fechaPropia|diasDeAtraso|acuerdoPago|enlaceLead|fechaDeCorte)"\s*:/);
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
      citas: fila.agendas,
      porcentaje_del_total: fila.porcentajeDelTotal,
      porcentaje_de_citas: fila.porcentajeAgenda,
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
