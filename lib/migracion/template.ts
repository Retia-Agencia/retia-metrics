import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";

/**
 * El template canonico de la migracion de las pestañas de gestion (ADR 0059 punto 4).
 *
 * El **extractor** (este directorio, logica pura sobre matrices) lo escribe; el
 * **importador** (paso 4 del 078) lo lee y escribe por `lib/deals/historico.ts`. En el
 * medio es un archivo local revisable a mano: un caso raro se corrige en el template, no
 * en codigo.
 *
 * 🩸 **Lleva datos personales (correos): nunca va a git.** Lo que queda en git son estas
 * reglas y sus tests.
 *
 * Todo es serializable a JSON: las fechas van como texto (ISO para un instante,
 * `YYYY-MM-DD` de Bogota para un dia) y los montos como texto con dos decimales en USD.
 */

/**
 * Los tipos de rareza. `rarezas_migracion.tipo` es texto en la base (migracion 0042) y
 * esta lista es la que lo fija. Las del extractor salen de leer la hoja; las del
 * importador, de cruzarla con la base.
 */
export const TIPOS_DE_RAREZA = [
  // extractor
  "sin_correo",
  "correo_repetido",
  "estado_desconocido",
  "pendiente_con_notas",
  "agendado_por_decidir",
  "sin_resultado",
  "valor_desconocido",
  "sin_fecha",
  "monto_cobrado_desconocido",
  "precio_desconocido",
  "fecha_aproximada",
  "en_dos_cohortes",
  // consolidar (080)
  "perdida_por_decidir",
  "cerrada_sin_estudiante",
  // importador
  "lead_no_encontrado",
  "ya_tiene_deal_vivo",
  "plataforma_fuera_de_catalogo",
  "llamada_sin_deal",
  "abono_sin_deal",
  "sin_cohorte",
] as const;
export type TipoRareza = (typeof TIPOS_DE_RAREZA)[number];

export interface RarezaTemplate {
  /** La fila de la hoja: `sheets:<programa>:<pestaña>:<llave>`. */
  huella: string;
  tipo: TipoRareza;
  /** Que tiene de raro, con el valor de la hoja que lo causo. */
  detalle: string;
}

export interface NotaTemplate {
  texto: string;
  /** Instante ISO, o nulo si la hoja no dice cuando (los `Registro` del medio). */
  fecha: string | null;
}

export interface DealTemplate {
  huella: string;
  correo: string;
  etapa: EtapaDeal;
  pendiente?: PendienteDeal | null;
  /** El nombre como lo escribio la hoja; el dueño lo resuelve el importador. */
  closer: string | null;
  /** Instante ISO en que entro a la etapa, si la hoja lo sabe. */
  fechaEtapa: string | null;
  /** Codigo de la cohorte (Estudiantes); nulo en el Setteo. */
  cohorte: string | null;
  /** Precio histórico en USD tal como lo dice la hoja; el importador no lo aplica al deal. */
  precio: string | null;
  acuerdoPago: string | null;
  /** `Mail onboarding = Si`. Que se hace con eso lo decide el importador (pregunta abierta del 077). */
  mailOnboarding: boolean;
  notas: NotaTemplate[];
  /**
   * Los "cohorte pasada" (080): la hoja no los marca, así que lo escribe A MANO en el template
   * quien conoce la hoja, con el código de la cohorte de la que vino. Ningún extractor lo llena.
   */
  movidoDesde?: string | null;
}

export interface AbonoTemplate {
  huella: string;
  /** El deal del que cuelga, por su huella. */
  dealHuella: string;
  /** Dia de Bogota. Nulo = la hoja no lo dice: el importador pone el cierre de ventas de la cohorte (ADR 0059 punto 6). */
  fecha: string | null;
  monto: string;
  /** El texto de la hoja; el importador lo empareja contra el catalogo. */
  plataforma: string | null;
  closer: string | null;
}

export type ResultadoTemplate = "agendada" | "show" | "no_show" | "cerrada";

export interface LlamadaTemplate {
  huella: string;
  /** Nulo si la fila no trae correo: la llamada entra suelta y es rareza. */
  correo: string | null;
  /** Instante ISO de la llamada. */
  fecha: string | null;
  closer: string | null;
  resultado: ResultadoTemplate;
  categoria: string | null;
  subcategoria: string | null;
  link: string | null;
  notas: string | null;
}

/** Una fila que a proposito NO crea deal (decision de Mani del 28-sep, ticket 080). No es rareza: es alcance. */
export interface SinDealTemplate {
  huella: string;
  razon: "no_interesado" | "cerrado" | "pendiente_viejo_sin_actividad" | "pendiente_sin_fecha" | "es_estudiante" | "movido_de_cohorte";
}

export interface Extraccion {
  deals: DealTemplate[];
  abonos: AbonoTemplate[];
  llamadas: LlamadaTemplate[];
  rarezas: RarezaTemplate[];
  sinDeal: SinDealTemplate[];
}

export function extraccionVacia(): Extraccion {
  return { deals: [], abonos: [], llamadas: [], rarezas: [], sinDeal: [] };
}

/** Junta lo que sacaron varias pestañas del mismo programa. */
export function juntar(...partes: Extraccion[]): Extraccion {
  const total = extraccionVacia();
  for (const p of partes) {
    total.deals.push(...p.deals);
    total.abonos.push(...p.abonos);
    total.llamadas.push(...p.llamadas);
    total.rarezas.push(...p.rarezas);
    total.sinDeal.push(...p.sinDeal);
  }
  return total;
}
