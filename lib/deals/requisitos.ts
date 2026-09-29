import { NOMBRE_DE_ETAPA, transicion, type EtapaDeal, type Transicion } from "./etapas";

/**
 * Que le falta a un deal para tomar una flecha (ticket 044, ADR 0037 punto 4).
 *
 * Son predicados PUROS: reciben los hechos del deal en memoria y devuelven lo que
 * falta, sin base, sin sesion y sin pantalla. Quien arma los hechos desde la base
 * es `moverEtapa()` (045); este modulo solo contesta.
 *
 * El requisito es de la FLECHA y no solo de la etapa destino: entrar a En Contacto
 * por T1 exige el primer contacto, pero volver ahi por A1 (se anulo el unico abono)
 * no. Por eso se decide por el id de la transicion, que es la columna "Requisito"
 * de `docs/structure.md` §3.1.
 *
 * Se devuelve la LISTA de lo que falta y no un booleano: un booleano obliga a que
 * la pantalla adivine el mensaje, y dos pantallas adivinan distinto. El mensaje
 * vive con la regla, no con el boton.
 */

/**
 * Lo que el motor necesita saber de un deal para decidir. Cada campo es un HECHO ya
 * resuelto por quien llama; aqui no se consulta ni se recalcula nada.
 */
export interface HechosDelDeal {
  /** El deal tiene dueño (`deals.owner_user_id`). */
  tieneDueno: boolean;
  /** Hay una actividad de contacto registrada, con fecha y canal (`deal_actividades`). */
  tieneContactoRegistrado: boolean;
  /** Hay una llamada vigente con fecha de agenda. */
  tieneLlamadaConFecha: boolean;
  /** La llamada tiene link de Grain, o el closer marco que sucedio (el caso raro sin grabar). */
  llamadaSucedio: boolean;
  /** La ultima llamada quedo en `no_show` o `cancelada`. */
  llamadaFallida: boolean;
  productoId: string | null;
  /** La fecha limite de pago del acuerdo (ADR 0053), `YYYY-MM-DD`. */
  fechaLimitePago: string | null;
  /**
   * La cohorte a la que quiere entrar (Proxima Cohorte): `deals.cohorte_destino_id`
   * (Mani 27-sep, ticket 103, punto 1). Es una columna APARTE de `cohort_id`, que sigue
   * siendo la de origen: ir a Proxima Cohorte ya NO muda al deal de cohorte, asi la
   * conversion de su cohorte de origen no lo pierde. Que sea del mismo programa y
   * distinta de la de origen lo valida el motor al escribirla; aqui solo se pregunta si
   * esta puesta.
   */
  cohorteDestinoId: string | null;
  /** Cuando hay que volver a contactarlo (Seguimiento), `YYYY-MM-DD`. */
  fechaSeguimiento: string | null;
  /** Cuantos abonos vigentes tiene (sin anulados, ADR 0026). */
  abonosVigentes: number;
  /** El ultimo abono registrado trae comprobante. */
  abonoConComprobante: boolean;
  /**
   * Lo que falta por pagar, tal como lo calcula el modulo del saldo (ADR 0024).
   * **No se recalcula aqui.** `null` si el deal no tiene producto y por eso no hay
   * precio contra el cual medir.
   */
  saldo: number | null;
  /** El motivo que acompaña el movimiento (catalogo `motivos`), si lo trae. */
  motivoId: string | null;
}

export type CodigoRequisito =
  | "transicion_no_permitida"
  | "dueno"
  | "contacto"
  | "llamada_con_fecha"
  | "llamada_sucedio"
  | "llamada_fallida"
  | "producto"
  | "fecha_limite_pago"
  | "cohorte_destino"
  | "fecha_seguimiento"
  | "abono"
  | "comprobante"
  | "saldo_pendiente"
  | "saldo_en_cero"
  | "sin_abonos"
  | "motivo";

export interface RequisitoFaltante {
  codigo: CodigoRequisito;
  /** Listo para mostrarse, en español. */
  mensaje: string;
}

const MENSAJES: Record<Exclude<CodigoRequisito, "transicion_no_permitida">, string> = {
  dueno: "El deal no tiene dueño.",
  contacto: "Falta registrar el contacto, con fecha y canal.",
  llamada_con_fecha: "Falta una llamada con fecha.",
  llamada_sucedio: "Falta el link de Grain de la llamada.",
  llamada_fallida: "La llamada no quedó en no-show ni cancelada.",
  producto: "Falta el producto.",
  fecha_limite_pago: "Falta la fecha límite de pago.",
  cohorte_destino: "Falta la cohorte a la que quiere entrar.",
  fecha_seguimiento: "Falta la fecha de seguimiento.",
  abono: "Falta registrar un abono.",
  comprobante: "El abono no tiene comprobante.",
  saldo_pendiente: "El saldo ya está en cero: el deal va a Completo, no a Abonado.",
  saldo_en_cero: "Todavía queda saldo por pagar.",
  sin_abonos: "El deal todavía tiene abonos vigentes.",
  motivo: "Falta el motivo.",
};

type Chequeo = (h: HechosDelDeal) => boolean;

/** Cada requisito, como predicado: `true` si el deal lo CUMPLE. */
const CUMPLE: Record<Exclude<CodigoRequisito, "transicion_no_permitida">, Chequeo> = {
  dueno: (h) => h.tieneDueno,
  contacto: (h) => h.tieneContactoRegistrado,
  llamada_con_fecha: (h) => h.tieneLlamadaConFecha,
  llamada_sucedio: (h) => h.llamadaSucedio,
  llamada_fallida: (h) => h.llamadaFallida,
  producto: (h) => h.productoId != null,
  fecha_limite_pago: (h) => h.fechaLimitePago != null,
  cohorte_destino: (h) => h.cohorteDestinoId != null,
  fecha_seguimiento: (h) => h.fechaSeguimiento != null,
  abono: (h) => h.abonosVigentes > 0,
  comprobante: (h) => h.abonoConComprobante,
  // Abonado y Completo son complementarios sobre el mismo saldo: un deal con abonos
  // nunca queda sin etapa a la que ir. Un saldo negativo es un sobrepago (lo ataja la
  // reja del abono, ADR 0024); si se colara, el deal cuenta como pagado y no se traba.
  saldo_pendiente: (h) => h.saldo != null && h.saldo > 0,
  saldo_en_cero: (h) => h.saldo != null && h.saldo <= 0,
  sin_abonos: (h) => h.abonosVigentes === 0,
  motivo: (h) => h.motivoId != null,
};

type Requisito = Exclude<CodigoRequisito, "transicion_no_permitida" | "motivo">;

/**
 * Los requisitos de cada flecha, por su id en `docs/structure.md` §3.1. El motivo
 * NO va aqui: sale de `exigeMotivo` en la tabla de transiciones, que es el unico
 * lugar donde se dice que flecha lo pide.
 *
 * Donde una fila del documento cubre dos destinos (T5 "2 → 7 u 8"), el requisito
 * del pago se decide por el destino: a Abonado le queda saldo, a Completo no.
 */
function requisitosDe(t: Transicion): Requisito[] {
  const pago: Requisito[] = ["producto", "abono", "comprobante"];
  const segunDestino = (): Requisito[] =>
    t.a === "abonado" ? [...pago, "saldo_pendiente"] : [...pago, "saldo_en_cero"];

  switch (t.id) {
    case "T1":
      return ["dueno", "contacto"];
    case "T2":
    case "T3":
    case "T6":
    case "T9":
    case "T23":
    case "T27":
      return ["llamada_con_fecha"];
    case "T4":
    case "T12":
    case "T25":
      return ["producto", "fecha_limite_pago"];
    case "T5":
    case "T13":
    case "T14":
    case "T16":
    case "T17":
    case "T26":
      return segunDestino();
    case "T7":
    case "T10":
      return ["llamada_sucedio"];
    case "T8":
      return ["llamada_fallida"];
    case "T18":
      return ["saldo_en_cero", "comprobante"];
    case "T19":
    case "T20":
    case "T21":
    case "T28":
      return ["cohorte_destino"];
    case "T22":
      return ["contacto"];
    case "T24":
      return ["fecha_seguimiento"];
    case "A1":
      return ["sin_abonos"];
    case "A2":
      return ["saldo_pendiente"];
    // T15, T29, P y R solo piden el motivo, que ya viene de la tabla.
    default:
      return [];
  }
}

/**
 * Lo que le falta al deal para pasar de `de` a `a`. Lista vacia: puede pasar.
 * Si la flecha no existe, devuelve solo ese hecho, con las etapas por su nombre.
 */
export function queLeFalta(de: EtapaDeal, a: EtapaDeal, hechos: HechosDelDeal): RequisitoFaltante[] {
  const t = transicion(de, a);
  if (!t) {
    return [
      {
        codigo: "transicion_no_permitida",
        mensaje: `Un deal no puede pasar de ${NOMBRE_DE_ETAPA[de]} a ${NOMBRE_DE_ETAPA[a]}.`,
      },
    ];
  }
  const codigos: Exclude<CodigoRequisito, "transicion_no_permitida">[] = requisitosDe(t);
  if (t.exigeMotivo) codigos.push("motivo");
  return codigos.filter((c) => !CUMPLE[c](hechos)).map((codigo) => ({ codigo, mensaje: MENSAJES[codigo] }));
}
