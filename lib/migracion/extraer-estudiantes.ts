import type { EtapaDeal } from "@/lib/deals/etapas";
import { MapeoInvalidoError } from "@/lib/sheets/mapeo";
import {
  celda,
  columna,
  diaDe,
  filaDeLaHoja,
  filaVacia,
  instante,
  limpiar,
  monto,
  correoDeLaFila,
  normalizarTexto,
  siNo,
} from "./celdas";
import { extraccionVacia, type Extraccion } from "./template";

/**
 * Una pestaña de `Estudiantes` → un deal en Abonado/Completo por estudiante y su abono
 * (ticket 077, ADR 0059). Pura.
 *
 * - **Lo cobrado** es `Cash collected` donde existe. Donde no (las pestañas de la primera cohorte), es el
 *   `Precio` cuando el pago es `Total`; un `Parcial` ahi no dice cuanto se cobro.
 * - **Etapa:** Completo si lo cobrado cubre el precio, Abonado si no. **Lo que no se sabe no se
 *   inventa** (ADR 0059 punto 7): sin monto cobrado (`Parcial` sin cash, `Ya pago`), el deal
 *   entra en Compromiso Verbal, sin abono, y queda como rareza.
 * - **Fecha:** la de la columna de fecha si la pestaña la tiene; si no, nula y marcada: el
 *   importador pone el cierre de ventas de la cohorte (punto 6).
 * - `Origen`, `Numero de asistentes`, `Factura` y `Acceso` no se leen (080).
 * - **"Cohorte pasada"** (080): en una pestaña de septiembre, una celda combinada con ese
 *   texto en la columna de fecha abre un bloque de estudiantes que vienen de la cohorte anterior. El
 *   bloque sigue mientras la celda de fecha este vacia y termina en la primera fila con fecha. Esas
 *   filas salen con `movidoDesde` = `cohortePasadaDesde`; si la pestaña trae el bloque y no se configuro
 *   de donde vienen, falla ruidosamente en vez de dejarlos como estudiantes de septiembre.
 */

export interface OpcionesEstudiantes {
  programa: string;
  /** El nombre corto de la pestaña para la huella (`estudiantes-julio`). */
  pestana: string;
  /** El codigo de la cohorte a la que pertenece la pestaña. */
  cohorte: string;
  /**
   * Una pestaña de julio escribio notas de pago en `Situación profesional` (`segundo pago 17 de agosto`):
   * ahi son el acuerdo de pago. En las demas es la situacion, que ya esta en el envio.
   */
  situacionEsAcuerdoDePago?: boolean;
  /** El codigo de la cohorte de la que vienen las filas del bloque "Cohorte pasada" (080). */
  cohortePasadaDesde?: string;
}

const COHORTE_PASADA = "cohorte pasada";

export function extraerEstudiantes(matriz: readonly (readonly unknown[])[], op: OpcionesEstudiantes): Extraccion {
  const salida = extraccionVacia();
  const [encabezados = [], ...datos] = matriz;
  const cab = encabezados.map((h) => String(h ?? ""));

  const col = {
    correo: columna(cab, "Correo"),
    whatsapp: columna(cab, "WhatsApp"),
    closer: columna(cab, "Closer"),
    precio: columna(cab, "Precio final", "Precio"),
    cash: columna(cab, "Cash collected"),
    tipo: columna(cab, "Tipo de pago"),
    plataforma: columna(cab, "Plataforma de pago"),
    onboarding: columna(cab, "Mail onboarding", "Mail/ Mensaje onboarding"),
    situacion: columna(cab, "Situación profesional"),
    // Una pestaña de septiembre trae la fecha de venta en una columna `x` sin nombre (080).
    fecha: columna(cab, "Fecha", "x"),
  };
  if (col.correo < 0) throw new MapeoInvalidoError("correo", ["correo"], cab);
  if (col.precio < 0) throw new MapeoInvalidoError("precio", ["precio final", "precio"], cab);

  const vistos = new Set<string>();
  let enCohortePasada = false;
  datos.forEach((fila, i) => {
    if (filaVacia(fila)) return;
    const n = filaDeLaHoja(i);
    const marcaDeFecha = normalizarTexto(celda(fila, col.fecha));
    if (marcaDeFecha === COHORTE_PASADA) {
      if (!op.cohortePasadaDesde) {
        throw new MapeoInvalidoError(`cohortePasadaDesde de ${op.pestana}`, ["cohortePasadaDesde"], [
          `La fila ${n} abre un bloque "Cohorte pasada" y no se configuró de qué cohorte vienen.`,
        ]);
      }
      enCohortePasada = true;
    } else if (marcaDeFecha !== "") {
      enCohortePasada = false;
    }
    const correo = correoDeLaFila(fila, col.correo, col.whatsapp);
    if (!correo) {
      salida.rarezas.push({
        huella: `sheets:${op.programa}:${op.pestana}:fila-${n}`,
        tipo: "sin_correo",
        detalle: `Fila ${n} de ${op.pestana} sin correo: no se puede unir a un lead.`,
      });
      return;
    }
    const huella = `sheets:${op.programa}:${op.pestana}:${correo}`;
    if (vistos.has(correo)) {
      salida.rarezas.push({
        huella: `${huella}:fila-${n}`,
        tipo: "correo_repetido",
        detalle: `El correo ya aparecio antes en ${op.pestana}; se migra solo la primera fila (fila ${n}).`,
      });
      return;
    }
    vistos.add(correo);

    const precioCrudo = celda(fila, col.precio);
    const precio = monto(precioCrudo);
    const tipo = normalizarTexto(celda(fila, col.tipo));
    let cobrado: string | null;
    if (col.cash >= 0) cobrado = monto(celda(fila, col.cash));
    else cobrado = tipo === "total" ? precio : null;

    const fecha = instante(celda(fila, col.fecha));
    let etapa: EtapaDeal;
    if (cobrado == null || Number(cobrado) <= 0) {
      etapa = "compromiso_verbal";
      salida.rarezas.push({
        huella,
        tipo: "monto_cobrado_desconocido",
        detalle: `No se sabe cuánto se cobró (tipo de pago "${String(celda(fila, col.tipo) ?? "")}", precio "${String(precioCrudo ?? "")}"): entra en Compromiso Verbal sin abono.`,
      });
    } else if (precio != null && Number(cobrado) >= Number(precio)) {
      etapa = "completo";
    } else {
      etapa = "abonado";
    }
    if (precio == null) {
      salida.rarezas.push({
        huella,
        tipo: "precio_desconocido",
        detalle: `El precio "${String(precioCrudo ?? "")}" no es un número.`,
      });
    }

    const situacion = limpiar(celda(fila, col.situacion));
    salida.deals.push({
      huella,
      correo,
      etapa,
      closer: limpiar(celda(fila, col.closer)),
      fechaEtapa: fecha,
      cohorte: op.cohorte,
      precio,
      acuerdoPago: op.situacionEsAcuerdoDePago ? situacion : null,
      mailOnboarding: siNo(celda(fila, col.onboarding)) === "si",
      notas: [],
      ...(enCohortePasada ? { movidoDesde: op.cohortePasadaDesde } : {}),
    });

    if (etapa !== "compromiso_verbal" && cobrado != null) {
      salida.abonos.push({
        huella: `${huella}:abono`,
        dealHuella: huella,
        fecha: fecha ? diaDe(fecha) : null,
        monto: cobrado,
        plataforma: limpiar(celda(fila, col.plataforma)),
        closer: limpiar(celda(fila, col.closer)),
      });
      if (!fecha) {
        salida.rarezas.push({
          huella: `${huella}:abono`,
          tipo: "fecha_aproximada",
          detalle: `${op.pestana} no dice la fecha del pago: se usa el cierre de ventas de la cohorte ${op.cohorte}.`,
        });
      }
    }
  });

  return salida;
}
