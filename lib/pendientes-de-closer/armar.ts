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
import { nombreDeEtapa } from "@/lib/queries/vista-metrica";
import type { RespuestaAvisosPendientes, VentanaPendientes } from "./contrato";
import {
  textoDePendientesDeCloser,
  type DealConPendientes,
  type PendienteDeDeal,
  type TipoPendienteCloser,
} from "./texto";

const CHIPS_DE_AVISO = ["sin_resultado", "sin_grain", "reagenda", "vencidos", "nuevos"] as const satisfies readonly ChipNotificacion[];

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
): Promise<{ deals: DealConPendientes[]; citasAntiguas: number }> {
  const porDeal = new Map<string, DealConPendientes>();
  let citasAntiguas = 0;
  for (const programa of closer.programas) {
    for (const chip of CHIPS_DE_AVISO) {
      const notificaciones = await notificacionesCompletasDeChip(
        db,
        { programId: programa.id, userId: closer.userId, chip },
        dia,
        ahora,
      );
      for (const notificacion of notificaciones) {
        const fecha = fechaDeNotificacion(notificacion);
        const antiguedad = Math.floor((new Date(`${dia}T12:00:00-05:00`).getTime() - fecha.getTime()) / 86_400_000);
        if (chip === "sin_resultado" && antiguedad > 7) {
          if (ventana === "manana") citasAntiguas += 1;
          continue;
        }
        if (ventana === "tarde" && (chip !== "sin_resultado" && chip !== "sin_grain" || diaDeCalendario(fecha) !== dia)) {
          continue;
        }
        const actual = porDeal.get(notificacion.tarjeta.dealId) ?? {
          dealId: notificacion.tarjeta.dealId,
          nombreLead: notificacion.tarjeta.nombreLead ?? "Sin nombre",
          programa: programa.nombre,
          etapa: nombreDeEtapa(notificacion.tarjeta.etapa),
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
  return { deals, citasAntiguas };
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
    const pendientes = await pendientesDelCloser(db, closer, input.ventana, dia, ahora);
    if (pendientes.deals.length === 0 && pendientes.citasAntiguas === 0) continue;
    if (closer.telefonos.length === 0) {
      respuesta.sinDestinatario.push(closer.userId);
      continue;
    }
    const enlace = `${input.origen}/mi-espacio?tab=notificaciones&chip=sin_resultado`;
    const texto = textoDePendientesDeCloser({
      nombreCloser: closer.nombre,
      ventana: input.ventana,
      dia,
      deals: pendientes.deals,
      citasAntiguas: pendientes.citasAntiguas,
      enlace,
    });
    for (const telefono of closer.telefonos) {
      respuesta.avisos.push({ userId: closer.userId, telefono, ventana: input.ventana, dia, texto });
    }
  }
  respuesta.sinDestinatario.sort();
  return respuesta;
}
