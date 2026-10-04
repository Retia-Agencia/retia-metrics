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
 * nunca sobre filas**. Por eso `leads` tiene un unico registro por correo
 * normalizado y guarda `numAplicaciones` como senal, no como filas separadas.
 */

// ─────────────────────────────────────────────────────────── enums

export const rolEnum = pgEnum("rol", ["gerente", "closer", "developer", "paid_trafficker"]);

/**
 * Las once etapas del Deal: las de 30X desde el ticket 142 (ADR 0037, ADR 0070 a 0072).
 * Son un `pgEnum` —o sea TIPOS— y no un catalogo editable, y eso NO contradice al ADR
 * 0012: la regla de ese ADR es "si el codigo decide segun el valor, es tipo", y aqui
 * **todo** decide segun la etapa (el embudo, quien es Student, la cartera vencida, los
 * movimientos automaticos).
 *
 * Es la direccion contraria a `leads.estado`, que paso a texto por el ADR 0032
 * porque nadie decide con el. Las dos decisiones contestan la misma pregunta sobre
 * datos distintos.
 *
 * ⚠️ El orden de este arreglo **no es el orden de un embudo**: `cierre_perdido` es
 * alcanzable desde casi cualquier etapa y Potencial, Registrado y Calificado son tres
 * puertas de entrada, no tres pasos. Ninguna consulta debe comparar etapas por su
 * posicion (ADR 0037).
 *
 * Re-agenda, Seguimiento y Proxima Cohorte ya NO son etapas: son el Pendiente del deal
 * (`pendienteDealEnum`, ADR 0070).
 *
 * Que movimiento entre ellas es legal NO vive aca: vive en `lib/deals/etapas.ts`
 * (ticket 043), como dato.
 */
export const etapaDealEnum = pgEnum("etapa_deal", [
  "potencial",
  "registrado",
  "en_gestion",
  "contactado",
  "calificado",
  "agendado",
  "atendido",
  "compromiso_verbal",
  "ganado_parcial",
  "ganado_completo",
  "cierre_perdido",
]);

/**
 * Lo que el closer tiene que hacer con un deal que no avanzo (ADR 0070): re-agendar,
 * hacer el seguimiento o esperar la proxima cohorte. Enum y no catalogo porque el codigo
 * decide con el (Inbox, Kanban, la cita que mueve a Agendado). Un deal tiene a lo sumo
 * uno (`deals.pendiente`, nullable) y poner uno NO mueve la etapa. Solo `moverEtapa()`
 * lo escribe.
 */
export const pendienteDealEnum = pgEnum("pendiente_deal", ["reagenda", "seguimiento", "proxima_cohorte"]);

export const tipoContactoEnum = pgEnum("tipo_contacto", ["correo", "telefono"]);

/**
 * Que clase de actividad quedo registrada sobre un deal (ADR 0037, ADR 0071). Es tipo
 * porque el codigo decide con el: un `contacto` (logrado) con fecha mueve a Contactado;
 * un `intento` (fallido) se cuenta para la alerta de los tres intentos (128). Los dos
 * son actividad comercial y sacan a Potencial o Registrado hacia En gestion. Una `nota`
 * no mueve nada. `intento` va al final porque Postgres agrega los valores al final.
 */
export const tipoActividadEnum = pgEnum("tipo_actividad", ["contacto", "nota", "intento"]);

/**
 * A que lista pertenece un motivo (Mani, 27-sep, ticket 103). Es TIPO y no catalogo
 * porque el motor decide con el: cada flecha que exige motivo acepta solo los de su
 * lista (P perdida, T29 reagenda, T15 retroceso, R recuperacion). Sin listas separadas,
 * el reporte de "por que perdemos" se mezcla con los de re-agenda sin lanzar un error.
 * Los motivos en si siguen siendo filas editables (ADR 0012).
 */
export const tipoMotivoEnum = pgEnum("tipo_motivo", [
  "perdida",
  "reagenda",
  "retroceso",
  "recuperacion",
  "correccion",
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
export const tipoFuenteEnum = pgEnum("tipo_fuente", ["google_sheet", "upload", "webhook"]);
/**
 * Que paso con una entrega del webhook (ticket 110). Es TIPO: la pantalla de salud
 * decide con el (etiqueta, tono, si se puede reprocesar). Los 200 con firma buena
 * (`procesado`, `sin_correo`, `contenido_invalido`, `fallo_ingesta`) tienen sobre crudo;
 * los rechazos (404, 401) no, porque un cuerpo sin firma valida es de cualquiera.
 */
export const motivoEntregaEnum = pgEnum("motivo_entrega", [
  "procesado",
  "sin_correo",
  "contenido_invalido",
  "fallo_ingesta",
  "fuente_no_encontrada",
  "sin_secreto",
  "firma_ausente",
  "firma_invalida",
]);
/**
 * De que proveedor viene el payload de una fuente webhook (ADR 0055 punto 2). Es TIPO
 * porque el codigo elige el adaptador con el: un proveedor nuevo es un valor mas y un
 * adaptador, nunca un endpoint nuevo.
 */
export const proveedorFormularioEnum = pgEnum("proveedor_formulario", ["typeform", "dapta"]);
export const estadoSyncEnum = pgEnum("estado_sync", ["corriendo", "ok", "error"]);
/**
 * Salud de una fuente (ADR 0039, lo usa el ticket 055). **No es lo mismo que
 * `activo`**: una fuente ROTA sigue activa. Es la diferencia entre "esta hoja
 * cambio y hay que mirarla" y "esta hoja ya no se lee", y fundirlas haria que un
 * encabezado renombrado apagara el intake del programa en silencio.
 */
export const estadoFuenteEnum = pgEnum("estado_fuente", ["activa", "rota"]);
export const origenCambioEnum = pgEnum("origen_cambio", ["sync", "app", "upload"]);

// ─────────────────────────────────────────────────────────── usuarios

export const users = pgTable(
  "users",
  {
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
  },
  (t) => [
    /**
     * Dos cuentas no pueden reclamar el mismo closer (ADR 0030). La comparacion de
     * `closerId` ignora mayusculas y espacios, asi que la UNICIDAD tiene que
     * ignorarlos igual: si no, `Mani` y `mani` conviven como dos filas y las dos
     * "son" el mismo closer, que es peor que el problema original.
     *
     * Va en la base y no solo en zod por la razon del ADR 0005: una garantia que
     * vive solo en el codigo se rompe el dia que alguien escribe por otro camino
     * (el CLI de emergencia, un script, una migracion). La expresion es la misma de
     * `claveDeCloserSql` en `lib/closers/identidad.ts`.
     *
     * Parcial: `closer_id` nulo es un estado valido y frecuente (un gerente no
     * tiene), y varios nulos no chocan entre si.
     */
    uniqueIndex("users_closer_id_normalizado_idx")
      .on(sql`regexp_replace(btrim(lower(${t.closerId})), '[[:space:]]+', ' ', 'g')`)
      .where(sql`${t.closerId} is not null`),
  ],
);

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
    /**
     * La cuenta de Calendly de esta closer EN ESTE programa (ticket 096, ADR 0049): tiene un
     * correo distinto por programa, asi que vive en la membresia y no en `users`
     * (`users.calendly_email` es global y queda sin lector). Es como el webhook sabe quien es
     * la host de una cita. Guardar en minusculas y sin espacios: el indice compara `lower()`.
     */
    calendlyEmail: text("calendly_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("miembros_programa_par_idx").on(t.userId, t.programId),
    // Dos closers no pueden reclamar la misma cuenta de Calendly en un programa: la garantia
    // vive en la base (ADR 0005), no solo en el emparejador, que ya lo trata como duda.
    uniqueIndex("miembros_programa_calendly_idx")
      .on(t.programId, sql`lower(${t.calendlyEmail})`)
      .where(sql`${t.calendlyEmail} IS NOT NULL`),
  ],
);

// ─────────────────────────────────────────────────────────── programas y cohortes

export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    nombre: text("nombre").notNull(),
    /** Solo prellena el precio al crear una cohorte; ninguna métrica lee este valor. */
    ticketUsd: numeric("ticket_usd", { precision: 10, scale: 2 }).notNull(),
    /** Pagina de venta del programa. Editable desde la tab Programa (ticket 014). */
    webUrl: text("web_url"),
    /** Calendly del programa, para cruzar agendamientos. Editable desde la tab Programa (ticket 014). */
    calendlyUrl: text("calendly_url"),
    /**
     * URL base del formulario del programa (ADR 0057). Un programa no se activa sin ella.
     * Es tambien la base del generador de links de captacion (ADR 0051, ticket 092).
     */
    formUrl: text("form_url"),
    /**
     * Token de Calendly de la organizacion del programa (ADR 0057): con el se lee la fecha
     * de una cita. Segunda excepcion nombrada a "secretos solo en .env.local y Vercel": lo
     * escribe SOLO `guardarTokenCalendly`, nunca pasa por el molde ni por `change_log`, y
     * ninguna lectura del catalogo lo devuelve. Nula hasta que Mani lo cargue.
     */
    calendlyToken: text("calendly_token"),
    /**
     * La clave con la que Calendly FIRMA los eventos del webhook de este programa (ticket 096,
     * A5): cada suscripcion tiene la suya. Tercera excepcion nombrada a "secretos solo en
     * .env.local y Vercel", con las reglas del token: la escribe una sola funcion, nunca pasa
     * por el molde ni por `change_log`, y ninguna lectura del catalogo la devuelve.
     */
    calendlySigningKey: text("calendly_signing_key"),
    /** Maximo historico de personas por dia habil. Marca cuando una meta es inalcanzable por volumen. */
    recordPersonasPorDiaHabil: integer("record_personas_por_dia_habil"),
    /**
     * Plantilla de lead del programa (ADR 0019, ticket 016): en que encabezado de SU
     * hoja esta cada campo. Misma forma que `sources.mapeoColumnas`.
     *
     * Existe porque un programa puede tener varias hojas que preguntan lo mismo con
     * otra redaccion: la plantilla se escribe UNA vez en el programa y cada fuente
     * solo ajusta los campos que su hoja redacta distinto. El mapeo efectivo se
     * combina campo por campo —fuente gana sobre programa, programa sobre el defecto
     * del codigo— en `lib/sheets/plantilla-lead.ts`.
     *
     * Nula = el programa no ajusta nada y sus fuentes heredan el defecto. No inventa
     * campos: los campos son fijos en el codigo y lo demas va a `leads.raw`.
     */
    plantillaLead: jsonb("plantilla_lead"),
    /**
     * Dias HABILES sin actividad tras los cuales un deal abierto con dueno esta estancado
     * (ticket 071). Por programa (ADR 0012); defecto 3.
     */
    diasSinActividad: integer("dias_sin_actividad").notNull().default(3),
    /**
     * La comision como PORCENTAJE del valor vendido (ticket 133, ADR 0065 punto 7). Es el
     * vigente: `moverEtapa()` lo copia al deal la primera vez que entra a venta, y desde ahi
     * cambiarlo solo toca las ventas nuevas. Nulo = no cargado, nunca 0. Reemplazo al monto
     * fijo por venta del ticket 062 (`comision_por_venta_usd`, retirado en la 0055).
     */
    comisionPorcentaje: numeric("comision_porcentaje", { precision: 5, scale: 2 }),
    /**
     * Nace INACTIVO (ADR 0057): un programa se activa solo con su Forms Link y su
     * token de Calendly, y el CHECK de abajo lo garantiza en la base (ADR 0005).
     */
    activo: boolean("activo").notNull().default(false),
  },
  (t) => [
    check(
      "programs_activo_con_formulario_y_token",
      sql`NOT ${t.activo} OR (${t.formUrl} IS NOT NULL AND ${t.calendlyToken} IS NOT NULL)`,
    ),
    check("programs_dias_sin_actividad_positivo", sql`${t.diasSinActividad} > 0`),
    check(
      "programs_comision_porcentaje_rango",
      sql`${t.comisionPorcentaje} IS NULL OR (${t.comisionPorcentaje} >= 0 AND ${t.comisionPorcentaje} <= 100)`,
    ),
  ],
);

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

/**
 * El INTAKE DE LEADS CRUDOS de un programa, y nada mas (ADR 0039).
 *
 * Hasta el ticket 039 esta tabla significaba "pestana que el CRM lee, con un
 * destino", y por eso guardaba cuatro clases de cosas mezcladas: formularios,
 * estudiantes, pauta y registros de llamadas. Eso tenia sentido en la epoca en que
 * todo se gestionaba a mano en Sheets. En el modelo v2 las llamadas, las ventas y
 * los abonos NACEN en el CRM (ADR 0037), asi que lo unico que entra de afuera son
 * leads crudos que llenan un formulario.
 *
 * Por eso la columna `destino` desaparece con las 7 filas que la usaban: cuando
 * todas las filas valen lo mismo, la columna no informa, y una columna que no
 * informa es una invitacion a volver a meter otra clase de cosa aqui.
 */
export const sources = pgTable(
  "sources",
  {
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
    /**
     * En que zona horaria escribe las fechas ESTA fuente (ticket 053). Bogota por
     * defecto, que es la regla dura del proyecto.
     *
     * 🩸 Es configurable porque no es cierto para las hojas de hoy: las dos vienen
     * de Typeform y escriben en **UTC**. Interpretar una fecha de la hoja como si
     * fuera de Bogota corre el dia de 7pm a medianoche, y eso no lanza ningun
     * error: manda un lead al dia equivocado del embudo.
     */
    tzFechas: text("tz_fechas").notNull().default("America/Bogota"),
    /**
     * Salud de la fuente (ticket 055). Una fuente rota SIGUE ACTIVA y sigue siendo
     * el intake del programa: lo que cambia es que la app avisa. Apagarla por un
     * encabezado renombrado dejaria al programa sin entrada de leads sin que nadie
     * lo pidiera.
     */
    estado: estadoFuenteEnum("estado").notNull().default("activa"),
    /** Solo en una fuente `webhook`: que adaptador lee su payload (ADR 0055). */
    proveedor: proveedorFormularioEnum("proveedor"),
    /**
     * El secreto HMAC con el que el proveedor firma cada envio (ADR 0055 punto 5,
     * ticket 105). Se guarda en claro porque verificar una firma exige el secreto, no
     * un hash. Por eso **nunca pasa por el molde**: el molde escribe cada campo en
     * `change_log`, y el secreto quedaria en la bitacora. Lo escribe solo
     * `rotarSecretoDeFuente`, que deja el rastro sin el valor.
     *
     * Nulo en una fuente webhook = todavia no puede recibir: activarla lo exige.
     */
    secretoWebhook: text("secreto_webhook"),
    /**
     * Cuanto silencio aguanta ESTA fuente antes de que la app la marque (ticket 107).
     * Por fuente y no fijo (ADR 0012): un programa con pauta prendida recibe varios
     * envios al dia y uno sin pauta puede pasar dias sin ninguno. Los defectos son de
     * Mani (28-sep): 48 h "sin respuestas" y 5 dias (120 h) "muerta". En horas los dos,
     * para que se comparen sin convertir unidades. Se marca, nunca se apaga (ADR 0055).
     */
    umbralSinRespuestaHoras: integer("umbral_sin_respuesta_horas").notNull().default(48),
    umbralMuertaHoras: integer("umbral_muerta_horas").notNull().default(120),
    /**
     * Donde la gente LLENA este formulario (ADR 0068, ticket 092). No es donde caen las
     * respuestas (la hoja o la URL del webhook): es el destino de un link de captacion.
     * Nula = esta fuente no se reparte.
     */
    urlPublica: text("url_publica"),
    /**
     * La fuente que el generador de links usa por defecto (ADR 0068 punto 2). A lo sumo
     * una por programa, por indice; y una principal siempre es repartible, por CHECK.
     * La escribe solo `marcarFuentePrincipal`, nunca la edicion de datos.
     */
    principal: boolean("principal").notNull().default(false),
    ultimaSync: timestamp("ultima_sync", { withTimezone: true }),
    activo: boolean("activo").notNull().default(true),
    orden: integer("orden").notNull().default(0),
  },
  (t) => [
    /**
     * **Varios intakes ACTIVOS por programa** (ADR 0064, ticket 131; enmienda el ADR 0039
     * punto 2). Hasta el 30-sep un indice unico parcial (`sources_una_activa_por_programa_idx`)
     * dejaba uno solo. Se quito porque pasar de Typeform a Dapta exige que los dos reciban a
     * la vez, y Mani lo quiere como realidad permanente, no solo de migracion. El dedup no se
     * afloja: la identidad es `(program_id, email_normalizado)` del lead, no la fuente.
     */
    /**
     * Una fuente webhook sin proveedor no tiene adaptador que la lea (ADR 0055). El
     * `::text` no es adorno: la migracion agrega `webhook` al enum en la misma
     * transaccion, y Postgres no deja usar un valor de enum recien agregado antes del
     * commit; comparando como texto no lo usa.
     */
    check("sources_webhook_con_proveedor", sql`${t.tipo}::text <> 'webhook' OR ${t.proveedor} IS NOT NULL`),
    /** "Muerta" viene despues de "sin respuestas", o la marca intermedia nunca se veria (ticket 107). */
    check(
      "sources_umbrales_en_orden",
      sql`${t.umbralSinRespuestaHoras} > 0 AND ${t.umbralMuertaHoras} > ${t.umbralSinRespuestaHoras}`,
    ),
    /** A lo sumo una fuente principal por programa (ADR 0068 punto 2, ADR 0005). */
    uniqueIndex("sources_una_principal_por_programa_idx").on(t.programId).where(sql`${t.principal}`),
    /** Una principal siempre se puede repartir: activa y con URL publica (ADR 0068 punto 2). */
    check(
      "sources_principal_repartible",
      sql`NOT ${t.principal} OR (${t.activo} AND ${t.urlPublica} IS NOT NULL)`,
    ),
  ],
);

// ─────────────────────────────────────────────────────────── personas

export const leads = pgTable(
  "leads",
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
    // Sin UTM a proposito (ADR 0060, ticket 115): el origen es de cada envio
    // (`submissions`) y el de un deal es el envio que lo abrio. Un resumen por lead
    // mezclaba campos de clics distintos en una combinacion que nadie hizo.
    fechaPrimeraAplicacion: timestamp("fecha_primera_aplicacion", { withTimezone: true }),
    fechaUltimaAplicacion: timestamp("fecha_ultima_aplicacion", { withTimezone: true }),
    /** Cuantas veces aplico la misma persona. Senal de intensidad, no personas distintas. */
    numAplicaciones: integer("num_aplicaciones").notNull().default(1),
    /**
     * El estado con el que la hoja clasifica al lead (ADR 0032). Es TEXTO y no un
     * enum porque **el codigo no decide nada segun su valor**: lo escribe el sync
     * copiandolo del formulario y lo lee una pantalla. Un enum obligaria a una
     * migracion cada vez que el negocio agregue una casilla al formulario, que es
     * justo lo que el ADR 0012 manda evitar cuando el valor es una instancia.
     *
     * Es la direccion contraria a `deals.etapa`, que SI es enum: ahi todo decide
     * con el valor. No se contradicen; contestan la misma pregunta sobre datos
     * distintos.
     */
    estado: text("estado").notNull().default("cola_setteo"),
    /**
     * Por donde entro la persona: por el formulario o creada a mano en el CRM (alta
     * manual, ADR 0044 punto 3). Es un tipo, no una fila: el conteo de leads contra la
     * meta de leads por dia (`leadsDelRango`) cuenta solo las del formulario.
     * **No es la llave de ningun costo** (ADR 0044 punto 5, ticket 087): con el link del
     * closer, un lead de Comercial tambien entra por el formulario. El denominador de un
     * costo por X es el area que resuelve `emparejar` (`lib/atribucion/`), por token
     * (DP-11); lo construye el 123.
     */
    entrada: entradaPersonaEnum("entrada").notNull().default("formulario"),
    /**
     * Resumen, igual que las fechas: la calificacion y el puntaje del envio que decide
     * (el completo mas reciente; si solo hay parciales, el ultimo). Los recalcula la
     * ingesta desde `submissions`, nunca se teclean. La calificacion es texto (ticket
     * 117) y desde el ADR 0069 no decide nada: la etapa de entrada sale de la agenda y la
     * calidad del envio que dispara la regla (`lib/ingesta/etapa-de-entrada.ts`).
     */
    calificacion: text("calificacion"),
    puntaje: integer("puntaje"),
    leadQuality: text("lead_quality"),
    leadValue: text("lead_value"),
    motivoDescarte: text("motivo_descarte"),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
    /** Fila original tal como vino de la hoja, para auditar sin volver a Sheets. */
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leads_programa_email_idx").on(t.programId, t.emailNormalizado),
    index("leads_programa_estado_idx").on(t.programId, t.estado),
    index("leads_cohorte_idx").on(t.cohortId),
  ],
);

// ─────────────────────────────────────────────────────────── contactos del lead

/**
 * Los correos y telefonos de un Lead (ADR 0035 punto 3). Hoy un lead tenia UN
 * correo y UN telefono, los de su ultima fila del formulario; las hojas dicen que
 * eso no alcanza.
 *
 * Cada contacto sabe **de que envio llego**, asi que "¿desde cuando tenemos este
 * numero?" es una consulta y no arqueologia sobre `raw`.
 *
 * `programId` esta DENORMALIZADO desde el lead a proposito: el unico de ADR 0035
 * es `(program_id, tipo, valor)` y un indice unico necesita columnas, no un join.
 * Es la misma redundancia declarada que ya tiene `leads.emailNormalizado`, y la
 * escribe solo el sistema.
 *
 * 🩸 Por que el unico va por programa y no global: la misma persona en dos
 * programas son DOS leads y no se deduplican entre si (ADR 0035 punto 2). Un unico
 * global sobre el telefono haria imposible que existiera en los dos.
 *
 * ⚠️ `confirmado` es la marca de "unido por telefono" del ADR 0035 punto 4: un
 * telefono que aparecio con un correo distinto entra sin confirmar y un gerente
 * resuelve. **Queda abierto donde se registra QUIEN confirmo**: el ADR lo exige y
 * este ticket solo crea el esquema. Lo decide E3-3, que es quien escribe la union;
 * inventar aqui una columna para un flujo que todavia no existe seria abstraccion
 * especulativa (ADR 0006).
 */
export const leadContactos = pgTable(
  "lead_contactos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    tipo: tipoContactoEnum("tipo").notNull(),
    /** El valor ya normalizado: correo en minusculas, telefono en digitos. */
    valor: text("valor").notNull(),
    /**
     * De que envio llego este contacto. `restrict` porque borrar el envio perderia
     * la unica respuesta a "¿desde cuando lo tenemos?" (criterio del ADR 0026).
     * Nulo para los contactos de un lead creado a mano, que no vino de un envio.
     */
    submissionId: uuid("submission_id").references((): AnyPgColumn => submissions.id, {
      onDelete: "restrict",
    }),
    esPrincipal: boolean("es_principal").notNull().default(false),
    confirmado: boolean("confirmado").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lead_contactos_valor_idx").on(t.programId, t.tipo, t.valor),
    index("lead_contactos_lead_idx").on(t.leadId),
  ],
);

// ─────────────────────────────────────────────────────────── envios

/**
 * El Envio: una fila por cada vez que alguien lleno el formulario, parcial o
 * completo (ADR 0036). Es el HECHO; el Lead es la persona que lo produjo.
 *
 * Medido el 21-sep: hoy el CRM guarda 4.791 filas donde hubo **6.233 hechos**.
 * 1.146 personas aplicaron mas de una vez y de todas ellas solo sobrevive la
 * ultima. Esta tabla es la que recupera ese historial.
 *
 * **Las ~10 columnas promovidas NO se repiten dentro de `respuestas`** (opcion A'
 * del ADR 0036, correccion de Mani sobre la propuesta original): la union de las
 * dos piezas es la fila completa, nada dos veces. Una copia que nadie declara es
 * una copia que se desincroniza, y este repo ya tiene un ADR entero sobre eso
 * (0024).
 *
 * Un campo se promueve solo si el codigo decide, filtra, indexa o cruza con el. Lo
 * demas entra a `respuestas` con el texto del encabezado como llave, asi que una
 * columna nueva en la hoja **aparece sola** y los envios viejos la tienen ausente.
 */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * 🎯 NULLABLE, y no es un descuido. Typeform escribe una fila cuando alguien
     * EMPIEZA el formulario, y un parcial abandonado antes de la pregunta del
     * correo no tiene a que lead colgarse. Ese envio es un hecho real ("alguien
     * abrio el formulario y se fue"), y con `notNull` el sync tendria que tirarlo
     * en silencio, que es justo la clase de perdida invisible de la que este repo
     * ya sangro con el centinela del ano 1.
     *
     * `restrict`: un lead con envios no se borra, o se pierde su historial.
     */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "restrict" }),
    /**
     * De que intake salio. `restrict` por el ADR 0039: `Forms viejo` se queda como
     * fuente INACTIVA justo para que los envios que la etapa 7 recupere apunten a
     * algo que diga la verdad sobre de donde salieron.
     */
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
    /** El Token de Typeform, o el id del webhook cuando entre Dapta (ADR 0036). */
    token: text("token").notNull(),
    esParcial: boolean("es_parcial").notNull().default(false),
    fechaEnvio: timestamp("fecha_envio", { withTimezone: true }),
    /** El `estado` tal como lo escribio la hoja, sin interpretar (ADR 0032). */
    estadoHoja: text("estado_hoja"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    /**
     * El nombre que la persona escribio en ESTE envio. Promovido porque el resumen del
     * lead (`leads.nombre`, lo que busca Personas) se recalcula desde los envios
     * guardados, y `respuestas` no dice cual pregunta es la del nombre (migracion 0033).
     */
    nombre: text("nombre"),
    /**
     * Las otras tres UTM de la plantilla de Pauta (ADR 0062, ticket 116), promovidas por la ingesta
     * y guardadas **como llegaron**, macro sin expandir incluida (`{{ad.name}}`, ADR 0004).
     *
     * - `utmId`: el id del anuncio de Meta, la llave hacia el arbol y el gasto (120).
     * - `utmTerm` y `utmContent` los interpreta SOLO `lib/atribucion/` (ADR 0062, ticket 085): su
     *   significado lo declara el formato del Canal (en `paid_social`, anuncio y placement; en el
     *   `facebook / cpc` historico, conjunto y anuncio; en `closer / referido`, el codigo del
     *   closer). El guardian de `tests/atribucion-emparejador.test.ts` falla si alguien las lee
     *   por fuera.
     *
     * Hasta el 116 (30-sep) el webhook las dejaba en `respuestas`; la migracion 0048 relleno las
     * columnas desde ahi. `utmsDelEnvio` sigue leyendo la llave de `respuestas` si la columna falta.
     */
    utmId: text("utm_id"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
    /**
     * 🩸 El orden de los envios se decide por AQUI y no por `fechaEnvio`: los
     * parciales de Typeform traen una fecha placeholder (la misma familia del
     * `1/1/0001` que ya envenenó el dedup). La posicion en la hoja no miente.
     * Nulo para lo que entre por webhook, que no tiene hoja.
     */
    posicionEnHoja: integer("posicion_en_hoja"),
    /**
     * La variable `estado` que mando el formulario, ya con el hecho de agendar aplicado
     * (`con_calendly` si la pregunta de agenda trae link). Es TEXTO (ticket 117) y se guarda
     * como llego (ADR 0004). Desde el ADR 0069 solo se lee el hecho de agendar
     * (`agendoElEnvio`); el resto del valor ya no decide nada. Nulo si llego vacio: nunca se
     * rellena con un supuesto.
     */
    calificacion: text("calificacion"),
    /** El puntaje (T4) y la version de los pesos que lo produjo. Nulos sin pesos. */
    puntaje: integer("puntaje"),
    versionPuntaje: integer("version_puntaje"),
    /** Etiquetas calculadas por Typeform; el CRM las recibe y muestra sin interpretarlas. */
    leadQuality: text("lead_quality"),
    leadValue: text("lead_value"),
    /** Todas las columnas NO promovidas, con el texto del encabezado como llave. */
    respuestas: jsonb("respuestas"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * Un envio por fuente, token y parcialidad. La fuente va adentro porque quien
     * garantiza la unicidad del token es **la fuente que lo emite**: dos formularios
     * distintos podrian repetir una cadena y un unico global rechazaria un envio
     * legitimo.
     *
     * 🩸 `es_parcial` va adentro desde la 0022. Typeform escribe la parcial y la
     * completa con el MISMO token (880 tokens en uno de los programas, medido el 20-sep), y el
     * ADR 0036 punto 4 manda guardar las dos. Con `(source_id, token)` la segunda
     * chocaba con la primera: el traslado desde la hoja habria reventado o, con un
     * upsert, la completa habria pisado a la parcial y el evento "inicio el form"
     * desaparecia sin un error. Dos parciales del mismo token son VERSIONES del
     * mismo envio: la ingesta las funde (gana la ultima), no son dos hechos.
     */
    uniqueIndex("submissions_fuente_token_idx").on(t.sourceId, t.token, t.esParcial),
    index("submissions_lead_idx").on(t.leadId),
  ],
);

/**
 * El cuerpo de CADA envio de webhook que llego con la firma buena, tal como llego
 * (Mani, 28-sep; migracion 0034). Es la caja negra: pase lo que pase con el adaptador
 * (una variable nueva, un tipo de pregunta desconocido), el payload original queda y se
 * puede reprocesar. `error` nulo = se proceso bien; con texto = NO se pudo procesar
 * (contenido malo, sin correo, o la ingesta fallo; ticket 106, Mani 27-sep) y la ruta
 * respondio 200 igual, para que el proveedor no reintente en bucle y el lead no se pierda.
 *
 * `cuerpo` es texto y no jsonb a proposito: lo que no se pudo leer puede no ser JSON, y
 * la firma se calcula sobre los bytes exactos.
 *
 * `restrict`: una fuente con sobres no se borra, se desactiva (ADR 0026).
 *
 * Desde la 0039 (ticket 096) guarda tambien los eventos del webhook de CALENDLY, que no
 * son de una fuente sino del programa: `origen = 'calendly'` y `source_id` nulo, y el
 * CHECK ata las dos cosas. `program_id` va en todos (denormalizado, como en
 * `entregas_webhook`): el programa es frontera.
 */
export const sobresCrudos = pgTable(
  "sobres_crudos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "restrict" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "restrict" }),
    /** `formulario` (Typeform, con su fuente) o `calendly` (del programa, sin fuente). */
    origen: text("origen").notNull().default("formulario"),
    cuerpo: text("cuerpo").notNull(),
    /** Nulo = se proceso bien. Con texto = por que no se pudo procesar. */
    error: text("error"),
    recibidoEn: timestamp("recibido_en", { withTimezone: true }).notNull().defaultNow(),
    /** Nulo mientras nadie lo haya reprocesado. Lo cuenta el aviso de la fuente (107). */
    reprocesadoEn: timestamp("reprocesado_en", { withTimezone: true }),
  },
  (t) => [
    // Pendiente = fallo y nadie lo reproceso. Los que entraron bien no son pendientes.
    index("sobres_crudos_pendientes_idx")
      .on(t.sourceId)
      .where(sql`${t.error} is not null and ${t.reprocesadoEn} is null`),
    check(
      "sobres_crudos_origen_chk",
      sql`(${t.origen} = 'formulario' AND ${t.sourceId} IS NOT NULL) OR (${t.origen} = 'calendly' AND ${t.sourceId} IS NULL)`,
    ),
  ],
);

/**
 * Cada entrega que toca la ruta del webhook, aceptada o rechazada (ticket 110, pedido
 * de Mani del 28-sep): la hora, el codigo HTTP que se respondio, el motivo y, si hubo,
 * el lead. Es lo que antes solo vivia en los logs de Vercel.
 *
 * - Un rechazo (404, 401) se registra **sin cuerpo**: `sobre_id` nulo. `source_id` y
 *   `program_id` quedan nulos si el id de la URL no es una fuente; esas entregas no son
 *   de ningun programa.
 * - `program_id` va denormalizado a proposito (como `lead_contactos`): la pantalla es
 *   por programa y el programa es frontera.
 * - Registrar la entrega NUNCA tumba la ingesta (mismo principio que la caja negra,
 *   ADR 0058). Los rechazos se purgan a los 90 dias; las aceptadas quedan con su sobre.
 */
export const entregasWebhook = pgTable(
  "entregas_webhook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "restrict" }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "restrict" }),
    sobreId: uuid("sobre_id").references(() => sobresCrudos.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    codigoHttp: integer("codigo_http").notNull(),
    motivo: motivoEntregaEnum("motivo").notNull(),
    recibidoEn: timestamp("recibido_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entregas_webhook_programa_idx").on(t.programId, t.recibidoEn),
    index("entregas_webhook_recibido_idx").on(t.recibidoEn),
    check("entregas_webhook_codigo_chk", sql`${t.codigoHttp} in (200, 401, 404)`),
  ],
);

// ─────────────────────────────────────────────────────────── deals

/**
 * El Deal: la oportunidad de venderle un programa a un Lead (ADR 0037). Es el
 * objeto central del CRM y **es tambien la venta**: cohorte, owner y
 * fechas viven aqui, y por eso `sales` se disuelve (ticket 038).
 *
 * El ticket lo da la cohorte. Al vender se congela el total como ticket menos
 * descuento en `valorVendidoUsd`; cambiar después el precio de la cohorte no mueve
 * lo que ya se vendió.
 *
 * Derivados, nunca almacenados (ADR 0037 punto 6, ADR 0024): `abonado`, `saldo`,
 * `es_student` (`etapa in (ganado_parcial, ganado_completo)`) y la comision.
 *
 * ⚠️ `etapa` **no se escribe a mano desde ninguna parte**: el unico camino es
 * `moverEtapa()` de la etapa 2, que valida y escribe `dealEtapaHistorial`. Es la
 * redundancia declarada del modelo (la etapa frente a la suma de abonos) y solo no
 * diverge porque la escribe el sistema.
 */
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "restrict" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "restrict" }),
    /**
     * El dueno de la OPORTUNIDAD (ADR 0037, enmienda al ADR 0021). Es FK real a
     * `users` y no el texto copiado del ADR 0011: quien trabaja un deal es siempre
     * una cuenta de la app.
     *
     * Nulo = **Unclaimed**, un estado de primera clase: los deals nacen sin dueno y
     * el closer reclama. El reparto ciego del script desaparece.
     */
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "restrict" }),
    /**
     * El credito del setter (ADR 0076 punto 3): el dueno anterior cuando una cita pasa el
     * deal a quien da la llamada. Se escribe UNA vez (un re-agendamiento no lo pisa) y
     * solo lo escribe `darDealAlHost`. Nulo = el deal llego agendado o nadie lo setteo.
     */
    setterUserId: uuid("setter_user_id").references(() => users.id, { onDelete: "restrict" }),
    /**
     * Cuando el setter marco "Link enviado" (ADR 0076 punto 1). El deal sigue siendo suyo;
     * con esta marca y sin llamada vigente, a 1 dia habil sale la alerta.
     */
    handoffEn: timestamp("handoff_en", { withTimezone: true }),
    etapa: etapaDealEnum("etapa").notNull().default("registrado"),
    /**
     * El Pendiente del deal (ADR 0070): nulo = ninguno. Poner uno no mueve la etapa y todo
     * cambio de etapa lo limpia. Sus datos viven en `fechaSeguimiento`, `cohorteDestinoId`
     * y el motivo de la fila del historial que lo puso. Como `etapa`, solo lo escribe
     * `moverEtapa()`.
     */
    pendiente: pendienteDealEnum("pendiente"),
    /**
     * El acuerdo de pago, como lo conversaron (ADR 0053): *"el otro 30% en tal fecha y
     * el 20% en tal otra"*. Texto libre y opcional: no hay cuotas en v1.
     */
    acuerdoPago: text("acuerdo_pago"),
    /**
     * La fecha limite de pago (ADR 0053). Es la "fecha prometida" que exige Compromiso
     * Verbal, y la cartera vencida es saldo > 0 con esta fecha pasada.
     * Fecha de negocio de Bogota: `date`, sin hora.
     */
    fechaLimitePago: date("fecha_limite_pago"),
    /** Cuando hay que volver a contactarlo: lo exige el pendiente Seguimiento (ADR 0070). */
    fechaSeguimiento: date("fecha_seguimiento"),
    /** Motivo del Cierre Perdido (catalogo, ADR 0015). Obligatorio al cerrar, no aqui. */
    motivoId: uuid("motivo_id").references(() => motivos.id, { onDelete: "restrict" }),
    /** El envio que origino el deal, para atribuir su UTM sin adivinar. */
    submissionOrigenId: uuid("submission_origen_id").references(
      (): AnyPgColumn => submissions.id,
      { onDelete: "restrict" },
    ),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    /**
     * Proxima Cohorte guarda las DOS cohortes (Mani, 27-sep, ticket 103): `cohortId`
     * sigue siendo la de origen, asi su conversion no pierde el deal, y esta es a la
     * que va (pendiente Proxima Cohorte, ADR 0070 punto 8).
     */
    cohorteDestinoId: uuid("cohorte_destino_id").references(() => cohorts.id, {
      onDelete: "restrict",
    }),
    /**
     * El area que dice el closer ("¿como nos conociste?", ticket 121, ADR 0062 punto 5).
     * La exige el motor al entrar a Compromiso Verbal, Ganado Pago Parcial o Ganado Pagado Completo; un deal
     * historico (con `huellaMigracion`) queda exento. **No es atribucion y nunca se
     * mezcla con el UTM**: solo alimenta la burbuja "sin UTM · segun el comercial".
     */
    areaDeclaradaId: uuid("area_declarada_id").references((): AnyPgColumn => areas.id, {
      onDelete: "restrict",
    }),
    /**
     * Lo que de verdad se vendió, en USD: ticket de la cohorte menos el descuento
     * escrito por el closer. Se congela al vender; de aquí salen saldo y Completo.
     */
    valorVendidoUsd: numeric("valor_vendido_usd", { precision: 10, scale: 2 }),
    /**
     * El % de comision CONGELADO al entrar a venta por primera vez (ticket 133, ADR 0065 punto
     * 7): copia del de su programa en ese momento, que no se pisa si el deal sale y vuelve. La
     * comision = valor vendido × este % / 100, calculada en `lib/queries/comision.ts`; el
     * monto nunca se guarda. Nulo = el programa no tenia % cargado al vender.
     */
    comisionPorcentaje: numeric("comision_porcentaje", { precision: 5, scale: 2 }),
    /**
     * Cortesia (ADR 0071 punto 10): un deal con 100% de descuento. Es Student como
     * cualquiera, pero no cuenta en ventas, ni en la tasa de cierre, ni en la comision, y
     * se ve aparte. El motor acepta valor vendido 0 SOLO con esta marca.
     */
    cortesia: boolean("cortesia").notNull().default(false),
    /**
     * Quien lo creo. **Nulo significa el sync**, igual que `changeLog.userId`: en
     * un movimiento del sistema no hay usuario, y un id inventado ahi seria peor
     * que la ausencia.
     */
    creadoPor: uuid("creado_por").references(() => users.id, { onDelete: "restrict" }),
    /**
     * Anulacion (ADR 0026, extendido a `deals` por el ADR 0038). **Anular NO es
     * Cierre Perdido y por eso no es una etapa numero 11.**
     *
     * Son dos hechos distintos: Cierre Perdido es un resultado del negocio (el lead
     * dijo que no) y CUENTA en el embudo; anulado es una correccion de tecleo (el
     * registro nunca debio existir) y no cuenta en NINGUNA metrica.
     *
     * 🩸 Si se fundieran, un error de dedo se convertiria en una venta perdida y la
     * tasa de conversion mentiria. Y como es una marca ORTOGONAL y no una etapa, al
     * anular no se pierde el dato de en que etapa estaba el deal cuando se descubrio
     * el error.
     */
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    anuladoPor: uuid("anulado_por").references(() => users.id, { onDelete: "restrict" }),
    motivoAnulacion: text("motivo_anulacion"),
    /**
     * La fila de la hoja de la que salio un deal historico (ADR 0059 punto 2):
     * `sheets:<programa>:<pestaña>:<llave>`. Nulo para todo deal nativo del CRM.
     *
     * 🩸 Un deal en Completo **no ocupa el cupo** del lead, asi que sin esta huella una
     * segunda corrida de la migracion lo duplicaria sin un solo error. La garantia es
     * el indice unico de abajo, no un `select` previo (ADR 0005).
     */
    huellaMigracion: text("huella_migracion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("deals_valor_vendido_no_negativo", sql`${t.valorVendidoUsd} IS NULL OR ${t.valorVendidoUsd} >= 0`),
    check(
      "deals_comision_porcentaje_rango",
      sql`${t.comisionPorcentaje} IS NULL OR (${t.comisionPorcentaje} >= 0 AND ${t.comisionPorcentaje} <= 100)`,
    ),
    uniqueIndex("deals_huella_migracion_idx")
      .on(t.huellaMigracion)
      .where(sql`${t.huellaMigracion} is not null`),
    /**
     * **Maximo un deal ABIERTO por lead y programa** (ADR 0037 punto 1). Indice
     * unico PARCIAL, mismo molde que `cohorts_una_activa_por_programa_idx`: la
     * garantia vive en la base y no en el codigo (ADR 0005).
     *
     * Los cerrados no compiten, y eso es el punto: reaplicar despues de un Cierre
     * Perdido **abre un deal nuevo** y la ficha muestra los anteriores. "Volvio a
     * intentarlo en la cohorte siguiente" pasa a ser un hecho contable en vez de
     * una sobreescritura.
     *
     * 🎯 Y lleva `AND anulado_en IS NULL`, que NO es un detalle: un deal anulado es
     * un registro que nunca debio existir (ADR 0038), asi que no puede seguir
     * ocupando el cupo del lead. Sin esa mitad, un closer que se equivoca de lead y
     * anula el deal **no puede crear el correcto**: la base se lo rechaza por un
     * registro que la app ya declaro inexistente.
     */
    uniqueIndex("deals_uno_abierto_por_lead_y_programa_idx")
      .on(t.leadId, t.programId)
      .where(sql`${t.etapa} not in ('ganado_completo', 'cierre_perdido') and ${t.anuladoEn} is null`),
    index("deals_programa_etapa_idx").on(t.programId, t.etapa),
    index("deals_owner_idx").on(t.ownerUserId),
    index("deals_cohorte_idx").on(t.cohortId),
    // Sin motivo no hay anulacion (ADR 0026 punto 6), y la garantia vive en la base
    // y no solo en zod (ADR 0005): los tres campos van juntos o no va ninguno. Una
    // fila anulada sin quien ni por que es justo el estado que el ADR descarta.
    check(
      "deals_anulacion_completa",
      sql`(${t.anuladoEn} IS NULL AND ${t.anuladoPor} IS NULL AND ${t.motivoAnulacion} IS NULL)
          OR (${t.anuladoEn} IS NOT NULL AND ${t.anuladoPor} IS NOT NULL
              AND length(trim(${t.motivoAnulacion})) > 0)`,
    ),
  ],
);

/**
 * Todo movimiento de etapa de un deal (ADR 0037 punto 4, ADR 0042).
 *
 * 🎯 **Se crea AHORA aunque la pantalla no exista.** El dato es el INSTANTE del
 * cambio y no se guarda en ninguna otra parte: sin esta tabla no hay conversion
 * etapa a etapa ni tiempo en etapa, y **no se pueden reconstruir despues**. Es el
 * mismo argumento del ADR 0029 con los 5 enlaces de PayPal que entraron sin rastro
 * el 18-sep y siguen sin el a proposito.
 *
 * Esto NO va a `change_log` (ADR 0042): no es "un campo cambio de X a Y" sino el
 * hecho central del que salen las dos metricas de arriba. Duplicarlo en los dos
 * rastros crearia la divergencia que el invariante 1 del plan prohibe.
 */
export const dealEtapaHistorial = pgTable(
  "deal_etapa_historial",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "restrict" }),
    /** Nulo solo en la primera fila: el deal no venia de ninguna etapa. */
    de: etapaDealEnum("de"),
    a: etapaDealEnum("a").notNull(),
    /**
     * El Pendiente antes y despues del movimiento (ADR 0070 punto 5). Poner, cambiar o
     * quitar un pendiente es un movimiento aunque la etapa no cambie: de aqui sale
     * "cuantos deals pasaron por Re-agenda" y cuanto tardaron.
     */
    pendienteDe: pendienteDealEnum("pendiente_de"),
    pendienteA: pendienteDealEnum("pendiente_a"),
    /** Nulo = lo movio el sistema (el sync, o un abono registrado). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }),
    /** Obligatorio para un retroceso y para el Cierre Perdido; lo exige el motor. */
    motivoId: uuid("motivo_id").references(() => motivos.id, { onDelete: "restrict" }),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deal_etapa_historial_deal_idx").on(t.dealId, t.fecha)],
);

/**
 * Contactos y notas sobre un deal (ADR 0037). Un `contacto` con fecha es lo que
 * habilita la entrada a En Contacto; una `nota` no mueve nada.
 *
 * ⚠️ `canal` es texto por ahora y **esa es una pregunta abierta**: si el equipo
 * tiene que elegirlo de una lista, pasa a ser catalogo del molde (ADR 0012). Se
 * decide en la etapa 4, con la pantalla delante; hoy no hay pantalla que lo llene.
 */
export const dealActividades = pgTable(
  "deal_actividades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "restrict" }),
    tipo: tipoActividadEnum("tipo").notNull(),
    canal: text("canal"),
    /**
     * Quien la registro. Nulo = el SISTEMA (migracion 0032), como en
     * `deal_etapa_historial.user_id` y `deals.creado_por`: la regla de deals (052) deja
     * una nota cuando la cita de Calendly no esta vigente. El sistema solo deja NOTAS:
     * un contacto siempre es de una persona, y el CHECK de abajo lo garantiza.
     */
    userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    nota: text("nota"),
  },
  (t) => [
    index("deal_actividades_deal_idx").on(t.dealId, t.fecha),
    check("deal_actividades_contacto_con_usuario", sql`${t.tipo} <> 'contacto' OR ${t.userId} IS NOT NULL`),
  ],
);

/**
 * Las cuotas PACTADAS de un deal (ADR 0041). Cada una con SU monto y SU fecha.
 *
 * 🩸 Por que filas y no `num_cuotas` + una division: la division asume que las
 * cuotas son iguales, y en el momento en que un plan real no lo sea el numero **es
 * falso y no lanza ningun error**. El closer ve "faltan 2 de USD 350" cuando lo
 * pactado fue una de 500 y una de 200, y persigue la plata equivocada.
 *
 * Una cuota es lo **prometido**; un abono es lo **recibido**. No se derivan uno del
 * otro, igual que caja recaudada y ventas cerradas (ADR 0013). Lo abonado y el
 * saldo viven en UN modulo (ADR 0024), `lib/queries/saldo.ts`, que salio con el corte
 * de la migracion 0020 y lo recrea el ticket 060 sobre el deal.
 *
 * El deal NO lleva `num_cuotas`: es `count()` sobre esta tabla.
 *
 * `moneda` vive al lado del monto y nunca se convierte en silencio (restriccion
 * dura de AGENTS.md), igual que en `abonos`.
 */
export const cuotasPactadas = pgTable(
  "cuotas_pactadas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "restrict" }),
    numero: integer("numero").notNull(),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    moneda: text("moneda").notNull().default("USD"),
    fechaPactada: date("fecha_pactada").notNull(),
    /**
     * El abono que cumplio esta cuota. `set null` y no `restrict`: cuando un abono
     * se anula (ADR 0026) la cuota vuelve a estar PENDIENTE, que es exactamente lo
     * que dice el ADR 0041. Aqui la referencia si es opcional de verdad.
     */
    abonoId: uuid("abono_id").references((): AnyPgColumn => abonos.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("cuotas_pactadas_numero_idx").on(t.dealId, t.numero),
    // La cartera vencida pregunta por esto: cuotas con fecha pasada y sin abono.
    index("cuotas_pactadas_vencimiento_idx").on(t.fechaPactada),
  ],
);

// ─────────────────────────────────────────────────────────── llamadas

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * La llamada cuelga del DEAL, no de la persona (ADR 0037, enmienda al ADR 0010).
     * Una llamada es trabajo sobre una oportunidad concreta, y colgarla de la
     * persona hacia imposible saber a cual de sus deals pertenecia.
     *
     * Nullable mientras la etapa 4 no reescriba el registro y la etapa 7 no migre
     * lo historico: las llamadas de la hoja vieja pueden no tener deal al que
     * apuntar. `restrict` porque borrar un deal con llamadas perderia historia.
     */
    dealId: uuid("deal_id").references((): AnyPgColumn => deals.id, { onDelete: "restrict" }),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    /** Nombre del closer tal como aparece en la hoja. Se cruza contra users.closerId. */
    closerId: text("closer_id"),
    /**
     * Quien tomo la llamada, como FK real a `users` (ticket 057). `closerId` queda
     * solo para lo que llega de la hoja: el texto copiado repite el ADR 0030. Nulo
     * mientras la llamada este sin reclamar (la agendada que crea el sistema).
     */
    closerUserId: uuid("closer_user_id").references(() => users.id, { onDelete: "restrict" }),
    /** Link de la cita en Calendly, que completa el closer al reclamar (ticket 057). */
    linkCalendly: text("link_calendly"),
    /** Link de la grabacion. Pegarlo ES decir que la llamada sucedio (ticket 058). */
    linkGrain: text("link_grain"),
    /**
     * El correo de la cuenta de Calendly que hospeda la cita (ticket 096): decide el dueño del
     * deal (la closer host) y se muestra en la llamada suelta. Nulo para lo que no viene de Calendly.
     */
    calendlyHostEmail: text("calendly_host_email"),
    emailLead: text("email_lead"),
    fechaAgenda: timestamp("fecha_agenda", { withTimezone: true }),
    fechaLlamada: timestamp("fecha_llamada", { withTimezone: true }),
    resultado: resultadoLlamadaEnum("resultado").notNull().default("agendada"),
    motivoPerdida: text("motivo_perdida"),
    /** Fecha prometida de un compromiso de pago o nueva cita de una reagendada (ADR 0015). */
    fechaSeguimiento: timestamp("fecha_seguimiento", { withTimezone: true }),
    /** Motivo de perdida como catalogo (ADR 0015). `motivoPerdida` queda solo para filas viejas de Sheets. */
    motivoId: uuid("motivo_id").references(() => motivos.id, { onDelete: "restrict" }),
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
    index("calls_deal_idx").on(t.dealId),
    index("calls_closer_user_idx").on(t.closerUserId),
    uniqueIndex("calls_huella_idx").on(t.programId, t.huellaFila),
    // Sin motivo no hay anulacion (ADR 0026 punto 6), y la garantia vive en la base
    // y no solo en zod (ADR 0005): los tres campos van juntos o no va ninguno. Una
    // fila anulada sin quien ni por que es justo el estado que el ADR descarta.
    // Una llamada NATIVA del CRM siempre cuelga de un deal (ticket 057): la garantia vive en la
    // base y no solo en `agregarLlamada` (ADR 0005). Lo que viene de fuera puede no tenerlo: la
    // SUELTA de Calendly (ADR 0049 punto 6, hasta que un closer la asigna) y la historia de la hoja
    // (origen `sheets`, hasta que la migracion E7 la cuelgue o la deje como rareza).
    // ponytail: el techo es que ADR 0049 pide que la suelta sea la UNICA Call sin deal; cuando
    // termine E7 (ticket 082) y toda llamada de la hoja tenga deal, se aprieta a
    // `deal_id IS NOT NULL OR origen = 'calendly'` con una migracion (los datos ya lo cumplirian).
    check("calls_crm_con_deal", sql`${t.dealId} IS NOT NULL OR ${t.origen} <> 'crm'`),
    check(
      "calls_anulacion_completa",
      sql`(${t.anuladoEn} IS NULL AND ${t.anuladoPor} IS NULL AND ${t.motivoAnulacion} IS NULL)
          OR (${t.anuladoEn} IS NOT NULL AND ${t.anuladoPor} IS NOT NULL
              AND length(trim(${t.motivoAnulacion})) > 0)`,
    ),
  ],
);

// ─────────────────────────────────────────────────────────── abonos

/**
 * Un pago recibido sobre un deal (ADR 0013, ADR 0037). Un deal puede tener varios abonos;
 * la **caja recaudada** es la suma de `monto` por fecha del abono, y es una metrica
 * distinta de las ventas cerradas (nunca se deriva una de la otra).
 *
 * `onDelete: "restrict"` en `dealId`: no se puede borrar un deal que ya tiene
 * abonos registrados, para no perder caja huerfana.
 *
 * `moneda` vive al lado del monto para que nunca se convierta en silencio
 * (restriccion dura de AGENTS.md). Por decision de Michael (16-sep) hoy solo entra
 * `USD`; la columna se mantiene para que la moneda siga visible y el esquema zod
 * (`lib/abonos/esquema.ts`) la restringe.
 *
 * `registradoPorUserId` es la identidad de quien cobro (ticket 167). `closerId`
 * queda solo para reconocer la historia importada hasta que el ticket 159 lo retire.
 * `origen` distingue los abonos migrados de Sheets ('sheets') de los
 * nativos de la app ('app', ADR 0010).
 */
export const abonos = pgTable(
  "abonos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * El abono cuelga del DEAL: el deal ES la venta (ADR 0037 punto 5), asi que el
     * vinculo dejo de necesitar una tabla intermedia. `restrict` por la misma razon
     * de siempre: no se borra un deal que ya recibio plata.
     */
    dealId: uuid("deal_id").notNull().references((): AnyPgColumn => deals.id, { onDelete: "restrict" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    fecha: date("fecha").notNull(),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    moneda: text("moneda").notNull().default("USD"),
    plataformaId: uuid("plataforma_id").references(() => plataformasPago.id, { onDelete: "restrict" }),
    comprobanteUrl: text("comprobante_url"),
    /** Identidad de quien registro el abono. Nula solo para la historia pendiente de relleno. */
    registradoPorUserId: uuid("registrado_por_user_id").references(() => users.id, { onDelete: "restrict" }),
    /** Texto historico para el corte de datos; no identifica abonos nuevos. */
    closerId: text("closer_id"),
    origen: text("origen").notNull().default("app"),
    /** Anulacion (ADR 0026). Ver la nota completa en `calls`. */
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    anuladoPor: uuid("anulado_por").references(() => users.id, { onDelete: "restrict" }),
    motivoAnulacion: text("motivo_anulacion"),
    /** La fila de la hoja de la que salio un abono historico (ADR 0059). Ver `deals.huellaMigracion`. */
    huellaMigracion: text("huella_migracion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("abonos_huella_migracion_idx")
      .on(t.huellaMigracion)
      .where(sql`${t.huellaMigracion} is not null`),
    index("abonos_programa_fecha_idx").on(t.programId, t.fecha),
    index("abonos_deal_idx").on(t.dealId),
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

// ─────────────────────────────────────────────────────────── migracion

/**
 * Lo que la migracion de las pestañas de gestion no pudo clasificar (ticket 080, ADR
 * 0059): la lista visible en la app. **Una rareza no se anula** (de la hoja si paso,
 * ADR 0038) **y no se adivina** (ADR 0027): queda aqui, con su fila de origen, para
 * que alguien la corrija.
 *
 * - `huella` es la de la fila de la hoja (`sheets:<programa>:<pestaña>:<llave>`), la
 *   misma que llevan `deals`, `abonos` y `calls`: con ella se vuelve a la hoja.
 * - `tipo` es texto y no un `pgEnum`: la lista de casos la sigue cerrando el 080, y la
 *   pantalla solo agrupa y rotula por el. Los valores los fija el tipo del importador.
 * - Los enlaces a lo que SI entro son opcionales: una fila sin correo no tiene lead, y
 *   una con deal vivo no creo deal (ADR 0059 punto 3).
 * - Correr la migracion dos veces no duplica rarezas: indice unico `(huella, tipo)`.
 * - `program_id` va aparte de la huella porque la pantalla es por programa y el
 *   programa es frontera.
 */
export const rarezasMigracion = pgTable(
  "rarezas_migracion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "restrict" }),
    huella: text("huella").notNull(),
    tipo: text("tipo").notNull(),
    /** Que tiene de raro, en palabras, con el valor de la hoja que lo causo. */
    detalle: text("detalle").notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "restrict" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "restrict" }),
    abonoId: uuid("abono_id").references(() => abonos.id, { onDelete: "restrict" }),
    callId: uuid("call_id").references(() => calls.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rarezas_migracion_huella_tipo_idx").on(t.huella, t.tipo),
    index("rarezas_migracion_programa_idx").on(t.programId, t.tipo),
    check("rarezas_migracion_detalle_chk", sql`length(trim(${t.detalle})) > 0`),
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

/**
 * Legado: el sync de Sheets se retiro el 28-sep (ticket 108); la tabla queda como
 * historial de las corridas viejas y nadie escribe en ella. Una corrida de sync era
 * de un PROGRAMA, no de una fuente: un programa tiene varios formularios, se leen
 * TODOS juntos y se deduplica sobre el conjunto, porque si no `numAplicaciones`
 * dependeria del orden de ejecucion. Colgar la corrida de una fuente obligaba a
 * elegir una a dedo (`fuentes[0]`), y en un programa con dos formularios activos
 * eso atribuia cada corrida a UNO de ellos, el viejo de 65 personas (F-07).
 */
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    iniciado: timestamp("iniciado", { withTimezone: true }).notNull().defaultNow(),
    terminado: timestamp("terminado", { withTimezone: true }),
    estado: estadoSyncEnum("estado").notNull().default("corriendo"),
    filasLeidas: integer("filas_leidas").notNull().default(0),
    personasNuevas: integer("personas_nuevas").notNull().default(0),
    personasActualizadas: integer("personas_actualizadas").notNull().default(0),
    registrosNuevos: integer("registros_nuevos").notNull().default(0),
    /**
     * Que fuentes leyo la corrida y cuantas filas trajo cada una:
     * `[{ nombre, tab, filas }]`. Reemplaza al `source_id` unico, que solo podia
     * nombrar una de varias. El `tab` va aparte del `nombre` porque la pestana es
     * lo que se abre en Sheets cuando hay que revisar por que vino vacia.
     */
    fuentesLeidas: jsonb("fuentes_leidas"),
    errores: jsonb("errores"),
  },
  (t) => [
    index("sync_runs_programa_idx").on(t.programId, t.iniciado),
    // El candado de F-03. La exclusion mutua vive en la base (ADR 0005), no en un
    // `pg_advisory_lock`: con el pooler de Supabase en modo transaction un lock de
    // sesion no sobrevive entre consultas (ADR 0047). Indice unico PARCIAL, del mismo molde que
    // `cohorts_una_activa_por_programa_idx`: solo las filas 'corriendo' compiten,
    // y las 'ok'/'error' historicas no. El INSERT de la corrida ES el candado; un
    // segundo sync simultaneo chocaba con 23505 (el sync se retiro, ticket 108).
    uniqueIndex("sync_runs_una_corriendo_por_programa_idx")
      .on(t.programId)
      .where(sql`${t.estado} = 'corriendo'`),
  ],
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
     * los cambios de catálogo necesitan auditar quién creó cada fila. `set null`
     * para no perder la bitácora si algún
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
 * Que programas sirve cada plataforma de pago (ADR 0034). Tabla puente, no una
 * columna `program_id` en `plataformas_pago`, y la razon no es de estilo:
 *
 * `plataformas_pago` tiene un indice unico sobre `lower(nombre)` para que 'Paypal'
 * y 'PayPal' no partan las metricas en dos plataformas distintas. Una columna
 * `program_id` obligaria a aflojar ese indice a unico POR programa, y PayPal pasaria
 * a ser dos filas con dos ids: el dia que una consulta agrupe caja por plataforma
 * mostraria dos medios de pago donde hay uno, **sin lanzar ningun error**. Con la
 * tabla puente el indice queda intacto y PayPal sirviendo a los dos programas son
 * dos vinculos.
 *
 * Sin columna `activo`, a diferencia de `miembros_programa`: alli existe porque una
 * membresia se suspende sin perder el historial y `exigirAccesoAlPrograma` la
 * consulta. Aqui no hay nada que preguntar: una plataforma que deja de servir a un
 * programa simplemente no tiene el vinculo, y la fila no la referencia nadie.
 *
 * ⚠️ Lo que esta tabla NO puede garantizar: que toda plataforma tenga al menos un
 * vinculo (ADR 0034 punto 2). Al insertar la plataforma todavia no hay vinculo, asi que
 * esa cardinalidad minima vive en `lib/catalogo/plataformas.ts` y su esquema zod,
 * igual que `parsearEntradaUsuario` ya exige que un closer traiga al menos un
 * programa. La UNICIDAD si la garantiza la base, que es lo que manda el ADR 0005.
 */
export const plataformasPrograma = pgTable(
  "plataformas_programa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plataformaId: uuid("plataforma_id")
      .notNull()
      .references(() => plataformasPago.id, { onDelete: "cascade" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("plataformas_programa_par_idx").on(t.plataformaId, t.programId)],
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
    /** Todos los motivos que existian antes del 27-sep eran de perdida (ADR 0015). */
    tipo: tipoMotivoEnum("tipo").notNull().default("perdida"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // El mismo nombre puede vivir en dos listas ("Sin dinero" se pierde o se echa atras).
  (t) => [uniqueIndex("motivos_tipo_nombre_idx").on(t.tipo, sql`lower(${t.nombre})`)],
);

/**
 * Areas de Retia (ticket 083, ADR 0043): agrupan leads y deals por origen. Area NO
 * es rol. El area de un lead se deriva de su Canal (ticket 101), nunca se guarda en
 * leads ni deals. La unica excepcion es `deals.area_declarada_id` (ticket 121): lo que
 * DICE el closer, que no es atribucion.
 */
export const areas = pgTable(
  "areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("areas_nombre_idx").on(sql`lower(${t.nombre})`)],
);

/**
 * El formato de `utm_content` y `utm_term` en un Canal (ticket 101, DP-22). Es un
 * tipo y no una fila porque el emparejador decide con el (ADR 0012): dice EN QUE
 * CAMPO viene cada cosa, nunca que valores son validos. Nulo = el canal no declara
 * formato y esos dos campos se guardan sin interpretar.
 *   plantilla_pauta: content = anuncio, term = placement (plantilla de Pauta, ADR 0062)
 *   meta_historico:  content = conjunto, term = anuncio (`facebook / cpc` de Retia)
 *   closer:          content = codigo opaco del closer (ADR 0044, ticket 086)
 */
export const formatoUtmEnum = pgEnum("formato_utm", [
  "plantilla_pauta",
  "meta_historico",
  "closer",
]);

/**
 * Canales (ticket 101, ADR 0051 punto 2): un par `utm_source + utm_medium` con su
 * Area. Uno solo para todos los programas, porque la convencion de UTM es la misma
 * (Mani, 30-sep). `utm_source` nulo es el COMODIN: cualquier source con ese medium
 * (`paid_social` de Meta, cuyo source lo llena `{{site_source_name}}`). El par exacto
 * gana sobre el comodin, y el indice unico hace imposible el empate (ADR 0045).
 * Se compara con `lower(trim())`; el crudo del envio no se reescribe (ADR 0004).
 */
export const canales = pgTable(
  "canales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium").notNull(),
    areaId: uuid("area_id").notNull().references(() => areas.id, { onDelete: "restrict" }),
    formato: formatoUtmEnum("formato"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("canales_par_idx").on(
      sql`coalesce(lower(trim(${t.utmSource})), '')`,
      sql`lower(trim(${t.utmMedium}))`,
    ),
  ],
);

// ─────────────────────────────────────────────────────────── recursos y enlaces de pago

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
     * Una sola version VIGENTE por (programa, titulo). La garantia vive
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
 * `vigente` y `activo` significan lo mismo que en `recursos`.
 */
export const enlacesPago = pgTable(
  "enlaces_pago",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
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
export type EstadoFuente = (typeof estadoFuenteEnum.enumValues)[number];
export type Lead = typeof leads.$inferSelect;
export type NuevoLead = typeof leads.$inferInsert;
export type LeadContacto = typeof leadContactos.$inferSelect;
export type NuevoLeadContacto = typeof leadContactos.$inferInsert;
export type Envio = typeof submissions.$inferSelect;
export type NuevoEnvio = typeof submissions.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type NuevoDeal = typeof deals.$inferInsert;
export type EtapaDeal = (typeof etapaDealEnum.enumValues)[number];
export type MovimientoDeEtapa = typeof dealEtapaHistorial.$inferSelect;
export type ActividadDeDeal = typeof dealActividades.$inferSelect;
export type CuotaPactada = typeof cuotasPactadas.$inferSelect;
export type Llamada = typeof calls.$inferSelect;
export type Abono = typeof abonos.$inferSelect;
export type NuevoAbono = typeof abonos.$inferInsert;
export type Pauta = typeof adSpend.$inferSelect;
export type CorridaSync = typeof syncRuns.$inferSelect;
export type Cambio = typeof changeLog.$inferSelect;
export type PlataformaPago = typeof plataformasPago.$inferSelect;
export type PlataformaPrograma = typeof plataformasPrograma.$inferSelect;
export type Motivo = typeof motivos.$inferSelect;
export type Recurso = typeof recursos.$inferSelect;
export type EnlacePago = typeof enlacesPago.$inferSelect;
export type SobreCrudo = typeof sobresCrudos.$inferSelect;
export type EntregaWebhook = typeof entregasWebhook.$inferSelect;
