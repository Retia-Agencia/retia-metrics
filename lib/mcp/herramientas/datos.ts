import { z } from "zod";
import { programasVisibles } from "@/lib/auth/alcance";
import { puedeConsultarDatos, veEquipoComercial } from "@/lib/auth/roles";
import { salidaDeConsultarDatos, salidaDeDefiniciones } from "@/lib/mcp/salidas/datos";
import { fichaDe, REGISTRO, type AnclaDeFecha, type ClaveRegistrada } from "@/lib/metricas/registro";
import {
  CATALOGO_DE_VISTAS,
  REGLAS_DE_LECTURA,
  VISTA_POR_ANCLA,
  VISTAS_DE_LECTURA,
  type TipoDeColumna,
  type VistaDeLectura,
} from "@/lib/queries/mcp-lectura/catalogo";
import { consultarDatos, FILAS_MAXIMAS, FILAS_POR_DEFECTO } from "@/lib/queries/mcp-lectura/consultar";
import { nombreDeConcepto } from "@/lib/vocabulario-metricas";
import { programaVisible } from "./programa";
import type { Herramienta } from "./tipos";

const entradaDatos = z.object({
  sql: z.string().min(1).max(8_000).describe("Un solo SELECT sobre las vistas del esquema mcp_lectura."),
  programa: z.string().min(1).max(100).optional().describe("Slug de un programa para acotar la consulta a ese programa. Sin él, ves todos los que te tocan."),
  limite: z.number().int().min(1).max(FILAS_MAXIMAS).default(FILAS_POR_DEFECTO).describe("Tope de filas devueltas."),
}).strict();

/** Las métricas registradas que se ubican en la vista por su ancla de fecha: su definición es la oficial. */
function metricasDeLaVista(vista: VistaDeLectura) {
  return (Object.keys(REGISTRO) as ClaveRegistrada[])
    .filter((clave) => {
      const ancla: AnclaDeFecha = fichaDe(clave).anclaDeFecha;
      return ancla !== "sin_fecha" && VISTA_POR_ANCLA[ancla] === vista;
    })
    .map((clave) => ({ clave, nombre: nombreDeConcepto(clave), ficha: fichaDe(clave) }));
}

const ANCLAS_EN_PALABRAS = {
  primera_entrada_a_venta: "día de su primera entrada a Abonado o Completo",
  fecha_del_abono: "fecha del abono",
  fecha_del_envio: "fecha del envío",
  fecha_de_creacion_de_la_cita: "fecha de creación de la cita",
  primera_aplicacion: "día de su primera aplicación",
  hora_de_la_cita: "hora de la cita",
  fecha_del_gasto: "día del gasto cargado",
  sin_fecha: "no se ubica en un periodo",
} as const satisfies Record<AnclaDeFecha, string>;

export const consultarDatosMcp: Herramienta<typeof entradaDatos> = {
  nombre: "consultar_datos",
  titulo: "Consultar datos",
  descripcion:
    "Úsala cuando ninguna otra herramienta responda la pregunta y necesites explorar los datos con un SELECT (cruces, listas largas, hipótesis). " +
    "Si la pregunta es una métrica registrada del Hub (ventas, citas, caja, tasas), usa consultar_metrica o resumen_del_hub: esas son las cifras oficiales. " +
    "Lee solo las vistas de mcp_lectura que describe definiciones_de_metricas, devuelve filas con tope y dice cómo se calculó; el resultado no es una cifra del Hub.",
  entrada: entradaDatos,
  salida: salidaDeConsultarDatos,
  puede: (contexto) => puedeConsultarDatos(contexto.rol) && Boolean(contexto.conexionDeLectura),
  soloLectura: true,
  async ejecutar(contexto, pedido) {
    const conexion = contexto.conexionDeLectura;
    if (!conexion) throw new Error("consultar_datos se ejecutó sin conexión de lectura.");
    const visibles = pedido.programa
      ? [await programaVisible(contexto, pedido.programa)]
      : await programasVisibles(contexto.session.user.id, contexto.rol, contexto.db);
    const resultado = await consultarDatos(conexion, {
      sql: pedido.sql,
      programaIds: visibles.map((programa) => programa.id),
      veEquipo: veEquipoComercial(contexto.rol),
      limite: pedido.limite,
    });
    const comoSeCalculo = resultado.vistas.length === 0
      ? "Consulta exploratoria sobre las vistas de lectura."
      : resultado.vistas.map((vista) => {
        const { cuenta, fecha } = CATALOGO_DE_VISTAS[vista];
        return `${vista}: ${cuenta} Se ubica por: ${fecha}`;
      }).join(" ");
    const relacionadas = [...new Map(resultado.vistas.flatMap(metricasDeLaVista).map((m) => [m.clave, { clave: m.clave, nombre: m.nombre }])).values()];
    const texto = `${resultado.filas.length} filas${resultado.truncado ? ` (hay más: tope de ${resultado.limite})` : ""}. ${comoSeCalculo} No es una cifra del Hub.`;
    return {
      texto,
      estructurado: {
        columnas: resultado.columnas,
        filas: resultado.filas,
        truncado: resultado.truncado,
        limite: resultado.limite,
        vistas_usadas: resultado.vistas,
        como_se_calculo: comoSeCalculo,
        es_cifra_del_hub: false,
        metricas_del_hub_relacionadas: relacionadas,
      },
    };
  },
};

const entradaDefiniciones = z.object({
  vista: z.enum(VISTAS_DE_LECTURA).optional().describe("Una vista concreta; sin ella devuelve todas."),
}).strict();

export const definicionesDeMetricasMcp: Herramienta<typeof entradaDefiniciones> = {
  nombre: "definiciones_de_metricas",
  titulo: "Definiciones de métricas",
  descripcion:
    "Úsala cuando vayas a usar consultar_datos y necesites saber qué vistas y columnas existen, qué cuenta cada una y con qué fecha, y qué métricas oficiales del Hub salen de ellas. " +
    "No consulta datos del negocio.",
  entrada: entradaDefiniciones,
  salida: salidaDeDefiniciones,
  puede: (contexto) => puedeConsultarDatos(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, pedido) {
    const nombres = pedido.vista ? [pedido.vista] : [...VISTAS_DE_LECTURA];
    const vistas = nombres.map((nombre) => {
      const definicion = CATALOGO_DE_VISTAS[nombre];
      const columnas = Object.entries(definicion.columnas as Record<string, { tipo: TipoDeColumna; descripcion: string }>)
        .map(([columna, datos]) => ({ nombre: columna, ...datos }));
      return {
        nombre,
        fila: definicion.fila,
        cuenta: definicion.cuenta,
        fecha: definicion.fecha,
        vigencia: definicion.vigencia,
        columnas,
        metricas_del_hub: metricasDeLaVista(nombre).map(({ clave, nombre: rotulo, ficha }) => ({
          clave,
          nombre: rotulo,
          que: ficha.que,
          formula: { forma: ficha.formula.forma, terminos: [...ficha.formula.terminos] },
          se_ubica_por: ANCLAS_EN_PALABRAS[ficha.anclaDeFecha],
          monedas: ficha.monedas.map((moneda) => moneda.toUpperCase()),
          cobertura: ficha.cobertura,
          consultar_con: "consultar_metrica",
        })),
      };
    });
    const disponible = Boolean(contexto.conexionDeLectura);
    return {
      texto: `${vistas.length} vistas descritas. ${disponible ? "" : "consultar_datos no está habilitada en este servidor: falta su conexión de lectura. "}Una métrica registrada se responde con consultar_metrica.`,
      estructurado: { consultar_datos_disponible: disponible, reglas: [...REGLAS_DE_LECTURA], vistas },
    };
  },
};
