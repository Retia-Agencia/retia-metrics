import { ErrorDeApp } from "@/lib/errors";
import { TOPE_DE_LA_CONSULTA_MS, type ConexionDeLectura, type ResultadoDeConsulta } from "@/lib/db/mcp-lectura";
import { VISTAS_DE_LECTURA, type VistaDeLectura } from "@/lib/queries/mcp-lectura/catalogo";
import { validarSoloSelect } from "@/lib/queries/mcp-lectura/validar";

export const FILAS_POR_DEFECTO = 200;
export const FILAS_MAXIMAS = 1_000;

export type Valor = string | number | boolean | null;

export interface ColumnaDevuelta {
  nombre: string;
  /** Tipo de Postgres en palabras (texto, numero, fecha, si_no). */
  tipo: "texto" | "numero" | "fecha" | "si_no" | "otro";
}

export interface ResultadoDeDatos {
  columnas: ColumnaDevuelta[];
  filas: Record<string, Valor>[];
  truncado: boolean;
  limite: number;
  vistas: VistaDeLectura[];
}

const TIPOS: Record<number, ColumnaDevuelta["tipo"]> = {
  16: "si_no", 20: "numero", 21: "numero", 23: "numero", 700: "numero", 701: "numero", 1700: "numero",
  25: "texto", 1043: "texto", 18: "texto", 19: "texto", 2950: "texto", 1082: "fecha", 1114: "fecha", 1184: "fecha",
};

function serializar(valor: unknown): Valor {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" || typeof valor === "boolean") return valor;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "bigint") return Number(valor);
  if (valor instanceof Date) return valor.toISOString();
  return JSON.stringify(valor);
}

/** Nombres de columna únicos: un `select a, a` no puede perder una de las dos en el objeto de la fila. */
function nombresUnicos(nombres: readonly string[]): string[] {
  const vistos = new Map<string, number>();
  return nombres.map((nombre) => {
    const n = (vistos.get(nombre) ?? 0) + 1;
    vistos.set(nombre, n);
    return n === 1 ? nombre : `${nombre}_${n}`;
  });
}

/** Un error de la base se traduce a lo que la persona (o su agente) puede corregir; lo demás sube como error interno. */
function traducir(error: unknown): never {
  const codigo = (error as { code?: string }).code;
  const mensaje = error instanceof Error ? error.message : "";
  if (codigo === "57014") throw new ErrorDeApp(`La consulta pasó de ${TOPE_DE_LA_CONSULTA_MS / 1000} segundos y se canceló: acótala por programa, mes o día.`, 422);
  if (codigo === "25006") throw new ErrorDeApp("Solo se permite leer.", 403);
  if (codigo === "42501") {
    throw new ErrorDeApp("Esa consulta toca algo fuera de las vistas de lectura. Solo puedes leer las vistas de mcp_lectura (definiciones_de_metricas las describe).", 403);
  }
  if (codigo?.startsWith("42") || codigo?.startsWith("22")) throw new ErrorDeApp(`La consulta no es válida: ${mensaje}`, 422);
  throw error;
}

/**
 * La parte que acota la base (ADR 0135), separada de la validación para poder probarla con SQL hostil: primero fija
 * el alcance (`fijar_alcance`, que solo puede llamarse una vez por transacción), después baja a solo lectura, pone el
 * tope de tiempo y envuelve la consulta con un tope de filas. Siempre termina en ROLLBACK.
 * Quien la llama es responsable de haber validado el texto; la base es la barrera aunque no lo haya hecho.
 */
export async function ejecutarAcotado(
  conexion: ConexionDeLectura,
  pedido: { sql: string; programaIds: readonly string[]; veEquipo: boolean; limite: number },
): Promise<ResultadoDeConsulta> {
  return conexion.transaccion(async (consultar) => {
    await consultar("select mcp_lectura.fijar_alcance($1::uuid[], $2::boolean)", [[...pedido.programaIds], pedido.veEquipo]);
    await consultar("set local transaction_read_only = on");
    await consultar(`set local statement_timeout = ${TOPE_DE_LA_CONSULTA_MS}`);
    // El salto de línea antes del paréntesis es a propósito: un comentario `--` final del agente no se come el cierre.
    return consultar(`select * from (\n${pedido.sql}\n) as consulta limit $1`, [pedido.limite + 1]);
  });
}

/** Valida y ejecuta UN select del agente. */
export async function consultarDatos(
  conexion: ConexionDeLectura,
  pedido: { sql: string; programaIds: readonly string[]; veEquipo: boolean; limite?: number },
): Promise<ResultadoDeDatos> {
  const validacion = validarSoloSelect(pedido.sql, VISTAS_DE_LECTURA);
  if (!validacion.ok) throw new ErrorDeApp(validacion.mensaje, 422);
  const limite = Math.min(Math.max(pedido.limite ?? FILAS_POR_DEFECTO, 1), FILAS_MAXIMAS);
  try {
    const resultado = await ejecutarAcotado(conexion, { ...pedido, sql: validacion.sql, limite });
    const nombres = nombresUnicos(resultado.campos.map((campo) => campo.nombre));
    const truncado = resultado.filas.length > limite;
    const filas = resultado.filas.slice(0, limite).map((fila) =>
      Object.fromEntries(nombres.map((nombre, i) => [nombre, serializar(fila[i])])));
    return {
      columnas: resultado.campos.map((campo, i) => ({ nombre: nombres[i], tipo: TIPOS[campo.tipo] ?? "otro" })),
      filas,
      truncado,
      limite,
      vistas: validacion.vistas as VistaDeLectura[],
    };
  } catch (error) {
    return traducir(error);
  }
}
