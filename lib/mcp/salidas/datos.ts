import { z } from "zod";
import { VISTAS_DE_LECTURA } from "@/lib/queries/mcp-lectura/catalogo";

const valor = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const salidaDeConsultarDatos = z.object({
  columnas: z.array(z.object({
    nombre: z.string().describe("Nombre de la columna devuelta."),
    tipo: z.enum(["texto", "numero", "fecha", "si_no", "otro"]).describe("Tipo de los valores de la columna."),
  }).strict()).describe("Columnas de la respuesta, en orden."),
  filas: z.array(z.record(z.string(), valor).describe("Una fila, por nombre de columna.")).describe("Filas devueltas, hasta el tope."),
  truncado: z.boolean().describe("Verdadero si había más filas que el tope: agrega filtros o agrupa antes de concluir nada."),
  limite: z.number().int().describe("Tope de filas aplicado a esta llamada."),
  vistas_usadas: z.array(z.enum(VISTAS_DE_LECTURA)).describe("Vistas de lectura que usa la consulta."),
  como_se_calculo: z.string().describe("Qué cuenta cada vista usada y con qué fecha, en palabras de negocio."),
  es_cifra_del_hub: z.literal(false).describe("Siempre falso: esta consulta es exploratoria y no es una cifra oficial del Hub."),
  metricas_del_hub_relacionadas: z.array(z.object({
    clave: z.string().describe("Clave de la métrica del Hub."),
    nombre: z.string().describe("Nombre de la métrica en el Hub."),
  }).strict()).describe("Métricas registradas del Hub que miden lo mismo: para una cifra oficial usa consultar_metrica."),
}).strict();

export const salidaDeDefiniciones = z.object({
  consultar_datos_disponible: z.boolean().describe("Si consultar_datos está habilitada en este servidor."),
  reglas: z.array(z.string()).describe("Reglas que acompañan a toda consulta de datos."),
  vistas: z.array(z.object({
    nombre: z.string().describe("Nombre de la vista, dentro del esquema mcp_lectura."),
    fila: z.string().describe("Qué es una fila."),
    cuenta: z.string().describe("Qué cuenta y qué no, en palabras de negocio."),
    fecha: z.string().describe("Con qué fecha se ubica una fila en un periodo."),
    vigencia: z.string().describe("Qué registros anulados o descartados quedan fuera."),
    columnas: z.array(z.object({
      nombre: z.string().describe("Nombre de la columna."),
      tipo: z.enum(["texto", "fecha", "numero", "si_no", "id"]).describe("Tipo de la columna."),
      descripcion: z.string().describe("Qué significa."),
    }).strict()).describe("Columnas de la vista."),
    metricas_del_hub: z.array(z.object({
      clave: z.string().describe("Clave de la métrica."),
      nombre: z.string().describe("Nombre en el Hub."),
      que: z.string().describe("Qué mide."),
      formula: z.object({
        forma: z.enum(["razon", "suma", "conteo", "resta", "producto"]).describe("Operación."),
        terminos: z.array(z.string()).describe("Partes de la fórmula, en orden."),
      }).strict().describe("Fórmula en palabras de negocio."),
      se_ubica_por: z.string().describe("Con qué fecha se ubica en un periodo."),
      monedas: z.array(z.string()).describe("Monedas en que se expresa; vacío si no es dinero."),
      cobertura: z.string().describe("Cómo dice la métrica lo que no pudo calcular."),
      consultar_con: z.string().describe("Herramienta que devuelve la cifra oficial."),
    }).strict()).describe("Métricas registradas del Hub que salen de esta vista: su definición es la oficial."),
  }).strict()).describe("Vistas descritas."),
}).strict();
