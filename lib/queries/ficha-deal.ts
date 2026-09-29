import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import {
  abonos,
  calls,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  plataformasPago,
  productos,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { fechaLimiteMaxima } from "@/lib/deals/pago";
import { duenosPosibles } from "@/lib/deals/duenos";
import { plataformasDelPrograma } from "@/lib/catalogo/plataformas";
import { saldosDeDeals, type SaldoDeDeal } from "@/lib/queries/saldo";
import { incluyendoAnulados } from "@/lib/queries/vigente";

/**
 * Todo lo de UN deal para su ficha (ticket 074): cabecera, llamadas, abonos, actividades e
 * historial de etapas, en una sola lectura para que el closer trabaje sin navegar.
 *
 * - **El programa es frontera** (ADR 0043): recibe `programId` Y `dealId`, y un deal que no
 *   es de ese programa devuelve `null`, igual que uno inexistente. La ruta lo traduce a 404
 *   sin decir cual de los dos era (no se filtra que el deal existe).
 * - **Lo anulado SE MUESTRA, marcado** (`incluyendoAnulados`, ADR 0026 punto 4): "aqui hubo
 *   un abono que se anulo por tal motivo" es informacion. Pero **ningun total sale de aqui**:
 *   abonado y saldo salen de `saldosDeDeals` (ADR 0024), que solo suma lo vigente.
 * - **Nada de subconsultas correlacionadas** en plantillas `sql` (AGENTS.md): cada cosa se
 *   consulta aparte y se une en memoria; a esta escala (un deal) es gratis.
 */

export interface FichaDeLlamada {
  id: string;
  resultado: (typeof calls.$inferSelect)["resultado"];
  fechaAgenda: Date | null;
  fechaLlamada: Date | null;
  linkCalendly: string | null;
  linkGrain: string | null;
  closerNombre: string | null;
  notas: string | null;
  origen: string;
  anuladoEn: Date | null;
  motivoAnulacion: string | null;
  anuladoPorNombre: string | null;
}

export interface FichaDeAbono {
  id: string;
  fecha: string;
  monto: string;
  moneda: string;
  plataformaNombre: string | null;
  comprobanteUrl: string | null;
  closerId: string | null;
  anuladoEn: Date | null;
  motivoAnulacion: string | null;
  anuladoPorNombre: string | null;
}

export interface FichaDeActividad {
  id: string;
  tipo: "contacto" | "nota";
  canal: string | null;
  fecha: Date;
  nota: string | null;
  /** `null` = la escribio el sistema. */
  autorNombre: string | null;
}

export interface FichaDeMovimiento {
  id: string;
  de: EtapaDeal | null;
  a: EtapaDeal;
  fecha: Date;
  /** `null` = lo movio el sistema. */
  porNombre: string | null;
  motivoNombre: string | null;
}

export interface FichaDeDeal {
  dealId: string;
  programId: string;
  etapa: EtapaDeal;
  lead: {
    id: string;
    nombre: string | null;
    email: string;
    telefono: string | null;
    empresa: string | null;
    cargo: string | null;
    ciudad: string | null;
    pais: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
  };
  owner: { id: string; nombre: string | null } | null;
  producto: { id: string; nombre: string; precio: string; moneda: string } | null;
  cohorte: { id: string; codigo: string; inicioClases: string } | null;
  cohorteDestino: { id: string; codigo: string } | null;
  acuerdoPago: string | null;
  fechaLimitePago: string | null;
  /**
   * El inicio de clases de la cohorte del deal (o de la activa): el TOPE de la fecha limite y
   * la sugerencia con la que se prellena Compromiso Verbal (`fechaLimiteMaxima`, ticket 061).
   * `null` si no hay ninguna cohorte de referencia.
   */
  fechaLimiteSugerida: string | null;
  fechaSeguimiento: string | null;
  motivo: { id: string; nombre: string } | null;
  onboardedAt: Date | null;
  creadoEn: Date;
  anulado: { en: Date; porNombre: string | null; motivo: string } | null;
  /** Abonado y saldo, TAL COMO los da el modulo de saldo (ADR 0024). */
  saldo: SaldoDeDeal;
  llamadas: FichaDeLlamada[];
  abonos: FichaDeAbono[];
  actividades: FichaDeActividad[];
  historial: FichaDeMovimiento[];
}

function fechaDeLlamada(c: { fechaAgenda: Date | null; fechaLlamada: Date | null }): Date | null {
  return c.fechaAgenda ?? c.fechaLlamada;
}

/** La ficha de un deal de ESTE programa, o `null` si no existe o es de otro. */
export async function fichaDeDeal(db: Db, programId: string, dealId: string): Promise<FichaDeDeal | null> {
  // El deal + su lead: joins directos. `incluyendoAnulados`: la ficha de un deal anulado se
  // abre (dice que esta anulado); es una fila por su id, no una metrica.
  const [fila] = await db
    .select({ deal: deals, lead: leads })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.id, dealId), eq(deals.programId, programId), incluyendoAnulados(deals)));
  if (!fila) return null;
  const { deal, lead } = fila;

  const saldo = (await saldosDeDeals(db, [deal.id])).get(deal.id)!;
  const fechaLimiteSugerida = await fechaLimiteMaxima(db, { programId: deal.programId, cohortId: deal.cohortId });

  // Las tablas de apoyo, cada una aparte y unidas en memoria.
  const llamadasFilas = await db
    .select()
    .from(calls)
    .where(and(eq(calls.dealId, deal.id), incluyendoAnulados(calls)));
  const abonosFilas = await db
    .select()
    .from(abonos)
    .where(and(eq(abonos.dealId, deal.id), incluyendoAnulados(abonos)))
    .orderBy(desc(abonos.fecha), desc(abonos.createdAt));
  const actividadesFilas = await db
    .select()
    .from(dealActividades)
    .where(eq(dealActividades.dealId, deal.id))
    .orderBy(desc(dealActividades.fecha));
  const historialFilas = await db
    .select()
    .from(dealEtapaHistorial)
    .where(eq(dealEtapaHistorial.dealId, deal.id))
    .orderBy(asc(dealEtapaHistorial.fecha));

  // Nombres de personas: una sola consulta con todos los ids que aparecen.
  const idsDeUsuarios = new Set<string>();
  const sumar = (id: string | null | undefined) => {
    if (id) idsDeUsuarios.add(id);
  };
  sumar(deal.ownerUserId);
  sumar(deal.anuladoPor);
  llamadasFilas.forEach((c) => (sumar(c.closerUserId), sumar(c.anuladoPor)));
  abonosFilas.forEach((a) => sumar(a.anuladoPor));
  actividadesFilas.forEach((a) => sumar(a.userId));
  historialFilas.forEach((h) => sumar(h.userId));
  const nombres = new Map<string, string | null>();
  if (idsDeUsuarios.size > 0) {
    const us = await db
      .select({ id: users.id, nombre: users.nombre, email: users.email })
      .from(users)
      .where(inArray(users.id, [...idsDeUsuarios]));
    for (const u of us) nombres.set(u.id, u.nombre ?? u.email);
  }
  const nombreDe = (id: string | null | undefined) => (id ? (nombres.get(id) ?? null) : null);

  const [producto] = deal.productoId
    ? await db.select().from(productos).where(eq(productos.id, deal.productoId))
    : [];
  const idsDeCohortes = [deal.cohortId, deal.cohorteDestinoId].filter((x): x is string => x != null);
  const cohortesFilas = idsDeCohortes.length > 0 ? await db.select().from(cohorts).where(inArray(cohorts.id, idsDeCohortes)) : [];
  const cohorteDeId = (id: string | null) => cohortesFilas.find((c) => c.id === id) ?? null;

  const idsDeMotivos = [deal.motivoId, ...historialFilas.map((h) => h.motivoId)].filter((x): x is string => x != null);
  const motivosFilas = idsDeMotivos.length > 0 ? await db.select().from(motivos).where(inArray(motivos.id, idsDeMotivos)) : [];
  const nombreDeMotivo = (id: string | null) => motivosFilas.find((m) => m.id === id)?.nombre ?? null;

  const idsDePlataformas = abonosFilas.map((a) => a.plataformaId).filter((x): x is string => x != null);
  const plataformasFilas =
    idsDePlataformas.length > 0 ? await db.select().from(plataformasPago).where(inArray(plataformasPago.id, idsDePlataformas)) : [];

  const cohorte = cohorteDeId(deal.cohortId);
  const cohorteDestino = cohorteDeId(deal.cohorteDestinoId);

  return {
    dealId: deal.id,
    programId: deal.programId,
    etapa: deal.etapa,
    lead: {
      id: lead.id,
      nombre: lead.nombre,
      email: lead.emailNormalizado,
      telefono: lead.telefono,
      empresa: lead.empresa,
      cargo: lead.cargo,
      ciudad: lead.ciudad,
      pais: lead.pais,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
    },
    owner: deal.ownerUserId ? { id: deal.ownerUserId, nombre: nombreDe(deal.ownerUserId) } : null,
    producto: producto ? { id: producto.id, nombre: producto.nombre, precio: producto.precioLista, moneda: producto.moneda } : null,
    cohorte: cohorte ? { id: cohorte.id, codigo: cohorte.codigo, inicioClases: cohorte.fechaInicioClases } : null,
    cohorteDestino: cohorteDestino ? { id: cohorteDestino.id, codigo: cohorteDestino.codigo } : null,
    acuerdoPago: deal.acuerdoPago,
    fechaLimitePago: deal.fechaLimitePago,
    fechaLimiteSugerida,
    fechaSeguimiento: deal.fechaSeguimiento,
    motivo: deal.motivoId ? { id: deal.motivoId, nombre: nombreDeMotivo(deal.motivoId) ?? "Motivo" } : null,
    onboardedAt: deal.onboardedAt,
    creadoEn: deal.createdAt,
    anulado: deal.anuladoEn
      ? { en: deal.anuladoEn, porNombre: nombreDe(deal.anuladoPor), motivo: deal.motivoAnulacion ?? "" }
      : null,
    saldo,
    llamadas: llamadasFilas
      .map((c) => ({
        id: c.id,
        resultado: c.resultado,
        fechaAgenda: c.fechaAgenda,
        fechaLlamada: c.fechaLlamada,
        linkCalendly: c.linkCalendly,
        linkGrain: c.linkGrain,
        closerNombre: nombreDe(c.closerUserId),
        notas: c.notas,
        origen: c.origen,
        anuladoEn: c.anuladoEn,
        motivoAnulacion: c.motivoAnulacion,
        anuladoPorNombre: nombreDe(c.anuladoPor),
      }))
      // Lo mas reciente primero, por la fecha de la cita (o de la llamada); sin fecha, al final.
      .sort((a, b) => (fechaDeLlamada(b)?.getTime() ?? 0) - (fechaDeLlamada(a)?.getTime() ?? 0)),
    abonos: abonosFilas.map((a) => ({
      id: a.id,
      fecha: a.fecha,
      monto: a.monto,
      moneda: a.moneda,
      plataformaNombre: plataformasFilas.find((p) => p.id === a.plataformaId)?.nombre ?? null,
      comprobanteUrl: a.comprobanteUrl,
      closerId: a.closerId,
      anuladoEn: a.anuladoEn,
      motivoAnulacion: a.motivoAnulacion,
      anuladoPorNombre: nombreDe(a.anuladoPor),
    })),
    actividades: actividadesFilas.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      canal: a.canal,
      fecha: a.fecha,
      nota: a.nota,
      autorNombre: nombreDe(a.userId),
    })),
    historial: historialFilas.map((h) => ({
      id: h.id,
      de: h.de,
      a: h.a,
      fecha: h.fecha,
      porNombre: nombreDe(h.userId),
      motivoNombre: nombreDeMotivo(h.motivoId),
    })),
  };
}

/** Lo que los formularios de la ficha ofrecen, todo acotado al programa del deal. */
export interface OpcionesDeFicha {
  productos: { id: string; nombre: string; moneda: string; precio: string }[];
  /** Cohortes futuras o activas del programa: a donde puede ir un deal (`cambiarCohorte`). */
  cohortes: { id: string; nombre: string }[];
  motivos: { id: string; nombre: string; tipo: string }[];
  plataformas: { id: string; nombre: string }[];
  /** Closers con membresia activa en el programa, mas el dueño actual: para reasignar. */
  owners: { id: string; nombre: string }[];
}

export async function opcionesDeFicha(db: Db, programId: string, ownerActualId: string | null): Promise<OpcionesDeFicha> {
  const productosFilas = await db
    .select()
    .from(productos)
    .where(and(eq(productos.programId, programId), eq(productos.activo, true)));
  const cohortesFilas = await db
    .select()
    .from(cohorts)
    .where(and(eq(cohorts.programId, programId), ne(cohorts.estado, "cerrado")));
  const motivosFilas = await db.select().from(motivos).where(eq(motivos.activo, true));
  const plataformasFilas = await plataformasDelPrograma(db, programId);

  const owners = new Map((await duenosPosibles(db, programId)).map((d) => [d.id, d.nombre] as const));
  // El dueño actual se muestra aunque ya no sea dueño posible (se fue del programa): la
  // pantalla no puede fingir que el deal no tiene el dueño que tiene.
  if (ownerActualId && !owners.has(ownerActualId)) {
    const [o] = await db.select({ id: users.id, nombre: users.nombre, email: users.email }).from(users).where(eq(users.id, ownerActualId));
    if (o) owners.set(o.id, o.nombre ?? o.email);
  }

  return {
    productos: productosFilas
      .map((p) => ({ id: p.id, nombre: p.nombre, moneda: p.moneda, precio: p.precioLista }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    cohortes: cohortesFilas.map((c) => ({ id: c.id, nombre: c.codigo })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    motivos: motivosFilas.map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    plataformas: plataformasFilas.map((p) => ({ id: p.id, nombre: String(p.nombre) })),
    owners: [...owners].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}
