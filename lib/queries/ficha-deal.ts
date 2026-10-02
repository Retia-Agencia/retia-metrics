import { and, asc, desc, eq, inArray, ne, or } from "drizzle-orm";
import {
  abonos,
  calls,
  changeLog,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leadContactos,
  leads,
  motivos,
  plataformasPago,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { fechaLimiteMaxima } from "@/lib/deals/pago";
import { duenosPosibles } from "@/lib/deals/duenos";
import { esAtendidaSinGrain } from "@/lib/queries/sin-grain";
import { plataformasDelPrograma } from "@/lib/catalogo/plataformas";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { descuentoDeDeal, saldosDeDeals, type DescuentoDeDeal, type SaldoDeDeal } from "@/lib/queries/saldo";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { ETAPAS_VENDIDAS } from "@/lib/queries/metricas-filtros";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { columnasUtmDelEnvio, utmsDelEnvio, type UtmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { enlacesDePagoVigentes, type EnlaceDeLaPantalla } from "@/lib/queries/recursos";

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
  /** Atendida sin Grain (ADR 0066): derivada al leer con `esAtendidaSinGrain`, nunca guardada. */
  sinGrain: boolean;
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
  tipo: "contacto" | "intento" | "nota";
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

interface FichaDeEventoBase {
  id: string;
  fecha: Date;
  porNombre: string | null;
}

export type FichaDeEvento =
  | (FichaDeEventoBase & {
      tipo: "etapa";
      de: EtapaDeal | null;
      a: EtapaDeal;
      motivoNombre: string | null;
    })
  | (FichaDeEventoBase & {
      tipo: "cambio";
      tabla: string;
      accion: "creado" | "editado";
      campos: { campo: string; valorAnterior: string | null; valorNuevo: string | null }[];
    });

function respuestaLegible(valor: unknown): string | null {
  if (valor === null || valor === "") return null;
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (Array.isArray(valor)) {
    const partes = valor.map(respuestaLegible).filter((x): x is string => x !== null);
    return partes.length > 0 ? partes.join(", ") : null;
  }
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/** Convierte las respuestas crudas del formulario sin alterar sus llaves ni su orden. */
export function respuestasLegibles(respuestas: unknown): { pregunta: string; respuesta: string }[] {
  if (respuestas === null || typeof respuestas !== "object" || Array.isArray(respuestas)) return [];
  return Object.entries(respuestas)
    .filter(([pregunta]) => !pregunta.trim().toLowerCase().startsWith("utm_"))
    .map(([pregunta, valor]) => ({ pregunta, respuesta: respuestaLegible(valor) }))
    .filter((x): x is { pregunta: string; respuesta: string } => x.respuesta !== null);
}

export interface FichaDeDeal {
  dealId: string;
  programId: string;
  etapa: EtapaDeal;
  pendiente: PendienteDeal | null;
  lead: {
    id: string;
    nombre: string | null;
    email: string;
    telefono: string | null;
    empresa: string | null;
    cargo: string | null;
    ciudad: string | null;
    pais: string | null;
  };
  /**
   * El origen del deal: los UTM del envio que lo abrio, completos (ADR 0060). `null` = el
   * deal no tiene envio de origen, y la pantalla lo dice en vez de inventar un canal.
   */
  origen: { envioId: string; fecha: Date; calificacion: string | null; utm: UtmsDelEnvio } | null;
  perfil: {
    leadQuality: string | null;
    leadValue: string | null;
    respuestas: { pregunta: string; respuesta: string }[];
  };
  contactos: {
    id: string;
    tipo: "correo" | "telefono";
    valor: string;
    esPrincipal: boolean;
    confirmado: boolean;
  }[];
  owner: { id: string; nombre: string | null } | null;
  valorVendidoUsd: number | null;
  ticket: { cohorteId: string; codigo: string; precioUsd: number; esActivaSugerida: boolean } | null;
  descuento: DescuentoDeDeal | null;
  vendido: boolean;
  areaDeclarada: { id: string; nombre: string } | null;
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
  log: FichaDeEvento[];
  enlacesDePago: EnlaceDeLaPantalla[];
}

function fechaDeLlamada(c: { fechaAgenda: Date | null; fechaLlamada: Date | null }): Date | null {
  return c.fechaAgenda ?? c.fechaLlamada;
}

/** La ficha de un deal de ESTE programa, o `null` si no existe o es de otro. */
export async function fichaDeDeal(db: Db, programId: string, dealId: string): Promise<FichaDeDeal | null> {
  // El deal + su lead: joins directos. `incluyendoAnulados`: la ficha de un deal anulado se
  // abre (dice que esta anulado); es una fila por su id, no una metrica.
  const [fila] = await db
    .select({
      deal: deals,
      lead: leads,
      envioId: submissions.id,
      envioFecha: submissions.createdAt,
      envioCalificacion: submissions.calificacion,
      ...columnasUtmDelEnvio,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
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
  const contactosFilas = await db
    .select()
    .from(leadContactos)
    .where(and(eq(leadContactos.leadId, lead.id), eq(leadContactos.programId, deal.programId)))
    .orderBy(desc(leadContactos.esPrincipal), asc(leadContactos.createdAt));
  const idsRelacionados = [...llamadasFilas, ...abonosFilas, ...actividadesFilas].map((x) => x.id);
  const cambiosFilas = await db
    .select()
    .from(changeLog)
    .where(
      idsRelacionados.length > 0
        ? or(and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, deal.id)), inArray(changeLog.registroId, idsRelacionados))
        : and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, deal.id)),
    )
    .orderBy(desc(changeLog.detectadoEn));
  const enlacesDePago = await enlacesDePagoVigentes({ programId: deal.programId }, db);

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
  cambiosFilas.forEach((c) => sumar(c.userId));
  const nombres = new Map<string, string | null>();
  if (idsDeUsuarios.size > 0) {
    const us = await db
      .select({ id: users.id, nombre: users.nombre, email: users.email })
      .from(users)
      .where(inArray(users.id, [...idsDeUsuarios]));
    for (const u of us) nombres.set(u.id, u.nombre ?? u.email);
  }
  const nombreDe = (id: string | null | undefined) => (id ? (nombres.get(id) ?? null) : null);

  const cambiosAgrupados = new Map<string, Extract<FichaDeEvento, { tipo: "cambio" }>>();
  for (const cambio of cambiosFilas) {
    const clave = [cambio.tabla, cambio.registroId, cambio.detectadoEn.toISOString(), cambio.userId ?? ""].join("\u0000");
    const existente = cambiosAgrupados.get(clave);
    const campo = {
      campo: cambio.campo,
      valorAnterior: cambio.valorAnterior,
      valorNuevo: cambio.valorNuevo,
    };
    if (existente) {
      existente.campos.push(campo);
      if (cambio.valorAnterior !== null) existente.accion = "editado";
    } else {
      cambiosAgrupados.set(clave, {
        id: cambio.id,
        fecha: cambio.detectadoEn,
        tipo: "cambio",
        tabla: cambio.tabla,
        accion: cambio.valorAnterior === null ? "creado" : "editado",
        campos: [campo],
        porNombre: nombreDe(cambio.userId),
      });
    }
  }

  const areaDeclarada = deal.areaDeclaradaId
    ? (await catalogoAreas(db).listar()).find((a) => a.id === deal.areaDeclaradaId) ?? null
    : null;
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
  const activaSugerida = deal.cohortId == null ? await cohorteActiva(deal.programId, db) : null;
  const cohorteDelTicket = cohorte ?? activaSugerida;
  const valorVendidoUsd = deal.valorVendidoUsd == null ? null : Number(deal.valorVendidoUsd);

  return {
    dealId: deal.id,
    programId: deal.programId,
    etapa: deal.etapa,
    pendiente: deal.pendiente,
    lead: {
      id: lead.id,
      nombre: lead.nombre,
      email: lead.emailNormalizado,
      telefono: lead.telefono,
      empresa: lead.empresa,
      cargo: lead.cargo,
      ciudad: lead.ciudad,
      pais: lead.pais,
    },
    origen: deal.submissionOrigenId && fila.envioId && fila.envioFecha
      ? {
          envioId: fila.envioId,
          fecha: fila.envioFecha,
          calificacion: fila.envioCalificacion,
          utm: utmsDelEnvio(fila),
        }
      : null,
    perfil: {
      leadQuality: lead.leadQuality,
      leadValue: lead.leadValue,
      respuestas: respuestasLegibles(fila.respuestas),
    },
    contactos: contactosFilas.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      valor: c.valor,
      esPrincipal: c.esPrincipal,
      confirmado: c.confirmado,
    })),
    owner: deal.ownerUserId ? { id: deal.ownerUserId, nombre: nombreDe(deal.ownerUserId) } : null,
    valorVendidoUsd,
    ticket: cohorteDelTicket
      ? {
          cohorteId: cohorteDelTicket.id,
          codigo: cohorteDelTicket.codigo,
          precioUsd: Number(cohorteDelTicket.precioUsd),
          esActivaSugerida: cohorte == null,
        }
      : null,
    descuento: descuentoDeDeal(cohorte?.precioUsd, valorVendidoUsd),
    vendido: saldo.abonosVigentes > 0 || (ETAPAS_VENDIDAS as readonly string[]).includes(deal.etapa),
    areaDeclarada: areaDeclarada ? { id: areaDeclarada.id, nombre: String(areaDeclarada.nombre) } : null,
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
        sinGrain: esAtendidaSinGrain(c),
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
    log: [
      ...historialFilas.map((h): FichaDeEvento => ({
        id: h.id,
        fecha: h.fecha,
        tipo: "etapa",
        de: h.de,
        a: h.a,
        porNombre: nombreDe(h.userId),
        motivoNombre: nombreDeMotivo(h.motivoId),
      })),
      ...cambiosAgrupados.values(),
    ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()),
    enlacesDePago,
  };
}

/** Lo que los formularios de la ficha ofrecen, todo acotado al programa del deal. */
export interface OpcionesDeFicha {
  areas: { id: string; nombre: string }[];
  /** Cohortes futuras o activas del programa: a donde puede ir un deal (`cambiarCohorte`). */
  cohortes: { id: string; nombre: string }[];
  motivos: { id: string; nombre: string; tipo: string }[];
  plataformas: { id: string; nombre: string }[];
  /** Closers con membresia activa en el programa, mas el dueño actual: para reasignar. */
  owners: { id: string; nombre: string }[];
}

export async function opcionesDeFicha(db: Db, programId: string, ownerActualId: string | null): Promise<OpcionesDeFicha> {
  const cohortesFilas = await db
    .select()
    .from(cohorts)
    .where(and(eq(cohorts.programId, programId), ne(cohorts.estado, "cerrado")));
  const motivosFilas = await db.select().from(motivos).where(eq(motivos.activo, true));
  const plataformasFilas = await plataformasDelPrograma(db, programId);
  const areasFilas = await catalogoAreas(db).listar({ soloActivos: true });

  const owners = new Map((await duenosPosibles(db, programId)).map((d) => [d.id, d.nombre] as const));
  // El dueño actual se muestra aunque ya no sea dueño posible (se fue del programa): la
  // pantalla no puede fingir que el deal no tiene el dueño que tiene.
  if (ownerActualId && !owners.has(ownerActualId)) {
    const [o] = await db.select({ id: users.id, nombre: users.nombre, email: users.email }).from(users).where(eq(users.id, ownerActualId));
    if (o) owners.set(o.id, o.nombre ?? o.email);
  }

  return {
    areas: areasFilas.map((a) => ({ id: a.id, nombre: String(a.nombre) })),
    cohortes: cohortesFilas.map((c) => ({ id: c.id, nombre: c.codigo })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    motivos: motivosFilas.map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    plataformas: plataformasFilas.map((p) => ({ id: p.id, nombre: String(p.nombre) })),
    owners: [...owners].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}
