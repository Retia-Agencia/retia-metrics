import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

/**
 * Prompts MCP para los analisis habituales de gerencia y pauta (407, ADR 0135). Un prompt no calcula nada: le
 * dice al agente que herramientas usar y en que orden, para que una cifra oficial salga de `consultar_metrica` o
 * `resumen_del_hub` y la exploracion libre quede para `consultar_datos`. Cada prompt solo se publica si el rol de
 * la conexion tiene las herramientas que nombra: si no, el cliente ofreceria un analisis que no puede hacer.
 */
interface DefinicionDePrompt {
  nombre: string;
  titulo: string;
  descripcion: string;
  herramientas: readonly string[];
  /** Texto del encargo; `mes` es AAAA-MM o undefined. */
  encargo(argumentos: { programa: string; mes: string | undefined }): string;
}

const REGLAS_COMUNES = [
  "Las cifras oficiales salen de las herramientas de métricas; di cuándo una cifra coincide con el Hub y cuándo es exploración libre y no lo es.",
  "Declara siempre el periodo, el programa, la moneda y qué cuenta y qué no cada cifra.",
  "Termina ofreciendo una comparación con el periodo anterior, un desglose y una gráfica.",
].join(" ");

export const PROMPTS_DE_ANALISIS: readonly DefinicionDePrompt[] = [
  {
    nombre: "cierre_de_mes",
    titulo: "Cierre de mes",
    descripcion: "Resumen del mes de un programa: ventas, dinero, citas, tasas, pérdidas y comparación con el mes anterior.",
    herramientas: ["resumen_del_hub", "consultar_metrica"],
    encargo: ({ programa, mes }) =>
      `Haz el cierre de mes de ${programa}${mes ? ` para ${mes}` : " del mes pasado"}. ` +
      "Usa resumen_del_hub para las cifras del mes (ventas, vendido, caja, citas, shows y tasas con su cobertura) y repite la consulta con el mes anterior para compararlos. " +
      "Abre con consultar_metrica las listas que expliquen los movimientos más grandes (ventas y entró a caja). Cierra con tres lecturas: qué mejoró, qué empeoró y qué falta por cobrar. " + REGLAS_COMUNES,
  },
  {
    nombre: "calidad_de_leads_por_campana",
    titulo: "Calidad de leads por campaña",
    descripcion: "Qué campañas traen registros que agendan y compran, y cuáles solo traen volumen.",
    herramientas: ["consultar_hechos", "consultar_metrica"],
    encargo: ({ programa, mes }) =>
      `Compara la calidad de los leads por campaña en ${programa}${mes ? ` durante ${mes}` : " en el último mes completo"}. ` +
      "Con consultar_hechos agrupa los envíos por campaña y, aparte, las agendas y las ventas por canal. Aclara que los envíos incluyen parciales y que Pauta cuenta registros completos (agrupa por tipo para separarlos). " +
      "Señala las campañas con muchos registros y pocas agendas, y las que agendan y compran. " + REGLAS_COMUNES,
  },
  {
    nombre: "roas_por_anuncio",
    titulo: "ROAS por anuncio",
    descripcion: "Rendimiento de la pauta por campaña, conjunto y anuncio, con lo vendido de cada cohorte de registro.",
    herramientas: ["pauta_roas"],
    encargo: ({ programa, mes }) =>
      `Revisa el ROAS de ${programa}${mes ? ` en ${mes}` : " en el mes en curso"}. ` +
      "Usa pauta_roas: ordena los anuncios por retorno, separa los que ya vendieron de los que aún no tienen ventas y di cuánto de lo vendido es de la cohorte de registro de cada anuncio. " +
      "Un ROAS sin cobertura completa se dice como parcial, y un monto va siempre con su moneda. " + REGLAS_COMUNES,
  },
];

const argumentos = z.object({
  programa: z.string().min(1).max(100).describe("Nombre o slug del programa; si no lo sabes, pídelo con programas_visibles."),
  mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Mes AAAA-MM (días de Bogotá). Sin él, el mes que corresponda al análisis."),
});

export function registrarPrompts(server: McpServer, herramientasDelRol: ReadonlySet<string>): void {
  for (const definicion of PROMPTS_DE_ANALISIS) {
    if (!definicion.herramientas.every((nombre) => herramientasDelRol.has(nombre))) continue;
    server.registerPrompt(
      definicion.nombre,
      { title: definicion.titulo, description: definicion.descripcion, argsSchema: argumentos },
      ({ programa, mes }) => ({
        messages: [{ role: "user" as const, content: { type: "text" as const, text: definicion.encargo({ programa, mes }) } }],
      }),
    );
  }
}
