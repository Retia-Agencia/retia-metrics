import { and, asc, eq } from "drizzle-orm";
import {
  avisosPendientesCloserEnvios,
  users,
  usuariosWhatsapp,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { programasVisibles } from "@/lib/auth/alcance";
import { diaDeCalendario, esDiaHabil } from "@/lib/dias-habiles";
import { hoyEnBogota } from "@/lib/format";
import {
  notificacionesCompletasDeChip,
  type ChipNotificacion,
  type NotificacionCompleta,
} from "@/lib/mi-espacio/notificaciones";
import type { RespuestaAvisosPendientes, VentanaPendientes } from "./contrato";
import {
  ORDEN_PENDIENTES,
  textoDePendientesDeCloser,
  type DealConPendientes,
  type PendienteDeDeal,
  type TipoPendienteCloser,
} from "./texto";

const CHIPS_DE_AVISO = ["sin_resultado", "sin_comprobante", "sin_grain", "reagenda", "vencidos", "nuevos"] as const satisfies readonly ChipNotificacion[];

/**
 * Un aviso es para actuar hoy: sin_grain, reagenda y nuevos de hace más de este número de días
 * son atraso acumulado y se quedan en el CRM (el 14-nov un closer habría recibido "te faltan 2.417").
 * Los vencidos (dinero y compromisos) y las citas sin resultado tienen su propia regla.
 */
export const DIAS_MAXIMOS_DE_AVISO = 7;
const CHIPS_CON_TOPE_DE_ANTIGUEDAD: readonly (typeof CHIPS_DE_AVISO)[number][] = ["sin_grain", "reagenda", "nuevos"];

interface ProgramaDelCloser {
  id: string;
  nombre: string;
  slug: string;
}

interface CloserElegible {
  userId: string;
  nombre: string;
  telefonos: string[];
  programas: ProgramaDelCloser[];
}

interface CitasAntiguasDePrograma {
  programa: string;
  programSlug: string;
  cantidad: number;
}

function fechaDeNotificacion(n: NotificacionCompleta): Date {
  if (n.fechaClave instanceof Date) return n.fechaClave;
  if (typeof n.fechaClave === "string") return new Date(`${n.fechaClave}T12:00:00-05:00`);
  return n.tarjeta.creadoEn;
}

function detalleVencido(n: NotificacionCompleta): PendienteDeDeal["detalle"] {
  if (n.tarjeta.avisos.seguimientoVencido) return "seguimiento";
  if (n.tarjeta.avisos.compromisoVencido) return "compromiso";
  return "cartera";
}

function pendienteDe(chip: typeof CHIPS_DE_AVISO[number], n: NotificacionCompleta): PendienteDeDeal {
  return {
    tipo: chip as TipoPendienteCloser,
    fecha: n.fechaClave,
    ...(chip === "vencidos" ? { detalle: detalleVencido(n) } : {}),
  };
}

async function closersElegibles(db: Db): Promise<CloserElegible[]> {
  const [cuentas, telefonos] = await Promise.all([
    db.select({
      userId: users.id,
      nombre: users.nombre,
      email: users.email,
    })
      .from(users)
      .where(and(eq(users.activo, true), eq(users.rol, "closer")))
      .orderBy(asc(users.id)),
    db.select({ userId: usuariosWhatsapp.userId, telefono: usuariosWhatsapp.telefono })
      .from(usuariosWhatsapp)
      .orderBy(asc(usuariosWhatsapp.telefono)),
  ]);
  const telefonosPorUsuario = new Map<string, string[]>();
  for (const fila of telefonos) {
    const lista = telefonosPorUsuario.get(fila.userId) ?? [];
    lista.push(fila.telefono);
    telefonosPorUsuario.set(fila.userId, lista);
  }
  const closers = await Promise.all(cuentas.map(async (cuenta) => ({
    userId: cuenta.userId,
    nombre: cuenta.nombre ?? cuenta.email,
    telefonos: telefonosPorUsuario.get(cuenta.userId) ?? [],
    programas: await programasVisibles(cuenta.userId, "closer", db),
  })));
  return closers.filter((closer) => closer.programas.length > 0);
}

async function pendientesDelCloser(
  db: Db,
  closer: CloserElegible,
  ventana: VentanaPendientes,
  dia: string,
  ahora: Date,
  origen: string,
): Promise<{ deals: DealConPendientes[]; citasAntiguas: CitasAntiguasDePrograma[] }> {
  const porDeal = new Map<string, DealConPendientes>();
  const citasAntiguasPorPrograma = new Map<string, CitasAntiguasDePrograma>();
  for (const programa of closer.programas) {
    for (const chip of CHIPS_DE_AVISO) {
      const notificaciones = await notificacionesCompletasDeChip(
        db,
        { programId: programa.id, userId: closer.userId, chip },
        dia,
        ahora,
      );
      for (const notificacion of notificaciones) {
        // Un deal perdido no tiene nada que registrar: un aviso sobre él es ruido.
        if (notificacion.tarjeta.etapa === "cierre_perdido") continue;
        const fecha = fechaDeNotificacion(notificacion);
        const antiguedad = Math.floor((new Date(`${dia}T12:00:00-05:00`).getTime() - fecha.getTime()) / 86_400_000);
        if (CHIPS_CON_TOPE_DE_ANTIGUEDAD.includes(chip) && antiguedad > DIAS_MAXIMOS_DE_AVISO) continue;
        if (chip === "sin_resultado" && antiguedad > 7) {
          if (ventana === "manana") {
            const actual = citasAntiguasPorPrograma.get(programa.slug);
            citasAntiguasPorPrograma.set(programa.slug, {
              programa: programa.nombre,
              programSlug: programa.slug,
              cantidad: (actual?.cantidad ?? 0) + 1,
            });
          }
          continue;
        }
        if (ventana === "tarde" && (chip !== "sin_resultado" && chip !== "sin_grain" || diaDeCalendario(fecha) !== dia)) {
          continue;
        }
        const actual = porDeal.get(notificacion.tarjeta.dealId) ?? {
          dealId: notificacion.tarjeta.dealId,
          nombreLead: notificacion.tarjeta.nombreLead ?? "Sin nombre",
          programa: programa.nombre,
          programSlug: programa.slug,
          url: `${origen}/p/${programa.slug}/deals/${notificacion.tarjeta.dealId}`,
          fechaUrgencia: fecha,
          pendientes: [],
        };
        actual.fechaUrgencia = actual.fechaUrgencia < fecha ? actual.fechaUrgencia : fecha;
        actual.pendientes.push(pendienteDe(chip, notificacion));
        porDeal.set(actual.dealId, actual);
      }
    }
  }
  const deals = [...porDeal.values()].sort((a, b) => a.fechaUrgencia.getTime() - b.fechaUrgencia.getTime() || a.dealId.localeCompare(b.dealId));
  return { deals, citasAntiguas: [...citasAntiguasPorPrograma.values()] };
}

/** Chip con más pendientes por programa; la prioridad desempata cantidades (ticket 428). */
function enlacesDePendientes(
  origen: string,
  ventana: VentanaPendientes,
  deals: DealConPendientes[],
  citasAntiguas: CitasAntiguasDePrograma[],
): { programa: string; url: string }[] {
  const porPrograma = new Map<string, { programa: string; conteos: Record<TipoPendienteCloser, number> }>();
  const obtener = (slug: string, programa: string) => {
    const actual = porPrograma.get(slug);
    if (actual) return actual;
    const creado = {
      programa,
      conteos: Object.fromEntries(ORDEN_PENDIENTES.map((tipo) => [tipo, 0])) as Record<TipoPendienteCloser, number>,
    };
    porPrograma.set(slug, creado);
    return creado;
  };
  for (const deal of deals) {
    const programa = obtener(deal.programSlug, deal.programa);
    for (const pendiente of deal.pendientes) programa.conteos[pendiente.tipo] += 1;
  }
  for (const cita of citasAntiguas) {
    obtener(cita.programSlug, cita.programa).conteos.sin_resultado += cita.cantidad;
  }
  return [...porPrograma.entries()].map(([slug, programa]) => {
    let chip: TipoPendienteCloser;
    if (ventana === "tarde") {
      chip = programa.conteos.sin_resultado > 0 ? "sin_resultado" : "sin_grain";
    } else {
      chip = ORDEN_PENDIENTES[0];
      for (const tipo of ORDEN_PENDIENTES) {
        if (programa.conteos[tipo] > programa.conteos[chip]) chip = tipo;
      }
    }
    return {
      programa: programa.programa,
      url: `${origen}/mi-espacio?tab=notificaciones&programa=${encodeURIComponent(slug)}&chip=${chip}`,
    };
  });
}

export async function avisosPendientesDeClosers(
  db: Db,
  input: { ventana: VentanaPendientes; origen: string; ahora?: Date },
): Promise<RespuestaAvisosPendientes> {
  const ahora = input.ahora ?? new Date();
  const dia = hoyEnBogota();
  if (!esDiaHabil(dia)) return { avisos: [], sinDestinatario: [] };

  const [closers, enviados] = await Promise.all([
    closersElegibles(db),
    db.select({ userId: avisosPendientesCloserEnvios.userId })
      .from(avisosPendientesCloserEnvios)
      .where(and(eq(avisosPendientesCloserEnvios.dia, dia), eq(avisosPendientesCloserEnvios.ventana, input.ventana))),
  ]);
  const yaEnviados = new Set(enviados.map((fila) => fila.userId));
  const respuesta: RespuestaAvisosPendientes = { avisos: [], sinDestinatario: [] };
  for (const closer of closers) {
    if (yaEnviados.has(closer.userId)) continue;
    const pendientes = await pendientesDelCloser(db, closer, input.ventana, dia, ahora, input.origen);
    if (pendientes.deals.length === 0 && pendientes.citasAntiguas.length === 0) continue;
    if (closer.telefonos.length === 0) {
      respuesta.sinDestinatario.push(closer.userId);
      continue;
    }
    const enlaces = enlacesDePendientes(input.origen, input.ventana, pendientes.deals, pendientes.citasAntiguas);
    const texto = textoDePendientesDeCloser({
      nombreCloser: closer.nombre,
      ventana: input.ventana,
      deals: pendientes.deals,
      citasAntiguas: pendientes.citasAntiguas.reduce((total, grupo) => total + grupo.cantidad, 0),
      enlaces,
    });
    for (const telefono of closer.telefonos) {
      respuesta.avisos.push({ userId: closer.userId, telefono, ventana: input.ventana, dia, texto });
    }
  }
  respuesta.sinDestinatario.sort();
  return respuesta;
}
