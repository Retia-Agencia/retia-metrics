/**
 * Escribe y lee el bloque generado de `docs/metricas.md` (§3.0): las columnas ESTRUCTURADAS de cada concepto
 * registrado. Es puro (sin fs ni base); lo usan `scripts/generar-diccionario-metricas.ts` y
 * `tests/registro-de-metricas.test.ts`. La prosa de la fórmula NO se genera: sigue a mano en §3.1.
 */
import { REGISTRO, type ClaveRegistrada, type FichaDeMetrica } from "@/lib/metricas/registro";
import { nombreDeConcepto } from "@/lib/vocabulario-metricas";

export const MARCA_INICIO = "<!-- registro:inicio (generado por `npm run docs:metricas`; no editar a mano) -->";
export const MARCA_FIN = "<!-- registro:fin -->";

const UNIDADES = {
  cupos: "cupos", personas: "personas", citas: "citas", deals: "deals", dinero: "dinero", porcentaje: "%", veces: "veces",
} as const;
const ANCLAS = {
  primera_entrada_a_venta: "día de su primera entrada a Abonado o Completo",
  fecha_del_abono: "fecha del abono",
  fecha_del_envio: "fecha del envío",
  fecha_de_creacion_de_la_cita: "fecha de creación de la cita",
  primera_aplicacion: "día de su primera aplicación (Bogotá)",
  hora_de_la_cita: "hora de la cita (agenda, o la llamada si no tiene)",
  fecha_del_gasto: "día del gasto cargado (Bogotá)",
} as const;
const COBERTURAS = {
  no_aplica: "—",
  exclusiones_contadas_aparte: "excluye y cuenta aparte",
  razon_con_cobertura: "razón con cobertura",
} as const;

const referencia = (r: { archivo: string; nombre: string }) => `\`${r.nombre}\` (\`${r.archivo}\`)`;

function fila(clave: ClaveRegistrada, f: FichaDeMetrica): string {
  const monedas = f.monedas.length === 0 ? "—" : f.monedas.map((m) => m.toUpperCase()).join(" · ");
  const celdas = [
    `${nombreDeConcepto(clave)} (\`${clave}\`)`,
    f.tipo + (f.de ? ` de ${f.de.map((c) => `\`${c}\``).join(" y ")}` : ""),
    `${UNIDADES[f.unidad]}${f.monedas.length ? ` · ${monedas}` : ""}`,
    ANCLAS[f.anclaDeFecha],
    f.sumaEntreProgramas ? "sí" : "no",
    COBERTURAS[f.cobertura],
    f.dimensiones.map((d) => `\`${d}\``).join(", "),
    f.vigencia.map((t) => `\`${t}\``).join(", "),
    referencia(f.funcionSql) + (f.gemelaTs ? ` · gemela ${referencia(f.gemelaTs)}` : ""),
    f.listas.length ? f.listas.map((l) => `\`${l}\``).join(", ") : "—",
  ];
  return `| ${celdas.join(" | ")} |`;
}

/** El bloque completo, con marcas, tal como debe quedar en el documento. */
export function renderizarFichas(registro: Record<string, FichaDeMetrica> = REGISTRO): string {
  const cabecera = [
    "| Concepto | Tipo | Unidad · moneda | Se ubica por | ¿Se suma entre programas? | Cobertura | Dimensiones | Vigencia | Función | Listas |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  const filas = (Object.keys(registro) as ClaveRegistrada[]).map((c) => fila(c, registro[c]));
  return [MARCA_INICIO, ...cabecera, ...filas, MARCA_FIN].join("\n");
}

/** Devuelve el documento con el bloque entre marcas reemplazado; lanza si faltan las marcas. */
export function insertarBloque(documento: string, bloque: string): string {
  const desde = documento.indexOf(MARCA_INICIO);
  const hasta = documento.indexOf(MARCA_FIN);
  if (desde === -1 || hasta === -1 || hasta < desde) {
    throw new Error("docs/metricas.md no trae las marcas del registro (§3.0).");
  }
  return documento.slice(0, desde) + bloque + documento.slice(hasta + MARCA_FIN.length);
}
