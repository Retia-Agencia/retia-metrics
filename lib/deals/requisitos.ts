import type { EtapaDeal } from "@/lib/db/schema";
import { resultadoLlamadaEnum } from "@/lib/db/schema";
import { transicion } from "@/lib/deals/etapas";

/**
 * Los requisitos de entrada de cada transicion de etapa, como PREDICADOS PUROS
 * (ticket 044, structure.md §3.1 columna "Requisito", ADR 0037). Contestan una sola
 * pregunta: "¿que le falta a este deal para tomar ESTA flecha?". No tocan la base, ni
 * la sesion, ni el reloj: **todo lo que necesitan llega como dato** en `HechosDelDeal`,
 * que el llamador arma (ticket 045: `moverEtapa()`, el unico que escribe la etapa).
 *
 * Por que "que le falta" y no un booleano (ticket 044): un booleano obliga a la pantalla
 * a adivinar el mensaje, y dos pantallas adivinan distinto. El requisito que falta es la
 * unica parte del motor que el closer lee, asi que vive con la regla y no con el boton.
 *
 * Por que POR TRANSICION y no por etapa destino (decision de Mani, ticket 044): dos
 * flechas al MISMO destino piden cosas distintas. 5 → 11 (T24) pide fecha de seguimiento
 * pero 6 → 11 (T15) pide motivo; 4 → 3 (T8) pide que la ultima llamada sea no_show o
 * cancelada pero 5 → 3 (T29) pide motivo. Colgar el requisito del destino los fundiria y
 * uno de los dos quedaria mal **sin lanzar ningun error**. La llave es la flecha.
 *
 * Reglas duras que sostienen la forma de este modulo:
 * - **El saldo NO se calcula aqui** (ADR 0024): vive en `lib/queries/saldo.ts` (lo
 *   recrea el ticket 060). El llamador lo pasa ya calculado en `saldoTrasAbono`. Este
 *   modulo nunca suma `abonos`; solo compara el saldo que le dan contra cero.
 * - **Nada de imports de la base, de las consultas ni de la sesion**: solo tipos. Un
 *   test estatico (`tests/requisitos-etapas.test.ts`) lo muerde.
 * - **La lista blanca es del ticket 043** (`TRANSICIONES` en `lib/deals/etapas.ts`): aca
 *   no se re-valida si la flecha existe. Si preguntan por una flecha que no esta en la
 *   tabla, se lanza `TransicionInexistenteError` (ver `requisitoFaltante`), porque
 *   inventar un requisito para una flecha imposible seria un numero callado.
 */

/** El tipo del resultado de una llamada, derivado del enum de la base (no se re-declara). */
type ResultadoLlamada = (typeof resultadoLlamadaEnum.enumValues)[number];

/**
 * Una actividad registrada sobre el deal. Solo interesan el tipo, la fecha y el canal:
 * T1 exige un `contacto` con fecha y canal, y T22 un `contacto` fechado despues de que
 * el deal entro a su etapa actual (`enEtapaDesde`).
 */
export type HechoActividad = {
  tipo: "contacto" | "nota";
  fecha: Date | null;
  canal: string | null;
};

/**
 * Una llamada del deal. `fechaAgenda` es cuando quedo citada; `resultado` es el enum de
 * la base. `grainUrl` y `sucedio` **todavia no existen como columnas** (llegan con la
 * etapa de llamadas): aca son entradas, porque T7/T10 aceptan el link de Grain O el
 * closer marcando "sucedio" para la llamada real sin grabar (propuesta del 24-sep).
 */
export type HechoLlamada = {
  fechaAgenda: Date | null;
  resultado: ResultadoLlamada | null;
  grainUrl: string | null;
  sucedio: boolean;
};

/**
 * Lo que el llamador sabe del deal en el momento de intentar moverlo. Es un objeto plano
 * en memoria: los predicados no van a buscar nada. Todo campo es opcional o anulable
 * donde es natural que falte, porque "que falta" es justo lo que estos predicados
 * contestan.
 */
export type HechosDelDeal = {
  /** El dueño del deal. T1 exige que exista antes de registrar el primer contacto. */
  ownerUserId: string | null;
  /** El producto asignado. T4/T12/T25 (compromiso) y T5/T13/T16/T26 (abono) lo exigen. */
  productoId: string | null;
  /**
   * La fecha limite de pago (ADR 0053). **La columna aun no existe** (ticket futuro); aca
   * es una entrada. T4/T12/T25 la exigen: sin fecha no hay compromiso que vigilar.
   */
  fechaLimitePago: Date | null;
  /** La cohorte a la que quiere entrar. T19/T20/T21/T28 (Proxima Cohorte) la exigen. */
  cohorteDestinoId: string | null;
  /** La fecha de seguimiento. Solo T24 (5 → 11) la exige. */
  fechaSeguimiento: Date | null;
  /** El motivo elegido. T15, T29, P y R lo exigen (cierre, re-agenda con motivo, etc). */
  motivoId: string | null;
  /** Las actividades del deal (T1: primer contacto; T22: contacto nuevo tras reentrar). */
  actividades: HechoActividad[];
  /** Las llamadas del deal (T2/T3/T6/T23/T27 fecha; T7/T10 Grain; T8 resultado; T9 par). */
  llamadas: HechoLlamada[];
  /** El abono que se esta registrando, o null si no hay ninguno en juego. */
  abono: { monto: number; comprobanteUrl: string | null } | null;
  /**
   * El saldo del deal DESPUES de aplicar el abono, calculado por el llamador
   * (`lib/queries/saldo.ts`, ADR 0024). `> 0` distingue Abonado; `=== 0`, Completo.
   * `null` = el llamador no lo pudo calcular (no hay dato de saldo todavia).
   */
  saldoTrasAbono: number | null;
  /** La anulacion en juego (A1/A2): su motivo no puede venir vacio. */
  anulacion: { motivo: string | null } | null;
  /** Cuando el deal entro a su etapa actual. T22 mide "contacto nuevo" contra esto. */
  enEtapaDesde: Date | null;
};

/**
 * Lo que falta para tomar la flecha. `codigo` es estable (para tests y logica); `mensaje`
 * es espanol listo para mostrarle al closer. Cuando el requisito se cumple, el predicado
 * devuelve `null`.
 */
export type Faltante = {
  codigo: string;
  mensaje: string;
};

/** Se lanza si se pregunta el requisito de una flecha que no existe en `TRANSICIONES`. */
export class TransicionInexistenteError extends Error {
  constructor(de: EtapaDeal, a: EtapaDeal) {
    super(`No existe la transicion ${de} → ${a}: la lista blanca es del ticket 043.`);
    this.name = "TransicionInexistenteError";
  }
}

/**
 * La llave de un requisito: el id del diagrama MAS el destino. Casi todos los ids son un
 * solo destino, pero T5/T13/T14/T17/T26 se parten en `abonado` vs `completo` porque piden
 * lo mismo salvo el saldo (Abonado: `saldoTrasAbono > 0`; Completo: `=== 0`). Igual que la
 * tabla de transiciones parte esas filas por destino, aca se parte el requisito por
 * destino, y por eso la llave lleva el destino y no solo el id.
 */
type ClaveRequisito = `${string}:${EtapaDeal}`;

function clave(id: string, a: EtapaDeal): ClaveRequisito {
  return `${id}:${a}`;
}

/** Un requisito: dado los hechos, devuelve lo que falta, o `null` si se cumple. */
type Requisito = (hechos: HechosDelDeal) => Faltante | null;

// --- Predicados reutilizables, uno por clase de exigencia de la tabla -----------------

/** T1: el deal tiene dueño registrado. */
function exigeOwner(hechos: HechosDelDeal): Faltante | null {
  if (hechos.ownerUserId) return null;
  return { codigo: "SIN_OWNER", mensaje: "El deal necesita un dueño antes de registrar el contacto." };
}

/** T1 (1→2): owner Y contacto con fecha y canal — se muestra el primer faltante de los dos. */
function exigeEntradaAContacto(hechos: HechosDelDeal): Faltante | null {
  return exigeOwner(hechos) ?? exigeContactoConFechaYCanal(hechos);
}

/** T1: hay una actividad de contacto con fecha y canal (prueba que alguien lo trabaja). */
function exigeContactoConFechaYCanal(hechos: HechosDelDeal): Faltante | null {
  const hay = hechos.actividades.some((a) => a.tipo === "contacto" && a.fecha !== null && !!a.canal);
  if (hay) return null;
  return {
    codigo: "SIN_CONTACTO",
    mensaje: "Registra un contacto con fecha y canal para pasar a En Contacto.",
  };
}

/** T2/T3/T6/T23/T27: hay una llamada con fecha de agenda. */
function exigeLlamadaConFecha(hechos: HechosDelDeal): Faltante | null {
  const hay = hechos.llamadas.some((l) => l.fechaAgenda !== null);
  if (hay) return null;
  return { codigo: "SIN_LLAMADA_AGENDADA", mensaje: "Agenda una llamada con fecha para pasar a Agendado." };
}

/** T4/T12/T25: hay producto asignado y fecha limite de pago (ADR 0053). */
function exigeCompromiso(hechos: HechosDelDeal): Faltante | null {
  if (!hechos.productoId) {
    return { codigo: "SIN_PRODUCTO", mensaje: "Asigna un producto para registrar el compromiso." };
  }
  if (hechos.fechaLimitePago === null) {
    return {
      codigo: "SIN_FECHA_LIMITE",
      mensaje: "Falta la fecha límite de pago: sin fecha no hay compromiso que vigilar.",
    };
  }
  return null;
}

/**
 * El abono con comprobante, y el saldo esperado tras aplicarlo. `destino` decide el
 * corte: `abonado` exige saldo > 0 (queda deuda), `completo` exige saldo === 0. El saldo
 * lo pone el llamador (ADR 0024): aca solo se compara, nunca se suma.
 */
function exigeAbono(destino: "abonado" | "completo", conProducto: boolean): Requisito {
  return (hechos) => {
    if (conProducto && !hechos.productoId) {
      return { codigo: "SIN_PRODUCTO", mensaje: "Asigna un producto antes de registrar el abono." };
    }
    if (!hechos.abono) {
      return { codigo: "SIN_ABONO", mensaje: "Registra un abono para mover la etapa." };
    }
    if (!hechos.abono.comprobanteUrl) {
      return { codigo: "SIN_COMPROBANTE", mensaje: "El abono necesita comprobante." };
    }
    if (hechos.saldoTrasAbono === null) {
      return { codigo: "SALDO_DESCONOCIDO", mensaje: "No se pudo determinar el saldo del deal." };
    }
    if (destino === "abonado" && !(hechos.saldoTrasAbono > 0)) {
      return {
        codigo: "SIN_SALDO_PENDIENTE",
        mensaje: "El saldo quedó en cero: el deal va a Completo, no a Abonado.",
      };
    }
    if (destino === "completo" && hechos.saldoTrasAbono !== 0) {
      return {
        codigo: "SALDO_PENDIENTE",
        mensaje: "Todavía queda saldo: el deal va a Abonado, no a Completo.",
      };
    }
    return null;
  };
}

/** T18: el saldo quedo en cero (Completo es un hecho contable). Sin producto ni comprobante. */
function exigeSaldoCero(hechos: HechosDelDeal): Faltante | null {
  if (hechos.saldoTrasAbono === null) {
    return { codigo: "SALDO_DESCONOCIDO", mensaje: "No se pudo determinar el saldo del deal." };
  }
  if (hechos.saldoTrasAbono !== 0) {
    return { codigo: "SALDO_PENDIENTE", mensaje: "Todavía queda saldo por pagar." };
  }
  return null;
}

/** T7/T10: hay una llamada con Grain, o marcada "sucedio" (la real sin grabar, 24-sep). */
function exigeGrainOSucedio(hechos: HechosDelDeal): Faltante | null {
  const hay = hechos.llamadas.some((l) => !!l.grainUrl || l.sucedio);
  if (hay) return null;
  return {
    codigo: "SIN_GRAIN",
    mensaje: 'Pega el Grain de la llamada, o márcala como "sucedió", para pasar a Atendido.',
  };
}

/**
 * T8: la ULTIMA llamada quedo en no_show o cancelada (la cita falló y tiene que verse).
 * "Ultima" es la de fecha de agenda mas reciente, NO la ultima del arreglo: si dependiera
 * del orden en que el llamador arma la lista, una consulta sin `ORDER BY` decidiria la
 * etapa (la familia del `fuentes[0]` del ADR 0031). Una llamada sin fecha no compite.
 */
function exigeUltimaLlamadaFallida(hechos: HechosDelDeal): Faltante | null {
  const ultima = hechos.llamadas
    .filter((l) => l.fechaAgenda !== null)
    .reduce<HechoLlamada | undefined>(
      (max, l) => (max && max.fechaAgenda!.getTime() >= l.fechaAgenda!.getTime() ? max : l),
      undefined,
    );
  if (ultima && (ultima.resultado === "no_show" || ultima.resultado === "cancelada")) return null;
  return {
    codigo: "LLAMADA_NO_FALLIDA",
    mensaje: "A Re-agenda se pasa cuando la llamada quedó en no-show o cancelada.",
  };
}

/**
 * T9: mover una cita antes de que ocurra. Hay una llamada vieja marcada `reagendada` Y
 * otra (distinta) con fecha de agenda nueva. Mover una cita no es avanzar ni retroceder.
 */
function exigeReagendaConNueva(hechos: HechosDelDeal): Faltante | null {
  const indiceReagendada = hechos.llamadas.findIndex((l) => l.resultado === "reagendada");
  if (indiceReagendada === -1) {
    return {
      codigo: "SIN_REAGENDADA",
      mensaje: "Marca la cita anterior como reagendada para mover la agenda.",
    };
  }
  const hayNueva = hechos.llamadas.some((l, i) => i !== indiceReagendada && l.fechaAgenda !== null);
  if (!hayNueva) {
    return { codigo: "SIN_NUEVA_FECHA", mensaje: "Agenda la nueva llamada con fecha." };
  }
  return null;
}

/** T15/T29/P/R: hay un motivo elegido. */
function exigeMotivo(hechos: HechosDelDeal): Faltante | null {
  if (hechos.motivoId) return null;
  return { codigo: "SIN_MOTIVO", mensaje: "Elige un motivo." };
}

/** T19/T20/T21/T28: hay una cohorte destino (sin ella la etapa se vuelve un cementerio). */
function exigeCohorteDestino(hechos: HechosDelDeal): Faltante | null {
  if (hechos.cohorteDestinoId) return null;
  return { codigo: "SIN_COHORTE_DESTINO", mensaje: "Elige la cohorte destino." };
}

/** T24: hay fecha de seguimiento. */
function exigeFechaSeguimiento(hechos: HechosDelDeal): Faltante | null {
  if (hechos.fechaSeguimiento !== null) return null;
  return { codigo: "SIN_FECHA_SEGUIMIENTO", mensaje: "Elige la fecha de seguimiento." };
}

/**
 * T22: un contacto NUEVO, es decir una actividad de contacto fechada DESPUES de que el
 * deal entro a Proxima Cohorte (`enEtapaDesde`). El deal reaparece en el Inbox cuando su
 * cohorte abre; solo un contacto posterior prueba que se le volvio a hablar. Sin
 * `enEtapaDesde` el llamador no puede decidir "nuevo", asi que falta el dato.
 */
function exigeContactoNuevo(hechos: HechosDelDeal): Faltante | null {
  if (hechos.enEtapaDesde === null) {
    return {
      codigo: "SIN_MARCA_DE_ENTRADA",
      mensaje: "Falta saber desde cuándo el deal está en Próxima Cohorte.",
    };
  }
  const desde = hechos.enEtapaDesde;
  const hay = hechos.actividades.some(
    (a) => a.tipo === "contacto" && a.fecha !== null && a.fecha.getTime() > desde.getTime(),
  );
  if (hay) return null;
  return { codigo: "SIN_CONTACTO_NUEVO", mensaje: "Registra un contacto nuevo para recontactarlo." };
}

/** A1/A2: la anulacion trae un motivo no vacio (si el abono no existe, Abonado tampoco). */
function exigeAnulacionConMotivo(hechos: HechosDelDeal): Faltante | null {
  const motivo = hechos.anulacion?.motivo?.trim();
  if (motivo) return null;
  return { codigo: "SIN_MOTIVO_ANULACION", mensaje: "La anulación necesita un motivo." };
}

/**
 * Los requisitos como DATO, uno por flecha (id + destino). El destino esta en la llave
 * para partir T5/T13/T14/T17/T26 en abonado vs completo (ver `ClaveRequisito`).
 *
 * Lectura de la tabla §3.1 (columna "Requisito"), flecha por flecha:
 * - T1 (1→2): owner + contacto con fecha y canal.
 * - T2 (1→4), T3 (2→4), T6 (3→4), T23 (9→4), T27 (11→4): llamada con fecha.
 * - T4 (2→6), T12 (5→6), T25 (11→6): producto + fecha limite de pago.
 * - T5 (2→7): producto + abono con comprobante, saldo > 0.
 * - T5 (2→8): producto + abono con comprobante, saldo = 0 (pagó todo por chat).
 * - T13 (5→7): producto + abono con comprobante, saldo > 0.
 * - T14 (5→8): la tabla dice "abono igual al precio" = saldo = 0. El comprobante y el
 *   producto se mantienen por coherencia con T13 (misma llamada, mismo pago).
 * - T16 (6→7): abono con comprobante, saldo > 0. El producto YA existe (viene de T4/T12).
 * - T17 (6→8): abono, saldo = 0. Producto ya presente.
 * - T18 (7→8): saldo en cero (la suma de abonos llegó al precio).
 * - T7 (3→5), T10 (4→5): Grain o "sucedió".
 * - T8 (4→3): la última llamada en no_show o cancelada.
 * - T9 (4→4): llamada reagendada + otra con fecha.
 * - T15 (6→11), T29 (5→3): motivo.
 * - T19/T20/T21 (2/5/6→9), T28 (11→9): cohorte destino.
 * - T22 (9→2): contacto nuevo (posterior a enEtapaDesde).
 * - T24 (5→11): fecha de seguimiento.
 * - T26 (11→7): abono con comprobante, saldo > 0. Producto ya presente (viene de T25).
 * - T26 (11→8): abono, saldo = 0.
 * - P (→10): motivo obligatorio. R (10→): motivo.
 * - A1 (7→previa), A2 (8→7): anulación con motivo no vacío.
 */
const REQUISITOS: Record<ClaveRequisito, Requisito> = {
  // Antes de la llamada
  [clave("T1", "en_contacto")]: exigeEntradaAContacto,
  [clave("T2", "agendado")]: exigeLlamadaConFecha,
  [clave("T3", "agendado")]: exigeLlamadaConFecha,
  [clave("T4", "compromiso_verbal")]: exigeCompromiso,
  [clave("T5", "abonado")]: exigeAbono("abonado", true),
  [clave("T5", "completo")]: exigeAbono("completo", true),
  [clave("T6", "agendado")]: exigeLlamadaConFecha,
  [clave("T7", "atendido")]: exigeGrainOSucedio,
  [clave("T8", "pendiente_reagenda")]: exigeUltimaLlamadaFallida,
  [clave("T9", "agendado")]: exigeReagendaConNueva,
  [clave("T10", "atendido")]: exigeGrainOSucedio,

  // La llamada y el pago
  [clave("T12", "compromiso_verbal")]: exigeCompromiso,
  [clave("T13", "abonado")]: exigeAbono("abonado", true),
  [clave("T14", "completo")]: exigeAbono("completo", true),
  [clave("T15", "seguimiento")]: exigeMotivo,
  [clave("T16", "abonado")]: exigeAbono("abonado", false),
  [clave("T17", "completo")]: exigeAbono("completo", false),
  [clave("T18", "completo")]: exigeSaldoCero,

  // A Proxima Cohorte
  [clave("T19", "proxima_cohorte")]: exigeCohorteDestino,
  [clave("T20", "proxima_cohorte")]: exigeCohorteDestino,
  [clave("T21", "proxima_cohorte")]: exigeCohorteDestino,

  // Proxima Cohorte vuelve al camino
  [clave("T22", "en_contacto")]: exigeContactoNuevo,
  [clave("T23", "agendado")]: exigeLlamadaConFecha,

  // Seguimiento (la 11)
  [clave("T24", "seguimiento")]: exigeFechaSeguimiento,
  [clave("T25", "compromiso_verbal")]: exigeCompromiso,
  [clave("T26", "abonado")]: exigeAbono("abonado", false),
  [clave("T26", "completo")]: exigeAbono("completo", false),
  [clave("T27", "agendado")]: exigeLlamadaConFecha,
  [clave("T28", "proxima_cohorte")]: exigeCohorteDestino,
  [clave("T29", "pendiente_reagenda")]: exigeMotivo,

  // P: perdida desde las nueve etapas abiertas
  [clave("P", "cierre_perdido")]: exigeMotivo,

  // R: recuperacion desde cierre_perdido
  [clave("R", "en_contacto")]: exigeMotivo,
  [clave("R", "agendado")]: exigeMotivo,
  [clave("R", "proxima_cohorte")]: exigeMotivo,

  // A1: se anula el unico abono y Abonado vuelve a su etapa previa
  [clave("A1", "en_contacto")]: exigeAnulacionConMotivo,
  [clave("A1", "atendido")]: exigeAnulacionConMotivo,
  [clave("A1", "compromiso_verbal")]: exigeAnulacionConMotivo,
  [clave("A1", "seguimiento")]: exigeAnulacionConMotivo,
  // A2: se anula un abono de Completo y reaparece saldo
  [clave("A2", "abonado")]: exigeAnulacionConMotivo,
};

/** El mapa de requisitos, para el guardian del test (cada flecha tiene entrada). */
export { REQUISITOS };

/**
 * El requisito que falta para mover un deal de `de` a `a`, o `null` si se cumple.
 *
 * Devuelve UN solo faltante (no una lista): el ticket pide "el requisito que falta", y
 * un compromiso sin producto ni fecha muestra primero el producto, arregla y vuelve a
 * pedir la fecha — un paso a la vez es lo que el closer entiende en la pantalla. Los
 * predicados compuestos (compromiso, abono) ya ordenan sus faltantes de dentro.
 *
 * Si la flecha `de → a` no esta en la lista blanca (ticket 043), lanza
 * `TransicionInexistenteError`: NO inventa un requisito. Validar que la flecha existe es
 * trabajo de `transicionPermitida`; aca se asume que el llamador ya paso por ahi, y el
 * throw es la red de seguridad si no lo hizo.
 */
export function requisitoFaltante(de: EtapaDeal, a: EtapaDeal, hechos: HechosDelDeal): Faltante | null {
  const t = transicion(de, a);
  if (!t) throw new TransicionInexistenteError(de, a);
  const requisito = REQUISITOS[clave(t.id, a)];
  if (!requisito) {
    // Una flecha en la lista blanca sin requisito seria un hueco silencioso: el motor
    // dejaria pasar cualquier deal. El guardian del test lo caza antes; esto es la red.
    throw new Error(`La transicion ${t.id} (${de} → ${a}) no tiene requisito definido.`);
  }
  return requisito(hechos);
}
