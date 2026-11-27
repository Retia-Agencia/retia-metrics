/** Clasificación y reclamo seguro, por lotes, de los deals identificados en un CSV. */
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { esAdministrador, trabajaLeads } from "@/lib/auth/roles";
import { deals, leadContactos, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { resolverIdentidad, type ContactoConocido } from "@/lib/ingesta/identidad";
import { vigente } from "@/lib/queries/vigente";
import { ETAPAS_DE_SETTEO, NOMBRE_DE_ETAPA } from "./etapas";
import { esDuenoPosible } from "./duenos";
import type { ActorDeDeal } from "./permiso";
import { reclamarDeal } from "./reclamar";
import type { FilaDeReclamo, ResultadoFilaReclamo } from "./csv-reclamo";

const MAX_LOTE = 500;
type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

function exigirLote(longitud: number): void {
  if (longitud > MAX_LOTE) throw new ErrorDeApp(`Cada lote puede tener máximo ${MAX_LOTE} filas.`, 400);
}

export async function clasificarFilasDeReclamo(
  db: Db,
  actor: ActorDeDeal,
  programId: string,
  filas: readonly FilaDeReclamo[],
): Promise<ResultadoFilaReclamo[]> {
  exigirLote(filas.length);
  const correos = [...new Set(filas.flatMap((fila) => fila.correo ? [fila.correo] : []))];
  const telefonos = [...new Set(filas.flatMap((fila) => fila.telefono ? [fila.telefono] : []))];
  const valores = [...new Set([...correos, ...telefonos])];
  const principales = correos.length === 0 ? [] : await db
    .select({ leadId: leads.id, valor: leads.emailNormalizado })
    .from(leads)
    .where(and(eq(leads.programId, programId), inArray(leads.emailNormalizado, correos)));
  const contactos = valores.length === 0 ? [] : await db
    .select({ leadId: leadContactos.leadId, tipo: leadContactos.tipo, valor: leadContactos.valor, confirmado: leadContactos.confirmado })
    .from(leadContactos)
    .where(and(
      eq(leadContactos.programId, programId),
      inArray(leadContactos.valor, valores),
      or(eq(leadContactos.tipo, "correo"), eq(leadContactos.tipo, "telefono")),
    ));
  const conocidos: ContactoConocido[] = [
    ...principales.map((fila) => ({ ...fila, tipo: "correo" as const, confirmado: true })),
    ...contactos,
  ];

  const ultimosDiez = [...new Set(telefonos.filter((telefono) => telefono.length >= 10).map((telefono) => telefono.slice(-10)))];
  // ponytail: este fallback vive solo en Reclamar desde CSV; si otro flujo lo necesita,
  // se sube a lib/ingesta para que haya una sola definición compartida.
  const contactosPorSufijo = ultimosDiez.length === 0 ? [] : await db
    .select({ leadId: leadContactos.leadId, sufijo: sql<string>`right(${leadContactos.valor}, 10)` })
    .from(leadContactos)
    .where(and(
      eq(leadContactos.programId, programId),
      eq(leadContactos.tipo, "telefono"),
      inArray(sql<string>`right(${leadContactos.valor}, 10)`, ultimosDiez),
    ));
  const porSufijo = new Map<string, Set<string>>();
  for (const contacto of contactosPorSufijo) {
    const ids = porSufijo.get(contacto.sufijo) ?? new Set<string>();
    ids.add(contacto.leadId);
    porSufijo.set(contacto.sufijo, ids);
  }

  const identidades = filas.map((fila) => {
    if (!fila.correo && !fila.telefono) return { leadId: null, detalle: null, ambiguo: false };
    const propios = conocidos.filter((contacto) =>
      (contacto.tipo === "correo" && contacto.valor === fila.correo)
      || (contacto.tipo === "telefono" && contacto.valor === fila.telefono));
    const identidad = resolverIdentidad([
      { token: String(fila.fila), posicion: fila.fila, correo: fila.correo, telefono: fila.telefono },
    ], propios);
    const asignacion = identidad.asignaciones[0];
    if (asignacion?.lead?.tipo === "existente" && (asignacion.motivo === "correo" || asignacion.motivo === "telefono")) {
      const choque = identidad.posiblesDuplicados.some((duplicado) => duplicado.motivo === "telefono_de_otro_lead");
      return {
        leadId: asignacion.lead.leadId,
        detalle: choque ? "Coincidió por correo; el celular pertenece a otro lead." : `Coincidió por ${asignacion.motivo === "correo" ? "correo" : "celular"}.`,
        ambiguo: false,
      };
    }
    if (fila.telefono && fila.telefono.length >= 10) {
      const ids = [...(porSufijo.get(fila.telefono.slice(-10)) ?? [])];
      if (ids.length === 1) return { leadId: ids[0], detalle: "Coincidió por los últimos 10 dígitos del celular.", ambiguo: false };
      if (ids.length > 1) return { leadId: null, detalle: "Más de una persona comparte los últimos 10 dígitos del celular.", ambiguo: true };
    }
    return { leadId: null, detalle: null, ambiguo: false };
  });

  const leadIds = [...new Set(identidades.flatMap((identidad) => identidad.leadId ? [identidad.leadId] : []))];
  const abiertos = leadIds.length === 0 ? [] : await db
    .select({ id: deals.id, leadId: deals.leadId, etapa: deals.etapa, ownerUserId: deals.ownerUserId, ownerNombre: users.nombre })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(
      eq(deals.programId, programId),
      inArray(deals.leadId, leadIds),
      notInArray(deals.etapa, ["ganado_completo", "cierre_perdido"]),
      vigente(deals),
    ));
  const porLead = new Map(abiertos.map((deal) => [deal.leadId, deal]));

  return filas.map((fila, indice) => {
    const base = { fila: fila.fila, correoOriginal: fila.correoOriginal, telefonoOriginal: fila.telefonoOriginal };
    const identidad = identidades[indice];
    if (!fila.correo && !fila.telefono) return { ...base, categoria: "invalida", dealId: null, detalle: "No tiene correo ni celular válidos." };
    if (identidad.ambiguo) return { ...base, categoria: "ambiguo", dealId: null, detalle: identidad.detalle ?? "La identidad es ambigua." };
    if (!identidad.leadId) return { ...base, categoria: "no_esta", dealId: null, detalle: "No encontramos a esta persona en el programa." };
    const deal = porLead.get(identidad.leadId);
    if (!deal) return { ...base, categoria: "sin_deal_abierto", dealId: null, detalle: "La persona no tiene un deal abierto en el programa." };
    if (deal.ownerUserId === actor.userId) return { ...base, categoria: "ya_es_tuyo", dealId: null, detalle: "Este deal ya está asignado a ti." };
    if (deal.ownerUserId) {
      const detalle = esAdministrador(actor.rol) && deal.ownerNombre
        ? `Lo tiene ${deal.ownerNombre}.`
        : "Lo tiene otro closer.";
      return { ...base, categoria: "de_otro", dealId: null, detalle };
    }
    if (!ETAPAS_DE_SETTEO.includes(deal.etapa)) {
      return { ...base, categoria: "sin_dueno_fuera_de_setteo", dealId: null, detalle: `Está en ${NOMBRE_DE_ETAPA[deal.etapa]}.` };
    }
    return { ...base, categoria: "reclamable", dealId: deal.id, detalle: identidad.detalle ?? "Lista para reclamar." };
  });
}

export async function reclamarDealsDeCsv(
  db: Db,
  actor: ActorDeDeal,
  programId: string,
  dealIds: readonly string[],
): Promise<{ reclamados: string[]; saltados: string[] }> {
  exigirLote(dealIds.length);
  if (!trabajaLeads(actor)) throw new ErrorDeApp("Reclamar un deal es de quien trabaja leads, no de quien administra.", 403);
  if (!(await esDuenoPosible(db, programId, actor.userId))) {
    throw new ErrorDeApp("Para reclamar deals tienes que tener membresía activa en su programa.", 403);
  }
  if (dealIds.length === 0) return { reclamados: [], saltados: [] };

  return (db as unknown as Transaccion).transaction(async (tx) => {
    const reclamados: string[] = [];
    const saltados: string[] = [];
    for (const dealId of dealIds) {
      const [actual] = await tx.select({
        programId: deals.programId,
        etapa: deals.etapa,
        ownerUserId: deals.ownerUserId,
      }).from(deals).where(and(eq(deals.id, dealId), vigente(deals))).for("update");
      if (
        !actual
        || actual.programId !== programId
        || actual.ownerUserId !== null
        || !ETAPAS_DE_SETTEO.includes(actual.etapa)
      ) {
        saltados.push(dealId);
        continue;
      }
      try {
        await reclamarDeal(tx, actor, { dealId });
        reclamados.push(dealId);
      } catch (error) {
        if (error instanceof ErrorDeApp && error.status === 409) {
          saltados.push(dealId);
          continue;
        }
        throw error;
      }
    }
    return { reclamados, saltados };
  });
}
