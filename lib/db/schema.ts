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
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Modelo de datos de Retia Metrics.
 *
 * Regla que atraviesa todo el esquema: **toda tasa se calcula sobre personas,
 * nunca sobre filas**. Por eso `people` tiene un unico registro por correo
 * normalizado y guarda `numAplicaciones` como senal, no como filas separadas.
 */

// ─────────────────────────────────────────────────────────── enums

export const rolEnum = pgEnum("rol", ["gerente", "closer", "developer"]);

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
  "cancelada",
  "reagendada",
  "compromiso_pago",
  "cerrada",
  "perdida",
]);

/** Por donde entro una persona al CRM (ADR 0021). */
export const entradaPersonaEnum = pgEnum("entrada_persona", ["formulario", "crm"]);
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
  /** Pagina de venta del programa. Editable desde /ajustes/programas (ticket 014). */
  webUrl: text("web_url"),
  /** Calendly del programa, para cruzar agendamientos. Editable desde /ajustes/programas (ticket 014). */
  calendlyUrl: text("calendly_url"),
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
    /** Meta de leads por dia habil de la cohorte. Editable desde /ajustes (ticket 014). */
    metaLeadsDia: integer("meta_leads_dia"),
    precioUsd: numeric("precio_usd", { precision: 10, scale: 2 }).notNull(),
    fechaInicioClases: date("fecha_inicio_clases").notNull(),
    /**
     * Primer dia de la ventana de venta (ADR 0022). Lo declara el negocio por
     * cohorte: no se deduce del cierre de la cohorte anterior. Nullable solo para
     * las cohortes cerradas cuyo inicio real nadie sabe; el CHECK de abajo impide
     * que una cohorte quede activa sin el.
     */
    fechaInicioVentas: date("fecha_inicio_ventas"),
    /**
     * Ultimo dia de la ventana de venta, inclusive. Es un dato de la cohorte, no
     * una regla: hay programas que venden hasta el mismo dia en que arrancan
     * clases y otros hasta la vispera (ADR 0022).
     */
    fechaCierreVentas: date("fecha_cierre_ventas").notNull(),
    /** Editable por cohorte. Los links de pago se generan manualmente segun la TRM del momento. */
    trmCohorte: numeric("trm_cohorte", { precision: 10, scale: 2 }).notNull().default("4000"),
    estado: estadoCohorteEnum("estado").notNull().default("futuro"),
    notas: text("notas"),
  },
  (t) => [
    uniqueIndex("cohorts_programa_codigo_idx").on(t.programId, t.codigo),
    // Maximo una cohorte activa por programa (ADR 0005: la garantia vive en la base,
    // no solo en codigo). Indice unico PARCIAL: solo las filas en estado 'activo'
    // compiten por la unicidad; 'cerrado' y 'futuro' no. Un segundo intento de
    // activar choca con 23505, que `lib/catalogo/cohortes.ts` traduce a un 400 claro.
    uniqueIndex("cohorts_una_activa_por_programa_idx")
      .on(t.programId)
      .where(sql`${t.estado} = 'activo'`),
    // La cohorte que esta vendiendo necesita su inicio de ventas para poder contar
    // dias habiles y meta dinamica (ADR 0022). Igual que el indice de arriba, la
    // garantia vive en la base (ADR 0005) y no solo en la validacion zod.
    check(
      "cohorts_activa_con_inicio_ventas",
      sql`${t.estado} <> 'activo' OR ${t.fechaInicioVentas} IS NOT NULL`,
    ),
  ],
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
    /**
     * Closer responsable de la persona (ADR 0021). Lo escribe solo la app: el sync
     * nunca lo lee ni lo pisa. Es el mismo `closerId` en texto de ADR 0011, no una
     * relacion a `users`. "Sin responsable" es un estado valido.
     */
    responsableCloserId: text("responsable_closer_id"),
    /**
     * Por donde entro la persona (ADR 0021): por el formulario de la hoja o creada
     * a mano en el CRM. Es un tipo, no una fila: el codigo decide segun su valor
     * (el CPL usa solo las del formulario, y el sync pasa una persona de `crm` a
     * `formulario` cuando la encuentra).
     */
    entrada: entradaPersonaEnum("entrada").notNull().default("formulario"),
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
    /** Fecha prometida de un compromiso de pago o nueva cita de una reagendada (ADR 0015). */
    fechaSeguimiento: timestamp("fecha_seguimiento", { withTimezone: true }),
    /** Motivo de perdida como catalogo (ADR 0015). `motivoPerdida` queda solo para filas viejas de Sheets. */
    motivoId: uuid("motivo_id").references(() => motivos.id, { onDelete: "restrict" }),
    /** Origen del lead como catalogo (ADR 0015). */
    origenId: uuid("origen_id").references(() => origenes.id, { onDelete: "restrict" }),
    notas: text("notas"),
    origen: text("origen").notNull().default("sheets"),
    /** Huella de la fila de origen, para no duplicar en cada sync. */
    huellaFila: text("huella_fila"),
    raw: jsonb("raw"),
    /**
     * Anulacion (ADR 0026). **No es un booleano a proposito:** cuando el dinero no
     * cuadra, la pregunta no es "¿esto esta anulado?" sino "¿quien lo anulo, cuando
     * y por que?". Un booleano tira esa respuesta a la basura.
     *
     * `anuladoPor` es una FK a `users` con `restrict`, no texto copiado como
     * `closerId` (ADR 0011): quien anula es siempre una cuenta de la app, nunca una
     * fila importada de la hoja, y perder la atribucion vaciaria la mitad del valor
     * de conservar el registro. El `restrict` es la misma regla del ADR 0026 punto 5:
     * no se borra lo que ya se uso.
     *
     * Lo anulado desaparece de toda metrica por UN predicado (`lib/queries/vigente.ts`),
     * nunca escribiendo `is null` a mano, y sigue viendose tachado en el historial de
     * la persona.
     */
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    anuladoPor: uuid("anulado_por").references(() => users.id, { onDelete: "restrict" }),
    motivoAnulacion: text("motivo_anulacion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("calls_cohorte_closer_idx").on(t.cohortId, t.closerId),
    index("calls_persona_idx").on(t.personId),
    uniqueIndex("calls_huella_idx").on(t.programId, t.huellaFila),
    // Sin motivo no hay anulacion (ADR 0026 punto 6), y la garantia vive en la base
    // y no solo en zod (ADR 0005): los tres campos van juntos o no va ninguno. Una
    // fila anulada sin quien ni por que es justo el estado que el ADR descarta.
    check(
      "calls_anulacion_completa",
      sql`(${t.anuladoEn} IS NULL AND ${t.anuladoPor} IS NULL AND ${t.motivoAnulacion} IS NULL)
          OR (${t.anuladoEn} IS NOT NULL AND ${t.anuladoPor} IS NOT NULL
              AND length(trim(${t.motivoAnulacion})) > 0)`,
    ),
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
    /**
     * La llamada que cerro esta venta (ADR 0026 punto 2). Nace con el ticket 029:
     * hasta entonces la venta y su llamada se escribian en la misma transaccion sin
     * ninguna referencia entre ellas, asi que "anular la llamada anula su venta" no
     * se podia cumplir sin adivinar por persona y fecha.
     *
     * Nullable, y lo seguira siendo: las ventas migradas de Sheets son filas de otra
     * pestana que nunca estuvo enlazada a una llamada, y las que la app escribio
     * antes de esta columna tampoco lo estan. `restrict` por la misma razon que
     * `anuladoPor`: una llamada que ya cerro una venta es una llamada que se uso.
     */
    callId: uuid("call_id").references((): AnyPgColumn => calls.id, { onDelete: "restrict" }),
    emailComprador: text("email_comprador"),
    fecha: date("fecha"),
    /** Producto vendido (ADR 0016). Nullable para las filas viejas de Sheets. */
    productoId: uuid("producto_id").references(() => productos.id, { onDelete: "restrict" }),
    precioListaUsd: numeric("precio_lista_usd", { precision: 10, scale: 2 }),
    precioAplicadoUsd: numeric("precio_aplicado_usd", { precision: 10, scale: 2 }),
    becaAplicada: boolean("beca_aplicada").notNull().default(false),
    /**
     * Filas viejas de Sheets: un solo adelanto parcial por venta. Se deja de
     * escribir desde la app (ADR 0013): la caja recaudada sale de la suma de
     * `abonos.monto`, nunca de aca. Nunca inferir ventas cerradas de este monto.
     */
    montoAbonado: numeric("monto_abonado", { precision: 12, scale: 2 }),
    moneda: text("moneda").notNull().default("USD"),
    huellaFila: text("huella_fila"),
    raw: jsonb("raw"),
    /** Anulacion (ADR 0026). Ver la nota completa en `calls`. */
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    anuladoPor: uuid("anulado_por").references(() => users.id, { onDelete: "restrict" }),
    motivoAnulacion: text("motivo_anulacion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sales_cohorte_idx").on(t.cohortId),
    uniqueIndex("sales_huella_idx").on(t.programId, t.huellaFila),
    // Una llamada cierra COMO MUCHO una venta, y la garantia vive en la base
    // (ADR 0005). Postgres admite varios NULL en un indice unico, asi que las ventas
    // sin llamada enlazada (Sheets, y las anteriores al ticket 029) no compiten. De
    // paso, la cascada de la anulacion busca por aca en vez de recorrer la tabla.
    uniqueIndex("sales_call_idx").on(t.callId),
    // Sin motivo no hay anulacion (ADR 0026 punto 6), y la garantia vive en la base
    // y no solo en zod (ADR 0005): los tres campos van juntos o no va ninguno. Una
    // fila anulada sin quien ni por que es justo el estado que el ADR descarta.
    check(
      "sales_anulacion_completa",
      sql`(${t.anuladoEn} IS NULL AND ${t.anuladoPor} IS NULL AND ${t.motivoAnulacion} IS NULL)
          OR (${t.anuladoEn} IS NOT NULL AND ${t.anuladoPor} IS NOT NULL
              AND length(trim(${t.motivoAnulacion})) > 0)`,
    ),
  ],
);

// ─────────────────────────────────────────────────────────── abonos

/**
 * Un pago recibido sobre una venta (ADR 0013). Una venta puede tener varios abonos;
 * la **caja recaudada** es la suma de `monto` por fecha del abono, y es una metrica
 * distinta de las ventas cerradas (nunca se deriva una de la otra).
 *
 * `onDelete: "restrict"` en `saleId`: no se puede borrar una venta que ya tiene
 * abonos registrados, para no perder caja huerfana.
 *
 * `moneda` vive al lado del monto para que nunca se convierta en silencio
 * (restriccion dura de AGENTS.md). Por decision de Michael (16-sep) hoy solo entra
 * `USD`; la columna se mantiene para que la moneda siga visible y el esquema zod
 * (`lib/abonos/esquema.ts`) la restringe.
 *
 * `closerId` es texto copiado del closer logueado, no una relacion a `users`
 * (ADR 0011). `origen` distingue los abonos migrados de Sheets ('sheets') de los
 * nativos de la app ('app', ADR 0010).
 */
export const abonos = pgTable(
  "abonos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    fecha: date("fecha").notNull(),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    moneda: text("moneda").notNull().default("USD"),
    plataformaId: uuid("plataforma_id").references(() => plataformasPago.id, { onDelete: "restrict" }),
    comprobanteUrl: text("comprobante_url"),
    /** Nombre del closer que registro el abono, copiado de su cuenta (ADR 0011). */
    closerId: text("closer_id"),
    origen: text("origen").notNull().default("app"),
    /** Anulacion (ADR 0026). Ver la nota completa en `calls`. */
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    anuladoPor: uuid("anulado_por").references(() => users.id, { onDelete: "restrict" }),
    motivoAnulacion: text("motivo_anulacion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("abonos_programa_fecha_idx").on(t.programId, t.fecha),
    index("abonos_venta_idx").on(t.saleId),
    // Sin motivo no hay anulacion (ADR 0026 punto 6), y la garantia vive en la base
    // y no solo en zod (ADR 0005): los tres campos van juntos o no va ninguno. Una
    // fila anulada sin quien ni por que es justo el estado que el ADR descarta.
    check(
      "abonos_anulacion_completa",
      sql`(${t.anuladoEn} IS NULL AND ${t.anuladoPor} IS NULL AND ${t.motivoAnulacion} IS NULL)
          OR (${t.anuladoEn} IS NOT NULL AND ${t.anuladoPor} IS NOT NULL
              AND length(trim(${t.motivoAnulacion})) > 0)`,
    ),
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

/**
 * Productos que se venden dentro de un programa (ticket 017, ADR 0016): el programa
 * completo, la reserva de cupo, la mentoria 1:1... Cada uno con su precio de lista y
 * su moneda. Instancia editable del molde (ADR 0012): tabla con `activo`, un solo
 * esquema zod, nunca se borra, cada cambio a `change_log`.
 *
 * A diferencia de los catalogos globales (plataformas, motivos, origenes), un
 * producto cuelga de un programa (`programId`), asi que la unicidad del nombre es
 * POR programa y sin distinguir mayusculas: dos programas pueden tener cada uno un
 * "Programa completo", pero un mismo programa no puede repetirlo.
 *
 * La moneda vive al lado del precio y nunca se convierte en silencio (restriccion
 * dura de AGENTS.md): USD o COP, sin TRM historica unica.
 */
export const productos = pgTable(
  "productos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    precioLista: numeric("precio_lista", { precision: 10, scale: 2 }).notNull(),
    moneda: text("moneda").notNull().default("USD"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Unicidad del nombre POR programa y SIN distinguir mayusculas, como los indices
  // `lower(nombre)` de los demas catalogos: 'Programa completo' y 'programa completo'
  // no pueden partir el catalogo del mismo programa en dos.
  (t) => [uniqueIndex("productos_programa_nombre_idx").on(t.programId, sql`lower(${t.nombre})`)],
);

// ─────────────────────────────────────────────────────────── recursos y enlaces de pago

/**
 * Categoria de un recurso (Brochure, Pagina web, Guion, ...). Es un catalogo mas
 * sobre el molde (ADR 0012): agregar una categoria es una fila, nunca un literal.
 */
export const categoriasRecurso = pgTable(
  "categorias_recurso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categorias_recurso_nombre_idx").on(sql`lower(${t.nombre})`)],
);

/**
 * Un link del equipo: brochure, pagina web, guion, formulario, Calendly, Drive
 * (ADR 0017). Se guarda el LINK, nunca el archivo: los archivos ya viven en Drive y
 * duplicarlos crea dos versiones que se desincronizan.
 *
 * `vigente` y `activo` son cosas distintas y las dos hacen falta:
 * - `vigente` marca cual es la version de hoy entre el historial. Reemplazar un
 *   brochure crea una fila nueva vigente y deja la anterior no vigente, pero la
 *   anterior sigue ahi: el historial es el punto (ADR 0017).
 * - `activo` es el borrado suave del molde de catalogo (ADR 0012): nunca se borra.
 *
 * `programId` nulo significa GLOBAL (sirve para todos los programas).
 */
export const recursos = pgTable(
  "recursos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nulo = recurso global, no atado a un programa. */
    programId: uuid("program_id").references(() => programs.id, { onDelete: "cascade" }),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categoriasRecurso.id, { onDelete: "restrict" }),
    titulo: text("titulo").notNull(),
    url: text("url").notNull(),
    vigente: boolean("vigente").notNull().default(true),
    /** La fila que este recurso reemplaza. Encadena el historial de versiones. */
    reemplazaA: uuid("reemplaza_a").references((): AnyPgColumn => recursos.id, {
      onDelete: "set null",
    }),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * Una sola version VIGENTE por (programa, categoria, titulo). La garantia vive
     * en la base y no solo en el codigo (ADR 0005), igual que la cohorte activa.
     *
     * Dos detalles que no son adorno:
     * - Indice PARCIAL: solo compiten las filas vigentes y activas. El historial
     *   (vigente = false) y lo desactivado no ocupan el cupo.
     * - `coalesce` sobre `program_id`: un recurso global lo tiene NULL, y Postgres
     *   considera dos NULL como DISTINTOS, asi que un indice ingenuo dejaria pasar
     *   dos recursos globales vigentes con el mismo titulo. El uuid de ceros no es
     *   un programa real, es el valor con el que se colapsan los nulos.
     */
    uniqueIndex("recursos_vigente_idx")
      .on(
        sql`coalesce(${t.programId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        t.categoriaId,
        sql`lower(${t.titulo})`,
      )
      .where(sql`${t.vigente} = true and ${t.activo} = true`),
    index("recursos_programa_idx").on(t.programId),
  ],
);

/**
 * Un link de pago ya generado (PayPal y demas), con el monto y la moneda que cobra
 * (ADR 0017). La moneda vive al lado del monto y nunca se convierte en silencio
 * (restriccion dura de AGENTS.md): los links se generan a mano segun la TRM del
 * momento, asi que el monto es el que cobra ese link y nada mas.
 *
 * `productoId` nulo = el link no corresponde a un producto del catalogo (un abono
 * suelto, un monto pactado). `vigente` y `activo` significan lo mismo que en
 * `recursos`.
 */
export const enlacesPago = pgTable(
  "enlaces_pago",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id").references(() => productos.id, { onDelete: "restrict" }),
    plataformaId: uuid("plataforma_id")
      .notNull()
      .references(() => plataformasPago.id, { onDelete: "restrict" }),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    moneda: text("moneda").notNull().default("USD"),
    url: text("url").notNull(),
    vigente: boolean("vigente").notNull().default(true),
    reemplazaA: uuid("reemplaza_a").references((): AnyPgColumn => enlacesPago.id, {
      onDelete: "set null",
    }),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("enlaces_pago_programa_idx").on(t.programId)],
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
export type Abono = typeof abonos.$inferSelect;
export type NuevoAbono = typeof abonos.$inferInsert;
export type Pauta = typeof adSpend.$inferSelect;
export type CorridaSync = typeof syncRuns.$inferSelect;
export type Cambio = typeof changeLog.$inferSelect;
export type PlataformaPago = typeof plataformasPago.$inferSelect;
export type Motivo = typeof motivos.$inferSelect;
export type Origen = typeof origenes.$inferSelect;
export type Producto = typeof productos.$inferSelect;
export type CategoriaRecurso = typeof categoriasRecurso.$inferSelect;
export type Recurso = typeof recursos.$inferSelect;
export type EnlacePago = typeof enlacesPago.$inferSelect;
