import { z } from "zod";
import { veEquipoComercial } from "@/lib/auth/roles";
import { dimensionesVisibles, HECHOS_CONSULTABLES } from "@/lib/queries/hechos/registro";
import type { Herramienta } from "./tipos";
import { ACCIONES, accionPorClave } from "@/lib/mcp/acciones";
import { COBERTURA_MCP } from "@/lib/mcp/cobertura";

const entrada = z.object({
  detalle: z.enum(["nombre", "resumen", "esquema"]).default("resumen"),
  herramienta: z.string().min(1).max(100).optional(),
  accion: z.string().min(1).max(100).optional(),
}).strict();

const consulta = z.object({
  nombre: z.string().describe("Nombre estable de la herramienta."),
  titulo: z.string().optional().describe("Título legible de la consulta."),
  descripcion: z.string().optional().describe("Cuándo usar la consulta y qué devuelve."),
  entrada: z.record(z.string(), z.unknown()).optional().describe("Esquema JSON de los argumentos aceptados."),
  hechos: z.record(z.string(), z.object({
    dimensiones: z.array(z.string()).describe("Formas válidas de agrupar y filtrar este hecho."),
    medidas: z.array(z.string()).describe("Cifras que entrega este hecho."),
    filtros: z.array(z.string()).describe("Filtros disponibles para el rol actual."),
  }).strict()).optional().describe("Contrato consultable de cada hecho base."),
}).strict().describe("Consulta que la persona actual puede usar.");

const salida = z.object({
  consultas: z.array(consulta).describe("Herramientas de lectura disponibles para el rol actual."),
  acciones: z.array(z.object({
    clave: z.string().describe("Nombre estable de la acción."),
    titulo: z.string().describe("Título legible de la acción."),
    cuando_usarla: z.string().describe("Situación en la que conviene preparar esta acción."),
    se_deshace: z.boolean().describe("Si una aplicación exitosa devuelve un evento para revertirla."),
    argumentos: z.record(z.string(), z.unknown()).optional().describe("Esquema JSON de los argumentos aceptados."),
    ejemplo: z.record(z.string(), z.unknown()).optional().describe("Ejemplo válido de argumentos."),
  }).strict()).describe("Acciones disponibles para el rol y la conexión actuales."),
  todavia_solo_en_la_app: z.array(z.object({
    grupo: z.enum(["operacion", "configuracion"]).describe("Tipo de capacidad pendiente."),
    capacidad: z.string().describe("Acción expresada en palabras de negocio."),
  }).strict()).describe("Capacidades que todavía se hacen solo en la app."),
}).strict();

export const capacidadesMcp: Herramienta<typeof entrada> = {
  nombre: "capacidades",
  titulo: "Capacidades",
  descripcion: "Úsala cuando necesites descubrir qué consultas puede hacer el rol actual o conocer el esquema, dimensiones, medidas y filtros de una herramienta antes de llamarla. No consulta datos del negocio ni ejecuta acciones.",
  entrada,
  salida,
  puede: () => true,
  soloLectura: true,
  async ejecutar(contexto, pedido) {
    // Importación diferida: index registra esta herramienta y una importación estática crearía un ciclo.
    const { herramientasPara } = await import("./index");
    const disponibles = herramientasPara(contexto).filter((herramienta) =>
      !["preparar_accion", "confirmar_cambio"].includes(herramienta.nombre)
      && (!pedido.herramienta || herramienta.nombre === pedido.herramienta));
    const consultas = disponibles.map((herramienta) => {
      const base: Record<string, unknown> = { nombre: herramienta.nombre };
      if (pedido.detalle !== "nombre") Object.assign(base, { titulo: herramienta.titulo, descripcion: herramienta.descripcion });
      if (pedido.detalle === "esquema") {
        base.entrada = z.toJSONSchema(herramienta.entrada, { io: "input", unrepresentable: "any" });
        if (herramienta.nombre === "consultar_hechos") {
          const veEquipo = veEquipoComercial(contexto.rol);
          base.hechos = Object.fromEntries(Object.entries(HECHOS_CONSULTABLES).map(([nombre, hecho]) => {
            const dimensiones = dimensionesVisibles(hecho.dimensiones, veEquipo);
            return [nombre, { dimensiones, medidas: hecho.medidas, filtros: dimensiones }];
          }));
        }
      }
      return base;
    });
    const seleccionada = pedido.accion ? accionPorClave(pedido.accion) : undefined;
    const acciones = contexto.escritura
      ? ACCIONES.filter((accion) => accion.puede(contexto) && (!pedido.accion || accion === seleccionada)).map((accion) => ({
          clave: accion.clave,
          titulo: accion.titulo,
          cuando_usarla: accion.cuandoUsarla,
          se_deshace: accion.seDeshace,
          ...(pedido.detalle === "esquema" ? {
            argumentos: z.toJSONSchema(accion.argumentos, { io: "input", unrepresentable: "any" }) as Record<string, unknown>,
            ejemplo: accion.ejemplo as Record<string, unknown>,
          } : {}),
        }))
      : [];
    const todaviaSoloEnLaApp = Object.values(COBERTURA_MCP)
      .filter((fila) => fila.clase === "pendiente")
      .map((fila) => ({ grupo: fila.grupo, capacidad: fila.capacidad }));
    return {
      texto: `${consultas.length} consultas y ${acciones.length} acciones disponibles. ${todaviaSoloEnLaApp.length} capacidades todavía solo en la app.`,
      estructurado: { consultas, acciones, todavia_solo_en_la_app: todaviaSoloEnLaApp },
    };
  },
};
