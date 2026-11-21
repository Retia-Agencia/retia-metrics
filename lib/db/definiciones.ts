import { date, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Las DEFINICIONES de hecho (407 fase 2, decisión de Mani del 21-nov, migración 0160): una vista SQL por hecho en el esquema
 * `crm_definicion`, sin alcance ni enmascarado. Es la ÚNICA definición de qué cuenta como esa fila (vigencia, día de Bogotá,
 * área y canal, universo_paid): la app la lee aquí con su filtro de programa y las vistas de `mcp_lectura` la envuelven con
 * el alcance de la transacción.
 *
 * Son `existing()`: la migración las crea a mano y drizzle-kit no las toca. Una columna nueva se agrega en la migración Y aquí;
 * `tests/mcp-definicion-unica.test.ts` compara cada definición declarada con la base real.
 * El esquema no se exporta: solo las vistas, para que drizzle-kit no quiera crearlo.
 */
const crm = pgSchema("crm_definicion");

const dia = (nombre: string) => date(nombre, { mode: "string" });

export const definicionAgendas = crm.view("agendas", {
  idDeLaLlamada: uuid("id_de_la_llamada").notNull(),
  idDelDeal: uuid("id_del_deal"),
  programaId: uuid("programa_id").notNull(),
  dia: dia("dia").notNull(),
  semana: dia("semana").notNull(),
  mes: dia("mes").notNull(),
  hora: text("hora").notNull(),
  horaMinuto: text("hora_minuto").notNull(),
  area: text("area").notNull(),
  canal: text("canal"),
  cuenta: text("cuenta"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  categoria: text("categoria").notNull(),
  tieneEnvio: text("tiene_envio").notNull(),
  universoPaid: text("universo_paid").notNull(),
  dueno: uuid("dueno"),
  cohorteId: uuid("cohorte_id"),
  etapa: text("etapa"),
  resultado: text("resultado").notNull(),
  creadaEn: timestamp("creada_en", { withTimezone: true, mode: "date" }).notNull(),
}).existing();

export const definicionCitas = crm.view("citas", {
  idDeLaLlamada: uuid("id_de_la_llamada").notNull(),
  idDelDeal: uuid("id_del_deal"),
  programaId: uuid("programa_id").notNull(),
  dia: dia("dia").notNull(),
  semana: dia("semana").notNull(),
  mes: dia("mes").notNull(),
  area: text("area").notNull(),
  canal: text("canal"),
  cuenta: text("cuenta"),
  universoPaid: text("universo_paid").notNull(),
  dueno: uuid("dueno"),
  cohorteId: uuid("cohorte_id"),
  etapa: text("etapa"),
  resultado: text("resultado").notNull(),
  ocurrio: text("ocurrio").notNull(),
}).existing();
