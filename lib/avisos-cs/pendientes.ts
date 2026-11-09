import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { recibeAvisosDeEstudianteNuevo } from "@/lib/auth/roles";
import {
  avisosEstudianteNuevo,
  avisosEstudianteNuevoEnvios,
  cohorts,
  dealEtapaHistorial,
  deals,
  leads,
  miembrosPrograma,
  programs,
  users,
  usuariosWhatsapp,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { rutaDePrograma } from "@/lib/nav";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";
import type { RespuestaEstudiantesNuevos } from "./contrato";
import { textoDeAvisoEstudianteNuevo } from "./texto";

const VENTANA_MS = 48 * 60 * 60 * 1000;

interface DestinatarioElegible {
  programId: string;
  telefono: string;
}

async function destinatariosElegibles(db: Db): Promise<DestinatarioElegible[]> {
  const filas = await db
    .select({
      programId: miembrosPrograma.programId,
      telefono: usuariosWhatsapp.telefono,
      rol: users.rol,
    })
    .from(usuariosWhatsapp)
    .innerJoin(users, eq(users.id, usuariosWhatsapp.userId))
    .innerJoin(miembrosPrograma, eq(miembrosPrograma.userId, users.id))
    .where(and(eq(users.activo, true), eq(miembrosPrograma.activo, true)));
  return filas
    .filter((fila) => recibeAvisosDeEstudianteNuevo(fila.rol))
    .map(({ programId, telefono }) => ({ programId, telefono }));
}

export async function estudiantesNuevosPendientes(
  db: Db,
  input: { origen: string; ahora?: Date },
): Promise<RespuestaEstudiantesNuevos> {
  const ahora = input.ahora ?? new Date();
  const desde = new Date(ahora.getTime() - VENTANA_MS);
  const [avisos, destinatarios] = await Promise.all([
    db
      .select({
        avisoId: avisosEstudianteNuevo.id,
        creadoEn: avisosEstudianteNuevo.creadoEn,
        programId: avisosEstudianteNuevo.programId,
        dealId: deals.id,
        etapa: deals.etapa,
        programa: programs.nombre,
        slug: programs.slug,
        nombre: leads.nombre,
        telefono: leads.telefono,
        correo: leads.emailNormalizado,
        cohorte: cohorts.codigo,
      })
      .from(avisosEstudianteNuevo)
      .innerJoin(deals, eq(deals.id, avisosEstudianteNuevo.dealId))
      .innerJoin(leads, eq(leads.id, deals.leadId))
      .innerJoin(programs, eq(programs.id, avisosEstudianteNuevo.programId))
      .leftJoin(cohorts, and(eq(cohorts.id, deals.cohortId), eq(cohorts.programId, deals.programId)))
      .where(and(gte(avisosEstudianteNuevo.creadoEn, desde), vigente(deals)))
      .orderBy(asc(avisosEstudianteNuevo.creadoEn), asc(avisosEstudianteNuevo.id)),
    destinatariosElegibles(db),
  ]);

  const telefonosCs = [...new Set(destinatarios.map((fila) => fila.telefono))].sort();
  const porPrograma = new Map<string, string[]>();
  for (const destinatario of destinatarios) {
    const lista = porPrograma.get(destinatario.programId) ?? [];
    if (!lista.includes(destinatario.telefono)) lista.push(destinatario.telefono);
    porPrograma.set(destinatario.programId, lista);
  }
  for (const lista of porPrograma.values()) lista.sort();

  const ids = avisos.map((aviso) => aviso.avisoId);
  const dealIds = avisos.map((aviso) => aviso.dealId);
  const [confirmadas, saldos, historiales] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([])
      : db.select({ avisoId: avisosEstudianteNuevoEnvios.avisoId, telefono: avisosEstudianteNuevoEnvios.telefono })
        .from(avisosEstudianteNuevoEnvios)
        .where(inArray(avisosEstudianteNuevoEnvios.avisoId, ids)),
    saldosDeDeals(db, dealIds),
    dealIds.length === 0
      ? Promise.resolve([])
      : db.select({ dealId: dealEtapaHistorial.dealId, a: dealEtapaHistorial.a, fecha: dealEtapaHistorial.fecha, id: dealEtapaHistorial.id })
        .from(dealEtapaHistorial)
        .where(inArray(dealEtapaHistorial.dealId, dealIds))
        .orderBy(asc(dealEtapaHistorial.fecha), asc(dealEtapaHistorial.id)),
  ]);
  const yaConfirmadas = new Set(confirmadas.map((fila) => `${fila.avisoId}:${fila.telefono}`));
  const primeraVenta = new Map<string, "ganado_parcial" | "ganado_completo">();
  for (const fila of historiales) {
    if (!primeraVenta.has(fila.dealId) && (fila.a === "ganado_parcial" || fila.a === "ganado_completo")) {
      primeraVenta.set(fila.dealId, fila.a);
    }
  }

  let sinDestinatario = 0;
  const entregas: RespuestaEstudiantesNuevos["entregas"] = [];
  for (const aviso of avisos) {
    const telefonos = porPrograma.get(aviso.programId) ?? [];
    if (telefonos.length === 0) sinDestinatario += 1;
    const saldo = saldos.get(aviso.dealId);
    const etapa = primeraVenta.get(aviso.dealId)
      ?? (aviso.etapa === "ganado_completo" ? "ganado_completo" : "ganado_parcial");
    const texto = textoDeAvisoEstudianteNuevo({
      programa: aviso.programa,
      nombre: aviso.nombre,
      telefono: aviso.telefono,
      correo: aviso.correo,
      cohorte: aviso.cohorte,
      etapa,
      abonado: saldo?.sinSaldoPorque === "moneda_distinta" ? null : saldo?.abonado ?? 0,
      moneda: saldo?.moneda ?? "USD",
      enlace: `${input.origen}${rutaDePrograma(encodeURIComponent(aviso.slug), "deals")}/${aviso.dealId}`,
    });
    for (const telefono of telefonos) {
      if (!yaConfirmadas.has(`${aviso.avisoId}:${telefono}`)) {
        entregas.push({ avisoId: aviso.avisoId, telefono, texto });
      }
    }
  }
  return { entregas, sinDestinatario, telefonosCs };
}

export async function confirmarEstudiantesNuevos(
  db: Db,
  entregas: readonly { avisoId: string; telefono: string }[],
  ahora = new Date(),
): Promise<number> {
  if (entregas.length === 0) return 0;
  const elegibles = await estudiantesNuevosPendientes(db, { origen: "", ahora });
  const permitidas = new Set(elegibles.entregas.map((fila) => `${fila.avisoId}:${fila.telefono}`));
  const unicas = [...new Map(
    entregas
      .filter((fila) => permitidas.has(`${fila.avisoId}:${fila.telefono}`))
      .map((fila) => [`${fila.avisoId}:${fila.telefono}`, fila]),
  ).values()];
  if (unicas.length === 0) return 0;
  const insertadas = await db
    .insert(avisosEstudianteNuevoEnvios)
    .values(unicas)
    .onConflictDoNothing({
      target: [avisosEstudianteNuevoEnvios.avisoId, avisosEstudianteNuevoEnvios.telefono],
    })
    .returning();
  return insertadas.length;
}
