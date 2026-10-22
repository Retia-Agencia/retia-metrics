import { sql, type SQLWrapper } from "drizzle-orm";

type Fecha = SQLWrapper;

export function dimensionesDeFecha(fecha: Fecha) {
  return {
    dia: sql<string>`(${fecha} AT TIME ZONE 'America/Bogota')::date`,
    semana: sql<string>`date_trunc('week', ${fecha} AT TIME ZONE 'America/Bogota')::date`,
    mes: sql<string>`date_trunc('month', ${fecha} AT TIME ZONE 'America/Bogota')::date`,
    hora: sql<string>`to_char(${fecha} AT TIME ZONE 'America/Bogota', 'HH24')`,
  };
}

export function dimensionesDeDate(fecha: Fecha) {
  return {
    dia: sql<string>`${fecha}::date`,
    semana: sql<string>`date_trunc('week', ${fecha}::timestamp)::date`,
    mes: sql<string>`date_trunc('month', ${fecha}::timestamp)::date`,
  };
}
