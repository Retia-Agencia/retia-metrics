import { sql, type SQLWrapper } from "drizzle-orm";
import { deals, submissions } from "@/lib/db/schema";

type Fecha = SQLWrapper;
type EnvioFechado = { fechaEnvio: SQLWrapper; createdAt: SQLWrapper };

export function diaEnBogota(fecha: Fecha) {
  return sql<string>`(${fecha} AT TIME ZONE 'America/Bogota')::date`;
}

export function horaMinutoEnBogota(fecha: Fecha) {
  return sql<string>`to_char(${fecha} AT TIME ZONE 'America/Bogota', 'HH24:MI')`;
}

export function inicioDelDiaEnBogota(fecha: Fecha) {
  return sql<Date>`${fecha}::timestamp AT TIME ZONE 'America/Bogota'`;
}

export function anclaEnvio(envio: EnvioFechado = submissions) {
  return sql<Date>`coalesce(${envio.fechaEnvio}, ${envio.createdAt})`;
}

export function diaDeEnvio(envio: EnvioFechado = submissions) {
  return diaEnBogota(anclaEnvio(envio));
}

/** El envio de origen abre el deal; si no existe, lo abre el alta directa en el CRM. */
export function diaDeCreacionDelDeal() {
  return diaEnBogota(sql<Date>`coalesce(${anclaEnvio()}, ${deals.createdAt})`);
}

export function dimensionesDeFecha(fecha: Fecha) {
  const fechaEnBogota = sql`${fecha} AT TIME ZONE 'America/Bogota'`;
  return {
    dia: sql<string>`(${fechaEnBogota})::date`,
    semana: sql<string>`date_trunc('week', ${fechaEnBogota})::date`,
    mes: sql<string>`date_trunc('month', ${fechaEnBogota})::date`,
    hora: sql<string>`to_char(${fechaEnBogota}, 'HH24')`,
  };
}

export function dimensionesDeDate(fecha: Fecha) {
  return {
    dia: sql<string>`${fecha}::date`,
    semana: sql<string>`date_trunc('week', ${fecha}::timestamp)::date`,
    mes: sql<string>`date_trunc('month', ${fecha}::timestamp)::date`,
  };
}
