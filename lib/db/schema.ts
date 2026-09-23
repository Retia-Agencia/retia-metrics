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

export const rolEnum = pgEnum("rol", ["gerente", "closer", "developer"]);

/**
 * Las diez etapas del Deal (ADR 0037). Son un `pgEnum` —o sea TIPOS— y no un
 * catalogo editable, y eso NO contradice al ADR 0012: la regla de ese ADR es "si el
 * codigo decide segun el valor, es tipo", y aqui **todo** decide segun la etapa (el
 * embudo, quien es Student, la cartera vencida, los movimientos automaticos).
 *
 * Es la direccion contraria a `leads.estado`, que paso a texto por el ADR 0032
 * porque nadie decide con el. Las dos decisiones contestan la misma pregunta sobre
 * datos distintos.
 *
 * ⚠️ El orden de este arreglo es el de la tabla del ADR 0037 y **no es el orden de
 * un embudo**: `cierre_perdido` es alcanzable desde cualquier etapa y
 * `pendiente_reagenda` es un retroceso normal. Ninguna consulta debe comparar
 * etapas por su posicion.
 *
 * Lo adelanta este ticket (037) desde el 043, que es donde el plan lo tenia: una
 * columna no se puede declarar sin su tipo. La tabla de transiciones permitidas y
 * `moverEtapa()` siguen siendo de la etapa 2.
 */
export const etapaDealEnum = pgEnum("etapa_deal", [
  "pendiente_setteo",
  "en_contacto",
  "pendiente_reagenda",
  "agendado",
  "atendido",
  "compromiso_verbal",
  "abonado",
  "completo",
  "proxima_cohorte",
  "cierre_perdido",
]);

/**
 * Que clase de contacto es una fila de `lead_contactos` (ADR 0035). Es tipo y no
 * catalogo porque el codigo decide con el: el correo es la llave del dedup y el
 * telefono solo UNE Y MARCA.
 */
export const tipoContactoEnum = pgEnum("tipo_contacto", ["correo", "telefono"]);

/**
 * Que clase de actividad quedo registrada sobre un deal (ADR 0037). Es tipo porque
 * el codigo decide con el: un `contacto` con fecha es lo que habilita la entrada a
 * la etapa En Contacto; una `nota` no mueve nada.
 */
export const tipoActividadEnum = pgEnum("tipo_actividad", ["contacto", "nota"]);

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
    ultimaSync: timestamp("ultima_sync", { withTimezone: true }),
    activo: boolean("activo").notNull().default(true),
    orden: integer("orden").notNull().default(0),
  },
  (t) => [
    /**
     * **Un solo intake ACTIVO por programa** (ADR 0039 punto 2, insumo §2.10). La
     * garantia vive en la base y no en el codigo (ADR 0005), mismo molde que
     * `cohorts_una_activa_por_programa_idx`.
     *
     * PARCIAL y no unico a secas, por dos razones que no son comodidad:
     * - `Forms viejo` se queda como fuente INACTIVA, no se borra. Sus 55 personas
     *   exclusivas las recupera la etapa 7 **con sus envios**, y esos
     *   `submissions.source_id` necesitan apuntar a algo que diga la verdad sobre
     *   de donde salieron. Apuntarlos al formulario actual seria escribir un origen
     *   falso.
     * - Un formulario se reemplaza alguna vez (Typeform → Dapta). Con un unico a
     *   secas, cambiar de formulario obligaria a destruir el registro del anterior
     *   en el mismo movimiento.
     *
     * Lo que nunca puede existir son DOS intakes activos en el mismo programa: eso
     * duplica la superficie del dedup y es lo que hacia ambigua la atribucion de una
     * corrida (F-07, ADR 0031).
     *
     * ⚠️ En la migracion este indice se crea DESPUES de desactivar la fuente
     * vieja. Medido contra `dev` el 21-sep: uno de los dos programas tiene HOY
     * dos fuentes de leads activas, asi que al reves falla. Misma leccion que el
     * `CHECK` de la migracion 0009.
     */
    uniqueIndex("sources_una_activa_por_programa_idx")
      .on(t.programId)
      .where(sql`${t.activo} = true`),
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
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
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
     * ⚠️ `utmTerm` y `utmContent` existen pero estan DELIBERADAMENTE SIN LEER
     * (Mani, 21-sep; ADR 0045 enmienda 2). El estandar de UTM son TRES campos:
     * source, medium y campaign. No hay nivel de conjunto ni de anuncio, asi que
     * "que anuncio esta vendiendo" quedo FUERA DE ALCANCE, no pendiente.
     *
     * No se borran porque quitarlas cuesta una migracion sobre una tabla que ya
     * esta en `production` y volver a ponerlas costaria otra; el dato sigue en la
     * hoja si algun dia se quiere. **Cablearlas no tapa ningun hueco: no hay
     * hueco.** Si alguna vez entran, entran por una decision, no por un arreglo.
     */
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
    /**
     * 🩸 El orden de los envios se decide por AQUI y no por `fechaEnvio`: los
     * parciales de Typeform traen una fecha placeholder (la misma familia del
     * `1/1/0001` que ya envenenó el dedup). La posicion en la hoja no miente.
     * Nulo para lo que entre por webhook, que no tiene hoja.
     */
    posicionEnHoja: integer("posicion_en_hoja"),
    /** Todas las columnas NO promovidas, con el texto del encabezado como llave. */
    respuestas: jsonb("respuestas"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * Un envio por token y fuente. Va por `(source_id, token)` y no por `token` a
     * secas porque quien garantiza la unicidad del token es **la fuente que lo
     * emite**: dos formularios distintos podrian repetir una cadena y un unico
     * global rechazaria un envio legitimo. Con la fuente adentro no pueden chocar.
     */
    uniqueIndex("submissions_fuente_token_idx").on(t.sourceId, t.token),
    index("submissions_lead_idx").on(t.leadId),
  ],
);

// ─────────────────────────────────────────────────────────── deals

/**
 * El Deal: la oportunidad de venderle un programa a un Lead (ADR 0037). Es el
 * objeto central del CRM y **es tambien la venta**: producto, cohorte, owner y
 * fechas viven aqui, y por eso `sales` se disuelve (ticket 038).
 *
 * El ticket lo da el producto (`productoId → productos.precioLista`), sin
 * `precio_contrato`: 🩸 las hojas muestran ocho precios por descuentos y **cada
 * precio que el equipo use es un producto del catalogo**, que el equipo crea
 * (ADR 0016).
 *
 * Derivados, nunca almacenados (ADR 0037 punto 6, ADR 0024): `abonado`, `saldo`,
 * `es_student` (`etapa in (abonado, completo)`) y la comision.
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
    etapa: etapaDealEnum("etapa").notNull().default("pendiente_setteo"),
    productoId: uuid("producto_id").references(() => productos.id, { onDelete: "restrict" }),
    /** Motivo del Cierre Perdido (catalogo, ADR 0015). Obligatorio al cerrar, no aqui. */
    motivoId: uuid("motivo_id").references(() => motivos.id, { onDelete: "restrict" }),
    /** El envio que origino el deal, para atribuir su UTM sin adivinar. */
    submissionOrigenId: uuid("submission_origen_id").references(
      (): AnyPgColumn => submissions.id,
      { onDelete: "restrict" },
    ),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
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
      .where(sql`${t.etapa} not in ('completo', 'cierre_perdido') and ${t.anuladoEn} is null`),
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
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    nota: text("nota"),
  },
  (t) => [index("deal_actividades_deal_idx").on(t.dealId, t.fecha)],
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
 * dura de AGENTS.md), igual que en `abonos` y `productos`.
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
    index("calls_deal_idx").on(t.dealId),
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
 * `closerId` es texto copiado del closer logueado, no una relacion a `users`
 * (ADR 0011). `origen` distingue los abonos migrados de Sheets ('sheets') de los
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
 * Una corrida de sync es de un PROGRAMA, no de una fuente. Es la misma razon que
 * ya gobierna `lib/sheets/sync.ts`: un programa tiene varios formularios, se leen
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
    // El candado de F-03. Con `drizzle-orm/neon-http` cada consulta es su propia
    // sesion HTTP, asi que `pg_advisory_lock` no sirve: la exclusion mutua vive en
    // la base (ADR 0005). Indice unico PARCIAL, del mismo molde que
    // `cohorts_una_activa_por_programa_idx`: solo las filas 'corriendo' compiten,
    // y las 'ok'/'error' historicas no. El INSERT de la corrida ES el candado; un
    // segundo sync simultaneo choca con 23505 y `lib/sheets/sync.ts` lo traduce a
    // un 409 claro.
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
 * vinculo (ADR 0034 punto 2). Al insertar la plataforma todavia no hay vinculo y
 * `neon-http` no da transacciones interactivas para diferir la comprobacion, asi que
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
export type Origen = typeof origenes.$inferSelect;
export type Producto = typeof productos.$inferSelect;
export type CategoriaRecurso = typeof categoriasRecurso.$inferSelect;
export type Recurso = typeof recursos.$inferSelect;
export type EnlacePago = typeof enlacesPago.$inferSelect;
