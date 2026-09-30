import { MapeoInvalidoError } from "@/lib/sheets/mapeo";
import {
  celda,
  columna,
  columnasExactas,
  filaDeLaHoja,
  filaVacia,
  instante,
  limpiar,
  correoDeLaFila,
  siNo,
} from "./celdas";
import { extraccionVacia, type Extraccion, type ResultadoTemplate } from "./template";

/**
 * La pestaña `Registro de llamadas` → llamadas historicas (ticket 077, ADR 0059). Pura.
 *
 * - **Resultado:** `Show = No` → `no_show`; `Show = Si` y `Cierre = Si` → `cerrada`;
 *   `Show = Si` → `show`; `Show` vacio → `agendada` y rareza. Si/No sin mayusculas. Un
 *   valor que no es Si ni No es rareza, nunca una adivinanza.
 * - **Llave:** el numero de fila (`sheets:<programa>:registro:<fila>`): la pestaña se
 *   escribe agregando al final. Una llamada sin correo entra igual y queda marcada; se
 *   cuelga de un deal solo por correo, nunca por cercania (ADR 0027).
 * - 🩸 **Los encabezados corridos de una de las hojas** (bug del `onEdit`): no hay `Registro 3` y
 *   hay DOS `Subcategoría`; la primera (col J) trae el texto del Registro 3 y la ultima es
 *   la subcategoria de verdad. Se detecta por esa forma exacta, no por el programa.
 * - 🩸 **Y en esa misma hoja la Categoria vive casi siempre en `Registro 2`** (revision a mano del
 *   080, 30-sep: 76 filas de toda la hoja la traen en la col I; `Categoría` solo se uso en 15). Con
 *   la forma corrida, si `Categoría` esta vacia y `Registro 2` es EXACTAMENTE una de
 *   `CATEGORIAS_DE_LLAMADA`, se lee como categoria y no como nota. Cualquier otro texto sigue
 *   siendo nota: es la lista cerrada, no un parecido (ADR 0027).
 */

/** Las categorias que la columna `Categoría` usa en las dos hojas (medido el 30-sep). */
export const CATEGORIAS_DE_LLAMADA: ReadonlySet<string> = new Set([
  "FOLLOW UP",
  "PENDIENTE RE AGENDA",
  "FIT/PRODUCTO",
  "RECHAZO DIRECTO",
  "FINANCIERO",
]);

export interface OpcionesLlamadas {
  programa: string;
}

export function extraerLlamadas(matriz: readonly (readonly unknown[])[], op: OpcionesLlamadas): Extraccion {
  const salida = extraccionVacia();
  const [encabezados = [], ...datos] = matriz;
  const cab = encabezados.map((h) => String(h ?? ""));

  const subcategorias = columnasExactas(cab, "Subcategoría");
  const corridos = columna(cab, "Registro 3") < 0 && subcategorias.length === 2;
  const registros = [1, 2, 3, 4, 5].map((n) =>
    n === 3 && corridos ? subcategorias[0] : columna(cab, `Registro ${n}`),
  );
  const col = {
    fecha: columna(cab, "Fecha"),
    closer: columna(cab, "Closer"),
    correo: columna(cab, "Correo"),
    whatsapp: columna(cab, "WhatsApp"),
    show: columna(cab, "Show"),
    cierre: columna(cab, "Cierre"),
    link: columna(cab, "Link de la llamada"),
    categoria: columna(cab, "Categoría"),
    subcategoria: subcategorias.length > 0 ? subcategorias[subcategorias.length - 1] : -1,
    cartera: columna(cab, "Cartera"),
  };
  if (col.show < 0) throw new MapeoInvalidoError("show", ["show"], cab);
  if (col.correo < 0) throw new MapeoInvalidoError("correo", ["correo"], cab);

  datos.forEach((fila, i) => {
    if (filaVacia(fila)) return;
    const n = filaDeLaHoja(i);
    const huella = `sheets:${op.programa}:registro:${n}`;
    const correo = correoDeLaFila(fila, col.correo, col.whatsapp);
    const fecha = instante(celda(fila, col.fecha));

    const show = siNo(celda(fila, col.show));
    const cierre = siNo(celda(fila, col.cierre));
    let resultado: ResultadoTemplate;
    if (show === "no") resultado = "no_show";
    else if (show === "si") resultado = cierre === "si" ? "cerrada" : "show";
    else resultado = "agendada";

    if (show === "vacio") {
      salida.rarezas.push({ huella, tipo: "sin_resultado", detalle: `Fila ${n}: Show vacío, entra como agendada.` });
    }
    const raros = [
      ["Show", show, celda(fila, col.show)],
      ["Cierre", cierre, celda(fila, col.cierre)],
    ] as const;
    for (const [campo, valor, crudo] of raros) {
      if (valor === "otro") {
        salida.rarezas.push({
          huella,
          tipo: "valor_desconocido",
          detalle: `Fila ${n}: ${campo} = "${String(crudo)}" no es Sí ni No.`,
        });
      }
    }
    if (!correo) {
      salida.rarezas.push({ huella, tipo: "sin_correo", detalle: `Fila ${n}: sin correo, la llamada entra suelta.` });
    }
    if (!fecha) {
      salida.rarezas.push({ huella, tipo: "sin_fecha", detalle: `Fila ${n}: sin fecha de llamada.` });
    }

    let categoria = limpiar(celda(fila, col.categoria));
    let registroQueEsCategoria = -1;
    if (corridos && !categoria) {
      const r2 = limpiar(celda(fila, registros[1]));
      if (r2 && CATEGORIAS_DE_LLAMADA.has(r2.toUpperCase())) {
        categoria = r2.toUpperCase();
        registroQueEsCategoria = 1;
      }
    }

    const partes = registros
      .map((c, k) => {
        if (k === registroQueEsCategoria) return null;
        const t = limpiar(celda(fila, c));
        return t ? `Registro ${k + 1}: ${t}` : null;
      })
      .filter((t): t is string => t != null);
    const cartera = limpiar(celda(fila, col.cartera));
    if (cartera) partes.push(`Cartera: ${cartera}`);

    salida.llamadas.push({
      huella,
      correo,
      fecha,
      closer: limpiar(celda(fila, col.closer)),
      resultado,
      categoria,
      subcategoria: limpiar(celda(fila, col.subcategoria)),
      link: limpiar(celda(fila, col.link)),
      notas: partes.length > 0 ? partes.join("\n") : null,
    });
  });

  return salida;
}
