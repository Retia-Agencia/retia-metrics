import type { EtapaDeal } from "@/lib/deals/etapas";
import { MapeoInvalidoError } from "@/lib/sheets/mapeo";
import {
  celda,
  columna,
  diaDe,
  diasEntre,
  filaDeLaHoja,
  filaVacia,
  instante,
  limpiar,
  correoDeLaFila,
  normalizarTexto,
} from "./celdas";
import { extraccionVacia, type Extraccion, type NotaTemplate } from "./template";

/**
 * La pestaña `📞 Setteo No Calificados` → deals historicos con sus notas (ticket 077, ADR
 * 0059). Logica pura: recibe la matriz ya leida.
 *
 * El alcance es la decision de Mani del 28-sep (ticket 080), con el alcance como PARAMETRO:
 * - **Deal** para todo `En proceso`, todo lo que tenga actividad de un closer (fecha de
 *   contacto o algun `Registro`) y los `Pendiente` de los ultimos `diasDeCorte` dias.
 * - **Sin deal**: `No interesado`, `Cerrado` y la cola vieja de `Pendiente` sin actividad.
 *   `total` mete tambien la cola vieja; `No interesado`/`Cerrado` no cambian.
 *
 * La etapa sale del `Estado gestion` y **no se adivina**: un `Pendiente` con notas queda en
 * Pendiente Setteo y marcado (es un estado inconsistente de la hoja), y un `Agendado` queda
 * en En Contacto marcado, porque su etapa la decide la llamada y no el texto (080).
 */

export type AlcanceSetteo = "trabajado-y-reciente" | "total";

export interface OpcionesSetteo {
  /** El slug del programa: va en la huella. */
  programa: string;
  /** Hoy en Bogota (`YYYY-MM-DD`), para el corte de los `Pendiente`. */
  hoy: string;
  alcance: AlcanceSetteo;
  diasDeCorte: number;
}

const REGISTROS = ["Registro 1", "Registro 2", "Registro 3", "Registro 4", "Registro 5"];

export function extraerSetteo(matriz: readonly (readonly unknown[])[], op: OpcionesSetteo): Extraccion {
  const salida = extraccionVacia();
  const [encabezados = [], ...datos] = matriz;
  const cab = encabezados.map((h) => String(h ?? ""));

  const col = {
    correo: columna(cab, "Correo"),
    whatsapp: columna(cab, "WhatsApp"),
    // En una de las hojas la columna A no tiene nombre (`Columna 1`) y es la fecha de deteccion.
    deteccion: columna(cab, "Fecha detección", "Columna 1"),
    closer: columna(cab, "Closer asignado", "Responsable"),
    estado: columna(cab, "Estado gestión"),
    contacto: columna(cab, "Fecha de contacto"),
    ultimo: columna(cab, "Fecha de ultimo contacto"),
    registros: REGISTROS.map((r) => columna(cab, r)),
  };
  // Sin correo o sin estado no hay migracion posible: falla ruidosamente, nunca adivina.
  if (col.correo < 0) throw new MapeoInvalidoError("correo", ["correo"], cab);
  if (col.estado < 0) throw new MapeoInvalidoError("estado", ["estado gestion"], cab);

  const vistos = new Set<string>();
  datos.forEach((fila, i) => {
    if (filaVacia(fila)) return;
    const correo = correoDeLaFila(fila, col.correo, col.whatsapp);
    if (!correo) {
      salida.rarezas.push({
        huella: `sheets:${op.programa}:setteo:fila-${filaDeLaHoja(i)}`,
        tipo: "sin_correo",
        detalle: `Fila ${filaDeLaHoja(i)} del Setteo sin correo: no se puede unir a un lead.`,
      });
      return;
    }
    const huella = `sheets:${op.programa}:setteo:${correo}`;
    if (vistos.has(correo)) {
      salida.rarezas.push({
        huella: `${huella}:fila-${filaDeLaHoja(i)}`,
        tipo: "correo_repetido",
        detalle: `El correo ya aparecio antes en el Setteo; se migra solo la primera fila (fila ${filaDeLaHoja(i)}).`,
      });
      return;
    }
    vistos.add(correo);

    const contacto = instante(celda(fila, col.contacto));
    const ultimo = instante(celda(fila, col.ultimo));
    const deteccion = instante(celda(fila, col.deteccion));
    const textos = col.registros.map((c) => limpiar(celda(fila, c)));
    const notas = notasDeRegistros(textos, contacto, ultimo);
    const conActividad = contacto != null || ultimo != null || notas.length > 0;
    const estadoCrudo = limpiar(celda(fila, col.estado));
    const estado = normalizarTexto(estadoCrudo);

    const deal = (etapa: EtapaDeal, fechaEtapa: string | null) =>
      salida.deals.push({
        huella,
        correo,
        etapa,
        closer: limpiar(celda(fila, col.closer)),
        fechaEtapa,
        cohorte: null,
        precio: null,
        acuerdoPago: null,
        mailOnboarding: false,
        notas,
      });

    switch (estado) {
      case "no interesado":
        salida.sinDeal.push({ huella, razon: "no_interesado" });
        return;
      case "cerrado":
        salida.sinDeal.push({ huella, razon: "cerrado" });
        return;
      case "en proceso":
        deal("contactado", ultimo ?? contacto);
        return;
      case "agendado":
        deal("contactado", ultimo ?? contacto);
        salida.rarezas.push({
          huella,
          tipo: "agendado_por_decidir",
          detalle: "Setteo dice Agendado: entra en Contactado y su etapa la decide la llamada (080).",
        });
        return;
      case "pendiente":
        if (conActividad) {
          deal("registrado", deteccion);
          salida.rarezas.push({
            huella,
            tipo: "pendiente_con_notas",
            detalle: "Setteo dice Pendiente pero tiene actividad de un closer: estado inconsistente de la hoja.",
          });
          return;
        }
        if (op.alcance === "total") {
          deal("registrado", deteccion);
          return;
        }
        if (!deteccion) {
          salida.sinDeal.push({ huella, razon: "pendiente_sin_fecha" });
          return;
        }
        if (diasEntre(diaDe(deteccion), op.hoy) <= op.diasDeCorte) deal("registrado", deteccion);
        else salida.sinDeal.push({ huella, razon: "pendiente_viejo_sin_actividad" });
        return;
      default:
        salida.rarezas.push({
          huella,
          tipo: "estado_desconocido",
          detalle: `Estado gestión "${estadoCrudo ?? ""}" no es uno de los conocidos: no se crea deal.`,
        });
    }
  });

  return salida;
}

/**
 * Cada `Registro N` no vacio es una nota. El primero lleva la `Fecha de contacto`; el ultimo,
 * la `Fecha de ultimo contacto` si la hoja la tiene (solo una de las dos). Los del medio no tienen
 * fecha real y no se les inventa una (080).
 */
function notasDeRegistros(textos: (string | null)[], contacto: string | null, ultimo: string | null): NotaTemplate[] {
  const presentes = textos
    .map((texto, n) => ({ texto, n }))
    .filter((r): r is { texto: string; n: number } => r.texto != null);
  return presentes.map(({ texto, n }, k) => {
    let fecha: string | null = null;
    if (n === 0) fecha = contacto;
    else if (k === presentes.length - 1) fecha = ultimo;
    return { texto: `Registro ${n + 1}: ${texto}`, fecha };
  });
}
