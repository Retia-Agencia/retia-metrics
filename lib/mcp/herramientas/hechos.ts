import { z } from "zod";
import { veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota, num } from "@/lib/format";
import { parsearPeriodoUrl } from "@/lib/periodo";
import { salidaDeConsultaDeHechos } from "@/lib/mcp/salidas/hechos";
import { DIMENSIONES_DEL_EQUIPO_COMERCIAL, HECHOS_CONSULTABLES, type HechoConsultable } from "@/lib/queries/hechos/registro";
import { nombresDeUsuariosYCohortes, resolverCohorte, resolverDueno, type FiltroAplicado } from "@/lib/queries/resolver-filtros";
import { resolverContextoDeVista } from "@/lib/queries/vista-dashboard";
import { busquedaDePeriodoMcp, camposDePeriodoMcp, presetDePeriodoMcp } from "./periodo";
import { programaVisible } from "./programa";
import type { Herramienta } from "./tipos";

const hechos = Object.keys(HECHOS_CONSULTABLES) as [HechoConsultable, ...HechoConsultable[]];
const dimensiones = [...new Set(Object.values(HECHOS_CONSULTABLES).flatMap((hecho) => hecho.dimensiones))] as [string, ...string[]];
const valorDeFiltro = z.union([z.string().max(200), z.null()]);

const entrada = z.object({
  programa: z.string().min(1).max(100),
  hecho: z.enum(hechos),
  ...camposDePeriodoMcp,
  agrupar_por: z.array(z.enum(dimensiones)).max(3).optional(),
  filtros: z.partialRecord(z.enum(dimensiones), z.array(valorDeFiltro).max(50)).optional(),
  orden: z.object({ campo: z.string().min(1).max(100), sentido: z.enum(["asc", "desc"]) }).strict().optional(),
  campos: z.array(z.string().min(1).max(100)).max(50).optional(),
  pagina: z.number().int().min(1).max(1_000_000).default(1),
  tamano_de_pagina: z.number().int().min(1).max(200).default(50),
}).strict().superRefine((valor, contexto) => {
  const validas = new Set(HECHOS_CONSULTABLES[valor.hecho].dimensiones);
  for (const dimension of valor.agrupar_por ?? []) if (!validas.has(dimension as never)) contexto.addIssue({ code: "custom", path: ["agrupar_por"], message: `${dimension} no existe para ${valor.hecho}.` });
  for (const dimension of Object.keys(valor.filtros ?? {})) if (!validas.has(dimension as never)) contexto.addIssue({ code: "custom", path: ["filtros", dimension], message: `${dimension} no existe para ${valor.hecho}.` });
});

const nombresCanonicos: Record<string, string> = {
  envioId: "id_del_envio",
  callId: "id_de_la_llamada",
  dealId: "id_del_deal",
  abonoId: "id_del_abono",
  horaMinuto: "hora_minuto",
};

function canonizarFila(fila: Record<string, unknown>): Record<string, string | number | null> {
  return Object.fromEntries(Object.entries(fila).flatMap(([clave, valor]) => {
    if (clave === "gastoId") return [];
    if (valor === null || typeof valor === "string" || typeof valor === "number") return [[nombresCanonicos[clave] ?? clave, valor]];
    return [];
  }));
}

async function resolverFiltros(
  contexto: Parameters<typeof consultarHechosMcp.ejecutar>[0],
  programa: { id: string; nombre: string },
  pedidos: Partial<Record<string, (string | null)[]>> | undefined,
) {
  const filtros: Record<string, readonly (string | null)[]> = {};
  const aplicados: FiltroAplicado[] = [];
  for (const [dimension, valores] of Object.entries(pedidos ?? {})) {
    if (!valores) continue;
    if (dimension === "dueno") {
      const resueltos = await Promise.all(valores.filter((v): v is string => v !== null).map((valor) => resolverDueno(contexto.db, programa.id, programa.nombre, valor)));
      filtros.dueno = [...resueltos.map((filtro) => filtro.id), ...(valores.includes(null) ? [null] : [])];
      aplicados.push(...resueltos);
      if (valores.includes(null)) aplicados.push({ campo: "dueno", id: null, nombre: "Sin dueño", origen: "pedido" });
    } else if (dimension === "cohorte") {
      const resueltos = await Promise.all(valores.filter((v): v is string => v !== null).map((valor) => resolverCohorte(contexto.db, programa.id, programa.nombre, valor)));
      const todas = resueltos.some((filtro) => filtro.id === null);
      if (todas && valores.length > 1) throw new ErrorDeApp("todas no se combina con otras cohortes", 422);
      if (!todas) filtros.cohorte = [...resueltos.map((filtro) => filtro.id), ...(valores.includes(null) ? [null] : [])];
      aplicados.push(...resueltos);
      if (valores.includes(null)) aplicados.push({ campo: "cohorte", id: null, nombre: "Sin cohorte", origen: "pedido" });
    } else {
      filtros[dimension] = valores;
      aplicados.push(...valores.map((valor) => ({ campo: dimension, id: valor, nombre: valor ?? "Sin valor", origen: "pedido" as const })));
    }
  }
  return { filtros, aplicados };
}

export const consultarHechosMcp: Herramienta<typeof entrada> = {
  nombre: "consultar_hechos",
  titulo: "Consultar hechos",
  descripcion:
    "Úsala cuando necesites listar o agrupar los hechos base del CRM: envíos, agendas, citas, ventas, abonos o gasto de pauta. Pagina en la base y conserva la moneda nativa; el gasto convertido a USD pertenece a ROAS de pauta. Los filtros de dueño y cohorte aceptan nombre o identificador.",
  entrada,
  salida: salidaDeConsultaDeHechos,
  puede: (contexto) => veTableroDelPrograma(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, pedido) {
    const programa = await programaVisible(contexto, pedido.programa);
    const definicion = HECHOS_CONSULTABLES[pedido.hecho];
    const dimensionesPedidas = new Set([...(pedido.agrupar_por ?? []), ...Object.keys(pedido.filtros ?? {}), pedido.orden?.campo, ...(pedido.campos ?? [])].filter(Boolean));
    const veEquipo = veEquipoComercial(contexto.rol);
    if (DIMENSIONES_DEL_EQUIPO_COMERCIAL.some((dimension) => dimensionesPedidas.has(dimension)) && !veEquipo) {
      throw new ErrorDeApp("Tu rol no ve el trabajo por closer", 403);
    }
    const periodoPedido = await resolverContextoDeVista({
      programId: programa.id,
      hoy: hoyEnBogota(),
      periodo: parsearPeriodoUrl(busquedaDePeriodoMcp(pedido)),
      preset: presetDePeriodoMcp(pedido),
    }, contexto.db);
    const rango = periodoPedido.periodo.a;
    const { filtros, aplicados } = await resolverFiltros(contexto, programa, pedido.filtros);
    const agrupado = (pedido.agrupar_por?.length ?? 0) > 0;
    const ordenables = new Set<string>([...(agrupado ? definicion.dimensiones : definicion.camposDeLista), ...definicion.medidas]);
    if (pedido.orden && !ordenables.has(pedido.orden.campo)) throw new ErrorDeApp(`No puedes ordenar por "${pedido.orden.campo}". Opciones: ${[...ordenables].join(", ")}`, 422);
    const validos = new Set<string>(agrupado ? [...definicion.dimensiones, ...definicion.medidas] : definicion.camposDeLista);
    for (const campo of pedido.campos ?? []) if (!validos.has(campo)) throw new ErrorDeApp(`No existe el campo "${campo}". Opciones: ${[...validos].join(", ")}`, 422);
    const opciones = { programId: programa.id, rango, filtros, orden: pedido.orden, pagina: { numero: pedido.pagina, tamano: pedido.tamano_de_pagina } };
    const modulo = definicion.modulo;
    let filasCrudas: Record<string, unknown>[];
    let total: number;
    if (agrupado) {
      const agrupadas = { ...opciones, agruparPor: pedido.agrupar_por! };
      [filasCrudas, total] = await Promise.all([modulo.agrupar(contexto.db, agrupadas), modulo.contarGrupos(contexto.db, agrupadas)]);
    } else {
      const resultado = await modulo.listar(contexto.db, opciones);
      filasCrudas = resultado.filas;
      total = resultado.total;
    }
    const canonicas = filasCrudas.map(canonizarFila);
    const userIds = canonicas.flatMap((fila) => [fila.dueno, fila.registrado_por]).filter((id): id is string => typeof id === "string");
    const cohorteIds = canonicas.map((fila) => fila.cohorte).filter((id): id is string => typeof id === "string");
    const nombres = await nombresDeUsuariosYCohortes(contexto.db, userIds, cohorteIds);
    const enriquecidas = canonicas.map((fila) => ({
      ...fila,
      ...(typeof fila.dueno === "string" ? { dueno_nombre: nombres.usuarios.get(fila.dueno) ?? "Sin nombre" } : {}),
      ...(typeof fila.registrado_por === "string" ? { registrado_por_nombre: nombres.usuarios.get(fila.registrado_por) ?? "Sin nombre" } : {}),
      ...(typeof fila.cohorte === "string" ? { cohorte_nombre: nombres.cohortes.get(fila.cohorte) ?? "Sin código" } : {}),
    }));
    const predeterminados = agrupado
      ? [...pedido.agrupar_por!, ...(["abono", "gasto"].includes(pedido.hecho) ? ["moneda"] : []), ...definicion.medidas]
      : definicion.camposDeLista.filter((campo) => campo.startsWith("id_") || ["dia", "semana", "mes", "area"].includes(campo));
    const campos = pedido.campos ?? predeterminados;
    const esDelEquipoComercial = (clave: string) => DIMENSIONES_DEL_EQUIPO_COMERCIAL.some(
      (dimension) => clave === dimension || clave === `${dimension}_nombre`,
    );
    const filas = enriquecidas.map((fila) => Object.fromEntries(Object.entries(fila).filter(([clave]) =>
      (veEquipo || !esDelEquipoComercial(clave))
      && (campos.includes(clave) || campos.some((campo) => clave === `${campo}_nombre`)),
    )));
    const hayOtra = pedido.pagina * pedido.tamano_de_pagina < total;
    const estructurado = { programa: { nombre: programa.nombre, slug: programa.slug }, hecho: pedido.hecho, periodo: rango, filtros_aplicados: aplicados, agrupado, filas, total, pagina: pedido.pagina, tamano_de_pagina: pedido.tamano_de_pagina, hay_otra_pagina: hayOtra };
    return { texto: `${num(filas.length)} ${agrupado ? "grupos" : "filas"} de ${num(total)}. ${hayOtra ? `Hay otra página; pide pagina ${pedido.pagina + 1}.` : "No hay otra página."}`, estructurado };
  },
};
