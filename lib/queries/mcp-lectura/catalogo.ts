import type { AnclaDeFecha } from "@/lib/metricas/registro";

/**
 * El catálogo tipado de las vistas de `mcp_lectura` (ADR 0135): qué cuenta cada una, con qué fecha, y qué
 * significa cada columna. Es la ÚNICA copia del texto que ve el agente: `definiciones_de_metricas`, la fórmula
 * de cada `consultar_datos` y la documentación salen de aquí y del registro de métricas.
 * `tests/mcp-lectura-vistas.test.ts` compara las columnas de este catálogo con las de la base, en los dos sentidos.
 */

export const VISTAS_DE_LECTURA = ["programas", "envios", "agendas", "citas", "ventas", "abonos", "gasto", "leads", "deals"] as const;
export type VistaDeLectura = (typeof VISTAS_DE_LECTURA)[number];

export type TipoDeColumna = "texto" | "fecha" | "numero" | "si_no" | "id";

export interface ColumnaDeVista {
  tipo: TipoDeColumna;
  descripcion: string;
}

export interface DefinicionDeVista {
  /** Qué es una fila. */
  fila: string;
  /** Qué cuenta y qué no, en palabras de negocio (se muestra con cada respuesta de `consultar_datos`). */
  cuenta: string;
  /** Con qué fecha se ubica una fila en un periodo. */
  fecha: string;
  /** Qué registros anulados o descartados quedan fuera. */
  vigencia: string;
  columnas: Readonly<Record<string, ColumnaDeVista>>;
}

const c = (tipo: TipoDeColumna, descripcion: string): ColumnaDeVista => ({ tipo, descripcion });

const PROGRAMA = {
  programa_id: c("id", "Identificador del programa."),
  programa: c("texto", "Código corto (slug) del programa. Nunca mezcles programas en una misma cifra."),
} as const;

const FECHAS = {
  dia: c("fecha", "Día de Bogotá en que se ubica la fila (ver la fecha de cada vista)."),
  semana: c("fecha", "Lunes de la semana de ese día."),
  mes: c("fecha", "Primer día del mes de ese día."),
} as const;

const ORIGEN = {
  area: c("texto", "Área de origen: paid, organico, referidos, sin_utm o sin_envio_origen (no hay envío que abriera el deal)."),
  canal: c("texto", "Canal de origen normalizado (instagram, facebook…, con la cuenta si la trae)."),
  cuenta: c("texto", "Cuenta dentro del canal, si el origen la trae."),
} as const;

const DUENO = {
  dueno: c("id", "Quién es dueño del deal. Nulo para quien no ve el trabajo del equipo comercial."),
  dueno_nombre: c("texto", "Nombre del dueño del deal. Nulo para quien no ve el trabajo del equipo comercial."),
} as const;

const COHORTE = {
  cohorte_id: c("id", "Identificador de la cohorte del deal."),
  cohorte: c("texto", "Código de la cohorte del deal."),
} as const;

const PERSONA = {
  correo: c("texto", "Correo de la persona, en minúsculas. Es la llave para no contar dos veces a la misma persona."),
  nombre: c("texto", "Nombre de la persona."),
} as const;

export const CATALOGO_DE_VISTAS = {
  programas: {
    fila: "Un programa dentro de tu alcance.",
    cuenta: "Los programas activos que tu rol puede consultar.",
    fecha: "No aplica.",
    vigencia: "Solo los programas visibles para ti.",
    columnas: { ...PROGRAMA, nombre: c("texto", "Nombre legible del programa.") },
  },
  envios: {
    fila: "Un envío completo del formulario (una persona que se registró).",
    cuenta: "Envíos de formulario, completos y parciales (`tipo`). Un parcial de alguien que después completó (mismo formulario y token) no cuenta aparte. Para registros cuenta solo `tipo = 'completo'`.",
    fecha: "Día del envío (si no trae fecha —todos los parciales—, el día en que llegó al CRM), en Bogotá.",
    vigencia: "Sin los parciales que luego se completaron. Los envíos no se anulan.",
    columnas: {
      id_del_envio: c("id", "Identificador del envío."),
      ...PROGRAMA, ...FECHAS, ...ORIGEN,
      tipo: c("texto", "completo, o parcial (la persona dejó el formulario a medias y no lo completó después)."),
      campana: c("texto", "Campaña UTM tal como llegó."),
      fuente_id: c("id", "Fuente (formulario) por la que llegó."),
      utm_source: c("texto", "UTM source tal como llegó."),
      utm_medium: c("texto", "UTM medium tal como llegó."),
      utm_content: c("texto", "UTM content tal como llegó."),
      utm_term: c("texto", "UTM term tal como llegó."),
      categoria: c("texto", "macro (UTM sin expandir), sin_utm o con_utm."),
      id_del_lead: c("id", "Identificador de la persona."),
      ...PERSONA,
      es_primer_envio_del_correo: c("si_no", "Verdadero en el primer envío completo de cada correo en el programa. Cuenta solo estos para contar personas distintas."),
    },
  },
  agendas: {
    fila: "Una llamada agendada (cita reservada).",
    cuenta: "Citas reservadas, vengan de pauta, orgánico, referidos o sin origen (universo «todas las áreas»; Paid es `universo_paid = 'si'`). Una llamada de un deal anulado no cuenta.",
    fecha: "Día en que se reservó la cita (no el día de la llamada), en Bogotá.",
    vigencia: "Sin llamadas anuladas y sin llamadas de deals anulados.",
    columnas: {
      id_de_la_llamada: c("id", "Identificador de la llamada."),
      id_del_deal: c("id", "Deal de la llamada, si tiene."),
      ...PROGRAMA, ...FECHAS,
      hora: c("texto", "Hora (00–23) de Bogotá en que se reservó."),
      hora_minuto: c("texto", "Hora y minuto (HH:MM) de Bogotá en que se reservó."),
      ...ORIGEN,
      utm_source: c("texto", "UTM source del envío que abrió el deal."),
      utm_medium: c("texto", "UTM medium del envío que abrió el deal."),
      categoria: c("texto", "macro, sin_utm o con_utm."),
      tiene_envio: c("texto", "si o no: el deal tiene un envío de formulario de origen."),
      universo_paid: c("texto", "si o no: el origen es Paid. Toda tasa o cifra de citas dice su universo: todas las áreas (todas las filas) o Paid (`universo_paid = 'si'`)."),
      ...DUENO, ...COHORTE,
      etapa: c("texto", "Etapa actual del deal."),
      resultado: c("texto", "Resultado de la llamada (agendada, show, no_show…)."),
      ...PERSONA,
    },
  },
  citas: {
    fila: "Una llamada con su día de cita.",
    cuenta: "Llamadas del calendario de citas, de todas las áreas (Paid es `universo_paid = 'si'`). `ocurrio` = si la llamada se dio (show, compromiso de pago, cerrada o perdida).",
    fecha: "Día de la cita (la agenda; si no la tiene, la fecha de la llamada), en Bogotá.",
    vigencia: "Sin llamadas anuladas y sin llamadas de deals anulados.",
    columnas: {
      id_de_la_llamada: c("id", "Identificador de la llamada."),
      id_del_deal: c("id", "Deal de la llamada, si tiene."),
      ...PROGRAMA, ...FECHAS, ...ORIGEN,
      universo_paid: c("texto", "si o no: el origen es Paid. Toda tasa o cifra de citas dice su universo: todas las áreas (todas las filas) o Paid (`universo_paid = 'si'`)."),
      ...DUENO, ...COHORTE,
      etapa: c("texto", "Etapa actual del deal."),
      resultado: c("texto", "Resultado de la llamada."),
      ocurrio: c("texto", "si o no: la llamada se dio."),
      ...PERSONA,
    },
  },
  ventas: {
    fila: "Un deal vendido.",
    cuenta: "Deals cuya etapa actual es Abonado o Completo y que no son cortesía. Una venta cuyo único abono se anuló deja de serlo.",
    fecha: "Día del primer pago (el abono vigente más antiguo, en Bogotá); si no hay abono, el día de la primera entrada a Abonado o Completo. `dia_de_etapa` conserva este último.",
    vigencia: "Sin deals anulados. Cierre Perdido no es venta.",
    columnas: {
      id_del_deal: c("id", "Identificador del deal vendido."),
      id_del_lead: c("id", "Identificador de la persona."),
      ...PROGRAMA, ...FECHAS, ...ORIGEN, ...DUENO, ...COHORTE,
      etapa: c("texto", "Etapa actual: ganado_parcial (Abonado) o ganado_completo (Completo)."),
      valor_vendido_usd: c("numero", "Valor vendido del deal, en dólares (USD)."),
      dia_de_venta: c("fecha", "Día de la venta: el del primer pago (abono vigente más antiguo); sin abono, el día de la etapa. Es el mismo valor de `dia`."),
      dia_de_etapa: c("fecha", "Día de la primera entrada del deal a Abonado o Completo, en Bogotá."),
      ...PERSONA,
    },
  },
  abonos: {
    fila: "Un abono (pago) registrado.",
    cuenta: "Abonos vigentes, en la moneda en que se pagaron. Nunca los sumes entre monedas. Es la caja recaudada, no las ventas cerradas.",
    fecha: "Fecha del abono, en Bogotá.",
    vigencia: "Sin abonos anulados. Incluye abonos de deals anulados (`deal_vigente` lo dice).",
    columnas: {
      id_del_abono: c("id", "Identificador del abono."),
      id_del_deal: c("id", "Deal al que se abonó."),
      ...PROGRAMA, ...FECHAS,
      moneda: c("texto", "Moneda del abono (USD, COP…). Cada monto va en su moneda."),
      monto: c("numero", "Monto del abono, en su moneda."),
      concepto: c("texto", "Para qué fue el abono."),
      plataforma: c("id", "Plataforma de pago."),
      registrado_por: c("id", "Quién registró el abono. Nulo para quien no ve el trabajo del equipo comercial."),
      registrado_por_nombre: c("texto", "Nombre de quien registró el abono. Nulo para quien no ve el trabajo del equipo comercial."),
      ...DUENO, ...COHORTE,
      etapa_del_deal: c("texto", "Etapa actual del deal."),
      deal_vigente: c("si_no", "Falso si el deal fue anulado después."),
      ...PERSONA,
    },
  },
  gasto: {
    fila: "El gasto de un día en un anuncio, conjunto, campaña o área de pauta.",
    cuenta: "Gasto de pauta (Paid) en la moneda en que se cargó. No está convertido: el gasto en USD del Hub (ROAS) usa la tasa del día.",
    fecha: "Día del gasto, en Bogotá.",
    vigencia: "Solo gasto de Paid o colgado de un objeto de pauta.",
    columnas: {
      id_del_gasto: c("id", "Identificador del gasto."),
      ...PROGRAMA, ...FECHAS,
      moneda: c("texto", "Moneda del gasto."),
      monto: c("numero", "Monto gastado, en su moneda."),
      objeto_de_pauta: c("id", "Anuncio, conjunto o campaña al que está colgado el gasto."),
      cuenta_meta: c("id", "Cuenta de Meta del objeto de pauta."),
      id_meta: c("texto", "Identificador del objeto en Meta."),
      objeto_nombre: c("texto", "Nombre del objeto de pauta."),
      nivel: c("texto", "Nivel del objeto: cuenta, campaña, conjunto o anuncio."),
      impresiones: c("numero", "Impresiones del día."),
      alcance: c("numero", "Alcance del día."),
      clics_enlace: c("numero", "Clics en el enlace del día."),
      vistas_landing: c("numero", "Vistas de la página de aterrizaje del día."),
      registros_meta: c("numero", "Registros que reporta Meta."),
      agendas_meta: c("numero", "Agendas que reporta Meta."),
    },
  },
  leads: {
    fila: "Una persona (única por correo en cada programa).",
    cuenta: "Personas distintas del programa. Cuenta como lead solo la que entró por el formulario (`cuenta_como_lead`).",
    fecha: "Día de su primera aplicación, en Bogotá (`dia_de_entrada` usa el alta si fue creada a mano).",
    vigencia: "Las personas no se anulan.",
    columnas: {
      id_del_lead: c("id", "Identificador de la persona."),
      ...PROGRAMA, ...PERSONA,
      telefono: c("texto", "Teléfono de la persona."),
      entrada: c("texto", "formulario o alta manual."),
      cuenta_como_lead: c("si_no", "Verdadero si entró por el formulario."),
      dia_primera_aplicacion: c("fecha", "Día de la primera aplicación, en Bogotá."),
      dia_de_entrada: c("fecha", "Día de entrada a la base, en Bogotá."),
      num_aplicaciones: c("numero", "Cuántas veces aplicó."),
      calificacion: c("texto", "Calificación del formulario."),
      puntaje: c("numero", "Puntaje del formulario."),
      lead_quality: c("texto", "Calidad del lead."),
      lead_value: c("texto", "Valor del lead."),
      traido_por: c("id", "Quién trajo a la persona. Nulo para quien no ve el trabajo del equipo comercial."),
    },
  },
  deals: {
    fila: "Un deal (oportunidad) vigente.",
    cuenta: "Todos los deals vigentes del programa, en cualquier etapa.",
    fecha: "Día de creación del deal: el del envío que lo abrió, o el alta directa si no tiene envío.",
    vigencia: "Sin deals anulados.",
    columnas: {
      id_del_deal: c("id", "Identificador del deal."),
      id_del_lead: c("id", "Identificador de la persona."),
      ...PROGRAMA,
      etapa: c("texto", "Etapa actual."),
      pendiente: c("texto", "Pendiente del deal, si tiene."),
      etapa_vendida: c("si_no", "Verdadero si la etapa es Abonado o Completo."),
      cortesia: c("si_no", "Verdadero si es una cortesía (no es venta)."),
      dia_de_creacion: c("fecha", "Día de creación, en Bogotá."),
      ...DUENO, ...COHORTE,
      valor_vendido_usd: c("numero", "Valor vendido, en dólares (USD)."),
      fecha_limite_pago: c("fecha", "Fecha límite de pago acordada."),
      ...PERSONA,
      telefono: c("texto", "Teléfono de la persona."),
    },
  },
} as const satisfies Record<VistaDeLectura, DefinicionDeVista>;

/**
 * Qué vista responde cada ancla de fecha del registro de métricas. Exhaustivo a propósito: un ancla nueva
 * obliga a decidir su vista aquí (typecheck). `sin_fecha` (objetivos y ajustes) no vive en una vista.
 */
export const VISTA_POR_ANCLA = {
  fecha_del_envio: "envios",
  fecha_de_creacion_de_la_cita: "agendas",
  hora_de_la_cita: "citas",
  primera_entrada_a_venta: "ventas",
  fecha_del_abono: "abonos",
  fecha_del_gasto: "gasto",
  primera_aplicacion: "leads",
} as const satisfies Record<Exclude<AnclaDeFecha, "sin_fecha">, VistaDeLectura>;

export function esVistaDeLectura(nombre: string): nombre is VistaDeLectura {
  return (VISTAS_DE_LECTURA as readonly string[]).includes(nombre);
}

/** Las reglas que acompañan a toda consulta (las lee el agente en `definiciones_de_metricas`). */
export const REGLAS_DE_LECTURA = [
  "Solo un SELECT por llamada, sobre las vistas del esquema mcp_lectura. La base rechaza todo lo demás.",
  "Todas las fechas (`dia`, `semana`, `mes`) son días de Bogotá.",
  "Cada monto trae su moneda: agrupa o filtra por `moneda`, nunca sumes USD con COP.",
  "Para contar personas distintas usa `correo` (por ejemplo count(distinct correo)), no filas.",
  "Toda tasa o cifra de citas dice su universo: todas las áreas o Paid (`universo_paid`).",
  "Cada vista ya excluye lo anulado; no hace falta filtrarlo.",
  "No mezcles programas en una misma cifra: filtra o agrupa por `programa`.",
  "Si la pregunta es una métrica registrada del Hub, respóndela con consultar_metrica; consultar_datos es para explorar y no es una cifra del Hub.",
] as const;
