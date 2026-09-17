import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  numeric,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Modelo de datos de Retia Metrics.
 *
 * Regla que atraviesa todo el esquema: **toda tasa se calcula sobre personas,
 * nunca sobre filas**. Por eso `people` tiene un unico registro por correo
 * normalizado y guarda `numAplicaciones` como senal, no como filas separadas.
 */

// ─────────────────────────────────────────────────────────── enums

export const rolEnum = pgEnum("rol", ["gerente", "closer"]);

export const estadoPersonaEnum = pgEnum("estado_persona", [
  "descartado",
  "cola_setteo",
  "invitado",
  "show",
  "cierre",
  "perdido",
]);

export const resultadoLlamadaEnum = pgEnum("resultado_llamada", [
  "agendada",
  "show",
  "no_show",
  "reagendada",
  "cerrada",
  "perdida",
]);

export const estadoCohorteEnum = pgEnum("estado_cohorte", ["cerrado", "activo", "futuro"]);
export const tipoFuenteEnum = pgEnum("tipo_fuente", ["google_sheet", "upload"]);
export const estadoSyncEnum = pgEnum("estado_sync", ["corriendo", "ok", "error"]);
export const origenCambioEnum = pgEnum("origen_cambio", ["sync", "app", "upload"]);

// ─────────────────────────────────────────────────────────── usuarios

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  nombre: text("nombre"),
  rol: rolEnum("rol").notNull().default("closer"),
  /** Identificador con el que este closer aparece en la BBDD de Google Sheets. */
  closerId: text("closer_id"),
  /** Correo de la cuenta de Calendly del closer, para cruzar sus agendamientos. */
  calendlyEmail: text("calendly_email"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * En que programas vende cada usuario (ticket 015). Un closer cuenta en las
 * metricas de un programa solo si tiene una membresia activa ahi.
 *
 * Como todo lo del molde de catalogo (ADR 0012): nunca se borra una fila, se
 * desactiva (`activo = false`), y cada cambio va a `change_log`. El indice unico
 * por par `(userId, programId)` deja reactivar la misma membresia en vez de
 * duplicarla.
 */
export const miembrosPrograma = pgTable(
  "miembros_programa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("miembros_programa_par_idx").on(t.userId, t.programId)],
);

// ─────────────────────────────────────────────────────────── programas y cohortes

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nombre: text("nombre").notNull(),
  ticketUsd: numeric("ticket_usd", { precision: 10, scale: 2 }).notNull(),
  /** Maximo historico de personas por dia habil. Marca cuando una meta es inalcanzable por volumen. */
  recordPersonasPorDiaHabil: integer("record_personas_por_dia_habil"),
  activo: boolean("activo").notNull().default(true),
});

export const cohorts = pgTable(
  "cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    metaCupos: integer("meta_cupos").notNull(),
    precioUsd: numeric("precio_usd", { precision: 10, scale: 2 }).notNull(),
    fechaInicioClases: date("fecha_inicio_clases").notNull(),
    /** Cada cohorte se vende hasta el mismo dia en que arranca clases, inclusive. */
    fechaCierreVentas: date("fecha_cierre_ventas").notNull(),
    /** Editable por cohorte. Los links de pago se generan manualmente segun la TRM del momento. */
    trmCohorte: numeric("trm_cohorte", { precision: 10, scale: 2 }).notNull().default("4000"),
    estado: estadoCohorteEnum("estado").notNull().default("futuro"),
    notas: text("notas"),
  },
  (t) => [uniqueIndex("cohorts_programa_codigo_idx").on(t.programId, t.codigo)],
);

// ─────────────────────────────────────────────────────────── fuentes de datos

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  tipo: tipoFuenteEnum("tipo").notNull().default("google_sheet"),
  sheetId: text("sheet_id"),
  tab: text("tab"),
  rango: text("rango").notNull().default("A1:BZ"),
  /**
   * Que columna de la hoja alimenta que campo. Configurable a proposito:
   * si el mapeo no cuadra con los encabezados reales, el sync falla ruidosamente
   * en vez de adivinar.
   */
  mapeoColumnas: jsonb("mapeo_columnas").notNull().default({}),
  /** Que alimenta esta fuente: personas, llamadas, ventas o pauta. */
  destino: text("destino").notNull().default("people"),
  ultimaSync: timestamp("ultima_sync", { withTimezone: true }),
  activo: boolean("activo").notNull().default(true),
  orden: integer("orden").notNull().default(0),
});

// ─────────────────────────────────────────────────────────── personas

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    /** Correo en minusculas y sin espacios. Es la llave del dedup. */
    emailNormalizado: text("email_normalizado").notNull(),
    nombre: text("nombre"),
    telefono: text("telefono"),
    cargo: text("cargo"),
    empresa: text("empresa"),
    ciudad: text("ciudad"),
    pais: text("pais"),
    ingresoDeclarado: text("ingreso_declarado"),
    urgencia: text("urgencia"),
    porQueAplico: text("por_que_aplico"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    fechaPrimeraAplicacion: timestamp("fecha_primera_aplicacion", { withTimezone: true }),
    fechaUltimaAplicacion: timestamp("fecha_ultima_aplicacion", { withTimezone: true }),
    /** Cuantas veces aplico la misma persona. Senal de intensidad, no personas distintas. */
    numAplicaciones: integer("num_aplicaciones").notNull().default(1),
    estado: estadoPersonaEnum("estado").notNull().default("cola_setteo"),
    motivoDescarte: text("motivo_descarte"),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
    /** Fila original tal como vino de la hoja, para auditar sin volver a Sheets. */
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("people_programa_email_idx").on(t.programId, t.emailNormalizado),
    index("people_programa_estado_idx").on(t.programId, t.estado),
    index("people_cohorte_idx").on(t.cohortId),
  ],
);

// ─────────────────────────────────────────────────────────── llamadas

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    /** Nombre del closer tal como aparece en la hoja. Se cruza contra users.closerId. */
    closerId: text("closer_id"),
    emailLead: text("email_lead"),
    fechaAgenda: timestamp("fecha_agenda", { withTimezone: true }),
    fechaLlamada: timestamp("fecha_llamada", { withTimezone: true }),
    resultado: resultadoLlamadaEnum("resultado").notNull().default("agendada"),
    motivoPerdida: text("motivo_perdida"),
    notas: text("notas"),
    origen: text("origen").notNull().default("sheets"),
    /** Huella de la fila de origen, para no duplicar en cada sync. */
    huellaFila: text("huella_fila"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("calls_cohorte_closer_idx").on(t.cohortId, t.closerId),
    index("calls_persona_idx").on(t.personId),
    uniqueIndex("calls_huella_idx").on(t.programId, t.huellaFila),
  ],
);

// ─────────────────────────────────────────────────────────── ventas

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    closerId: text("closer_id"),
    emailComprador: text("email_comprador"),
    fecha: date("fecha"),
    precioListaUsd: numeric("precio_lista_usd", { precision: 10, scale: 2 }),
    precioAplicadoUsd: numeric("precio_aplicado_usd", { precision: 10, scale: 2 }),
    becaAplicada: boolean("beca_aplicada").notNull().default(false),
    /**
     * Ojo: los montos de la BBDD son ADELANTOS PARCIALES, no precios finales.
     * `caja_recaudada` se suma de aca; `ventas_cerradas` se cuenta aparte.
     * Nunca inferir una de la otra.
     */
    montoAbonado: numeric("monto_abonado", { precision: 12, scale: 2 }),
    moneda: text("moneda").notNull().default("USD"),
    esPagoCompleto: boolean("es_pago_completo").notNull().default(false),
    huellaFila: text("huella_fila"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sales_cohorte_idx").on(t.cohortId),
    uniqueIndex("sales_huella_idx").on(t.programId, t.huellaFila),
  ],
);

// ─────────────────────────────────────────────────────────── pauta

export const adSpend = pgTable(
  "ad_spend",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
    campana: text("campana"),
    creativo: text("creativo"),
    fecha: date("fecha"),
    inversionCop: numeric("inversion_cop", { precision: 14, scale: 2 }),
    impresiones: integer("impresiones"),
    clics: integer("clics"),
    registros: integer("registros"),
    huellaFila: text("huella_fila"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ad_spend_huella_idx").on(t.programId, t.huellaFila)],
);

// ─────────────────────────────────────────────────────────── sincronizacion

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "cascade" }),
    iniciado: timestamp("iniciado", { withTimezone: true }).notNull().defaultNow(),
    terminado: timestamp("terminado", { withTimezone: true }),
    estado: estadoSyncEnum("estado").notNull().default("corriendo"),
    filasLeidas: integer("filas_leidas").notNull().default(0),
    personasNuevas: integer("personas_nuevas").notNull().default(0),
    personasActualizadas: integer("personas_actualizadas").notNull().default(0),
    registrosNuevos: integer("registros_nuevos").notNull().default(0),
    errores: jsonb("errores"),
  },
  (t) => [index("sync_runs_fuente_idx").on(t.sourceId, t.iniciado)],
);

/**
 * Bitacora de cambios. Es el corazon del requisito de "registrar cambios":
 * cada campo que cambia respecto a lo guardado deja una fila aca.
 */
export const changeLog = pgTable(
  "change_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tabla: text("tabla").notNull(),
    registroId: uuid("registro_id"),
    /** Etiqueta legible del registro, para no tener que hacer join al mostrar. */
    etiqueta: text("etiqueta"),
    campo: text("campo").notNull(),
    valorAnterior: text("valor_anterior"),
    valorNuevo: text("valor_nuevo"),
    detectadoEn: timestamp("detectado_en", { withTimezone: true }).notNull().defaultNow(),
    origen: origenCambioEnum("origen").notNull().default("sync"),
    /**
     * Quien hizo el cambio desde la app. Nullable a proposito: en los cambios del
     * sync no hay usuario (`null`). El molde de catalogo (ADR 0012) lo llena, y
     * ADR 0016 lo necesita porque los closers crean productos y hay que poder
     * auditar quien creo cada uno. `set null` para no perder la bitacora si algun
     * dia se desactiva/borra al usuario.
     */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    syncRunId: uuid("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
  },
  (t) => [index("change_log_detectado_idx").on(t.detectadoEn)],
);

// ─────────────────────────────────────────────────────────── catalogos

/**
 * Plataformas de pago (PayPal, MercadoPago, ...). Primera entidad del molde de
 * catalogo (ADR 0012): instancia editable desde la app, nunca un enum. El codigo
 * no decide nada segun su valor, asi que vive como fila.
 */
export const plataformasPago = pgTable(
  "plataformas_pago",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Unicidad del nombre SIN distinguir mayusculas: 'Paypal' y 'PayPal' no pueden
  // partir las metricas en dos plataformas distintas.
  (t) => [uniqueIndex("plataformas_pago_nombre_idx").on(sql`lower(${t.nombre})`)],
);

/**
 * Motivos de perdida de una llamada (dinero, horario, sin fit, ...). Catalogo del
 * molde (ADR 0012, ADR 0015): el equipo los descubre sobre la marcha y el reporte
 * los agrupa, asi que son instancia editable, no un enum.
 */
export const motivos = pgTable(
  "motivos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("motivos_nombre_idx").on(sql`lower(${t.nombre})`)],
);

/**
 * Origenes del lead (agenda del dia, follow-up, referido, ...). Catalogo del molde
 * (ADR 0012): el codigo no decide nada segun su valor, asi que vive como fila
 * editable desde la app.
 */
export const origenes = pgTable(
  "origenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("origenes_nombre_idx").on(sql`lower(${t.nombre})`)],
);

// ─────────────────────────────────────────────────────────── tipos

export type Usuario = typeof users.$inferSelect;
export type NuevoUsuario = typeof users.$inferInsert;
export type MiembroPrograma = typeof miembrosPrograma.$inferSelect;
export type Programa = typeof programs.$inferSelect;
export type Cohorte = typeof cohorts.$inferSelect;
export type Fuente = typeof sources.$inferSelect;
export type Persona = typeof people.$inferSelect;
export type NuevaPersona = typeof people.$inferInsert;
export type Llamada = typeof calls.$inferSelect;
export type Venta = typeof sales.$inferSelect;
export type Pauta = typeof adSpend.$inferSelect;
export type CorridaSync = typeof syncRuns.$inferSelect;
export type Cambio = typeof changeLog.$inferSelect;
export type PlataformaPago = typeof plataformasPago.$inferSelect;
export type Motivo = typeof motivos.$inferSelect;
export type Origen = typeof origenes.$inferSelect;
