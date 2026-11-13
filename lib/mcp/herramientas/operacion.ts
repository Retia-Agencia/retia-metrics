import { z } from "zod";
import { puedeVerFichaDeLead, puedeVerOperacion, veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { programasVisibles } from "@/lib/auth/alcance";
import { alcanceDeDeals } from "@/lib/auth/alcance-deals";
import { ErrorDeApp } from "@/lib/errors";
import { fechaDeInstanteEnBogota, monto, num } from "@/lib/format";
import { idOpacoSchema } from "@/lib/identificadores";
import { enlaceDeDeal, enlaceDeLead, enlaceDeTab } from "@/lib/mcp/enlaces";
import { conAlias } from "@/lib/mcp/vocabulario";
import { aSalidaDeBandeja, aSalidaDeBuscarLeads, aSalidaDeFichaDeDeal, aSalidaDeFichaDeLead, aSalidaDeTablero, salidaDeBandeja, salidaDeBuscar, salidaDeBuscarLeads, salidaDeFichaDeDeal, salidaDeFichaDeLead, salidaDeTablero } from "@/lib/mcp/salidas/operacion";
import { camposDeFiltrosDeLeads, filtrosDeLeads } from "@/lib/queries/filtros-de-leads";
import { alertasDelDeal } from "@/lib/queries/ficha-deal";
import { camposDeFiltrosKanban, opcionesDeTablero, paginaDelTablero, parsearFiltros, vistaDelTablero } from "@/lib/queries/kanban";
import { buscarEnPrograma } from "@/lib/queries/busqueda-global";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { dimensionesVisibles, HECHOS_CONSULTABLES } from "@/lib/queries/hechos/registro";
import { resolverCohorte, resolverDueno, type FiltroAplicado } from "@/lib/queries/resolver-filtros";
import { nombreDeEtapa } from "@/lib/queries/vista-metrica";
import { leadsDelPrograma } from "@/lib/queries/leads";
import { TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
import { bandejaParaActor, fichaDeDealVisible, fichaDeLeadParaActor } from "@/lib/queries/operacion";
import { programaVisible } from "./programa";
import type { Herramienta } from "./tipos";

const programa = z.string().min(1).max(100);
const pagina = z.number().int().min(1).max(1_000_000).default(1);

const CAMPOS_DE_BUSQUEDA = ["id_de_la_persona", "nombre", "email", "telefono", "enlace", "deals", "llamadas", "id_del_deal", "etapa", "dueno", "cohorte", "ultima_actividad", "ultimo_cambio_de_dueno", "pendiente"] as const;
const entradaBusqueda = z.object({
  texto: z.string().min(2).max(200),
  programa: programa.optional(),
  tipos: z.array(z.enum(["persona", "deal", "llamada"])).max(3).default(["persona", "deal", "llamada"]),
  pagina,
  tamano_de_pagina: z.number().int().min(1).max(50).default(20),
  detalle: z.enum(["compacta", "completa"]).default("compacta"),
  campos: z.array(z.string().min(1).max(100)).max(CAMPOS_DE_BUSQUEDA.length).optional(),
}).strict();

export const buscarMcp: Herramienta<typeof entradaBusqueda> = {
  nombre: "buscar",
  titulo: "Buscar en el CRM",
  descripcion: "Úsala cuando necesites saber de quién es una persona, encontrar sus deals y llamadas o verificar un traspaso, incluso sin conocer el programa. Devuelve una sección independiente por programa y nunca suma programas.",
  entrada: entradaBusqueda,
  salida: salidaDeBuscar,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const invalidos = entrada.campos?.filter((campo) => !(CAMPOS_DE_BUSQUEDA as readonly string[]).includes(campo)) ?? [];
    if (invalidos.length > 0) throw new ErrorDeApp(`Campos desconocidos: ${invalidos.join(", ")}. Válidos: ${CAMPOS_DE_BUSQUEDA.join(", ")}`, 422);
    const visibles = entrada.programa
      ? [await programaVisible(contexto, entrada.programa)]
      : await programasVisibles(contexto.session.user.id, contexto.rol, contexto.db);
    const alcance = await alcanceDeDeals(contexto.session);
    const resultados = await Promise.all(visibles.map(async (visible) => {
      const resultado = await buscarEnPrograma(contexto.db, visible.id, entrada.texto, alcance, {
        limite: entrada.tamano_de_pagina,
        offset: (entrada.pagina - 1) * entrada.tamano_de_pagina,
      });
      const filas = resultado.filas.map((persona) => ({
        id_de_la_persona: persona.id,
        nombre: persona.nombre,
        email: persona.email,
        ...(entrada.detalle === "completa" ? { telefono: persona.telefono } : {}),
        enlace: enlaceDeLead(visible.slug, persona.id),
        ...(entrada.tipos.includes("deal") ? { deals: persona.deals.map((deal) => ({
          id_del_deal: deal.id,
          etapa: { clave: deal.etapa, nombre: nombreDeEtapa(deal.etapa) },
          dueno: deal.dueno,
          cohorte: deal.cohorte,
          ultima_actividad: deal.ultima_actividad.toISOString(),
          ultimo_cambio_de_dueno: deal.ultimo_cambio_de_dueno ? { ...deal.ultimo_cambio_de_dueno, cuando: deal.ultimo_cambio_de_dueno.cuando.toISOString() } : null,
          enlace: enlaceDeDeal(visible.slug, deal.id),
          ...(entrada.detalle === "completa" ? { pendiente: deal.pendiente } : {}),
          ...(entrada.tipos.includes("llamada") ? { llamadas: deal.llamadas.map((llamada) => ({ ...llamada, fecha_de_agenda: llamada.fecha_de_agenda?.toISOString() ?? null })) } : {}),
        })) } : {}),
      }));
      return { programa: { nombre: visible.nombre, slug: visible.slug }, total: resultado.total, filas, hay_otra_pagina: entrada.pagina * entrada.tamano_de_pagina < resultado.total };
    }));
    const texto = resultados.map((seccion) => {
      const detalles = seccion.filas.flatMap((persona) => (persona.deals ?? []).map((deal) => {
        const cambio = deal.ultimo_cambio_de_dueno;
        const antes = cambio?.de ? ` · antes ${cambio.de}${cambio.cuando ? ` (cambió el ${fechaDeInstanteEnBogota(cambio.cuando)}${cambio.por ? ` por ${cambio.por}` : ""})` : ""}` : "";
        return `${persona.nombre ?? persona.email} · deal en ${deal.etapa.nombre} · dueño ${deal.dueno?.nombre ?? "sin dueño"}${antes}`;
      }));
      return `${seccion.programa.nombre}: ${num(seccion.total)} personas.${detalles.length ? ` ${detalles.join("; ")}` : ""}`;
    }).join("\n");
    const proyectados = entrada.campos ? resultados.map((seccion) => ({ ...seccion, filas: seccion.filas.map((persona) => {
      const permitidos = new Set(entrada.campos);
      const camposDeDeal = new Set(["id_del_deal", "etapa", "dueno", "cohorte", "ultima_actividad", "ultimo_cambio_de_dueno", "pendiente", "enlace", "llamadas"]);
      const salida = Object.fromEntries(Object.entries(persona).filter(([campo]) => campo !== "deals" && permitidos.has(campo))) as Record<string, unknown>;
      if (persona.deals && (permitidos.has("deals") || [...permitidos].some((campo) => camposDeDeal.has(campo)))) {
        salida.deals = persona.deals.map((deal) => Object.fromEntries(Object.entries(deal).filter(([campo]) => permitidos.has("deals") || permitidos.has(campo))));
      }
      return salida;
    }) })) : resultados;
    return { texto, estructurado: { programas: proyectados } };
  },
};

const entradaBuscar = z.object({ programa, ...camposDeFiltrosDeLeads, pagina }).strict();

export const buscarLeadsMcp: Herramienta<typeof entradaBuscar> = {
  nombre: "buscar_leads",
  titulo: "Buscar personas",
  descripcion:
    "Úsala cuando necesites encontrar a una persona dentro de un programa por nombre, correo o teléfono. Aplica los mismos filtros de Leads: deal, calidad, abandono, duplicado, fecha y orden. " +
    "El texto requiere al menos dos caracteres y no se guarda en la bitácora. Devuelve hasta 50 filas y dice si hay otra página; cada fila incluye el enlace a la ficha.",
  entrada: entradaBuscar,
  salida: salidaDeBuscarLeads,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const { filtro } = filtrosDeLeads(entrada, entrada.pagina - 1);
    const resultado = await leadsDelPrograma(contexto.db, visible.id, { ...filtro, porPagina: TAMANO_PAGINA });
    const haySiguiente = entrada.pagina * TAMANO_PAGINA < resultado.total;
    const estructurado = aSalidaDeBuscarLeads(resultado, { nombre: visible.nombre, slug: visible.slug }, entrada.pagina, haySiguiente, (id) => enlaceDeLead(visible.slug, id));
    return {
      texto: [
        `${num(resultado.total)} leads encontrados.`,
        `Página ${num(entrada.pagina)}: ${num(resultado.filas.length)} filas. ${haySiguiente ? `Hay otra página; pide pagina ${entrada.pagina + 1}.` : "No hay otra página."}`,
        ...estructurado.filas.map((fila) => `- ${fila.nombre ?? fila.email} · ${fila.email} · ${fila.enlace_de_la_persona}`),
      ].join("\n"),
      estructurado,
    };
  },
};

const entradaFichaDeLead = conAlias(
  z.object({ programa, id_de_la_persona: idOpacoSchema.optional(), detalle: z.enum(["compacta", "completa"]).default("compacta") }).strict(),
  { id: "id_de_la_persona" },
).refine((entrada) => entrada.id_de_la_persona !== undefined, { message: "Falta id_de_la_persona." });

const entradaFichaDeDeal = conAlias(
  z.object({ programa, id_del_deal: idOpacoSchema.optional() }).strict(),
  { id: "id_del_deal" },
).refine((entrada) => entrada.id_del_deal !== undefined, { message: "Falta id_del_deal." });

export const fichaDeLeadMcp: Herramienta<typeof entradaFichaDeLead> = {
  nombre: "ficha_de_lead",
  titulo: "Ficha de una persona",
  descripcion:
    "Úsala cuando ya tengas el identificador opaco de una persona y necesites su detalle. Devuelve contactos, envíos y deals con la misma proyección de la pantalla; Customer Success recibe solo el detalle básico. Cada deal y la persona incluyen enlace al CRM. No modifica la ficha.",
  entrada: entradaFichaDeLead,
  salida: salidaDeFichaDeLead,
  puede: (contexto) => puedeVerFichaDeLead(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await fichaDeLeadParaActor(contexto.db, visible.id, entrada.id_de_la_persona!, {
      rol: contexto.rol,
      operaComoCloser: contexto.session.user.operaComoCloser,
    });
    if (!resultado) throw new ErrorDeApp("No existe ese lead", 404);
    const estructurado = aSalidaDeFichaDeLead(resultado, { nombre: visible.nombre, slug: visible.slug }, { persona: (id) => enlaceDeLead(visible.slug, id), deal: (id) => enlaceDeDeal(visible.slug, id) }, entrada.detalle);
    return {
      texto: `${resultado.ficha.nombre ?? resultado.ficha.email} · ${resultado.ficha.email}\n${num(resultado.ficha.envios.length)} envíos · ${num(resultado.ficha.deals.length)} deals\n${estructurado.ficha.enlace}`,
      estructurado,
    };
  },
};

export const fichaDeDealMcp: Herramienta<typeof entradaFichaDeDeal> = {
  nombre: "ficha_de_deal",
  titulo: "Ficha de un deal",
  descripcion:
    "Úsala cuando ya tengas el identificador opaco de un deal y necesites su historia operativa. Devuelve etapa, dueño, llamadas, abonos, actividades, bitácora y alertas; un closer solo puede abrir los mismos deals que en la pantalla. El dinero conserva su moneda y — significa que no se puede calcular. No modifica el deal.",
  entrada: entradaFichaDeDeal,
  salida: salidaDeFichaDeDeal,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await fichaDeDealVisible(contexto.db, visible.id, entrada.id_del_deal!, contexto.session, contexto.rol);
    if (!resultado) throw new ErrorDeApp("No existe ese deal", 404);
    const alertas = await alertasDelDeal(contexto.db, visible.id, resultado.ficha.dealId);
    const estructurado = aSalidaDeFichaDeDeal(resultado.ficha, alertas, { nombre: visible.nombre, slug: visible.slug }, { deal: (id) => enlaceDeDeal(visible.slug, id), persona: (id) => enlaceDeLead(visible.slug, id) });
    const vendido = resultado.ficha.valorVendidoUsd === null ? "—" : monto(resultado.ficha.valorVendidoUsd, "USD");
    return {
      texto: `${resultado.ficha.lead.nombre ?? resultado.ficha.lead.email} · ${resultado.ficha.etapa}\nVendido: ${vendido}\nAlertas: ${num((alertas?.urgentes.length ?? 0) + (alertas?.alertas.length ?? 0))}\n${estructurado.ficha.enlace}`,
      estructurado,
    };
  },
};

const camposDeFiltrosSinCloser = Object.fromEntries(
  Object.entries(camposDeFiltrosKanban).filter(([clave]) => clave !== "closer"),
) as Omit<typeof camposDeFiltrosKanban, "closer">;
const entradaTablero = conAlias(z.object({
  programa,
  ...camposDeFiltrosSinCloser,
  dueno: z.string().max(300).optional(),
  pagina,
  tamano_de_pagina: z.number().int().min(1).max(100).default(50),
  detalle: z.enum(["compacta", "completa"]).default("compacta"),
  campos: z.array(z.string().min(1).max(100)).max(30).optional(),
}).strict(), { closer: "dueno" });

const CAMPOS_DE_TARJETA = ["id_del_deal", "id_de_la_persona", "nombre", "etapa", "dueno", "cohorte", "ultima_actividad", "enlace", "cantidad_de_envios", "email", "pendiente", "cohorte_de_destino", "es_nuevo", "saldo", "fuente", "medio", "calidad", "valor", "dias_en_la_etapa", "creado_en", "potencial", "recaudado", "llamada", "avisos", "enlace_de_la_persona"] as const;

function parametrosDeTablero(entrada: z.output<typeof entradaTablero>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(entrada)
    .filter(([clave, valor]) => !["programa", "pagina", "tamano_de_pagina", "campos", "dueno", "detalle"].includes(clave) && valor !== undefined)
    .map(([clave, valor]) => [clave, String(valor)]));
}

export const tableroDeDealsMcp: Herramienta<typeof entradaTablero> = {
  nombre: "tablero_de_deals",
  titulo: "Tablero de deals",
  descripcion:
    "Úsala cuando necesites ver o filtrar el pipeline comercial de un programa. Devuelve hasta 50 tarjetas por página con las mismas vistas, orden y filtros de la pantalla; las opciones válidas salen de opciones_de_filtros. Cada tarjeta enlaza al deal y a la persona. No modifica ni mueve deals.",
  entrada: entradaTablero,
  salida: salidaDeTablero,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const camposInvalidos = entrada.campos?.filter((campo) => !(CAMPOS_DE_TARJETA as readonly string[]).includes(campo)) ?? [];
    if (camposInvalidos.length > 0) throw new ErrorDeApp(`Campos desconocidos: ${camposInvalidos.join(", ")}. Válidos: ${CAMPOS_DE_TARJETA.join(", ")}`, 422);
    const [alcance, activa] = await Promise.all([alcanceDeDeals(contexto.session), cohorteActiva(visible.id, contexto.db)]);
    const filtrosAplicados: FiltroAplicado[] = [];
    const parametros = parametrosDeTablero(entrada);
    if (entrada.dueno) {
      const filtro = await resolverDueno(contexto.db, visible.id, visible.nombre, entrada.dueno);
      parametros.closer = filtro.id ?? undefined;
      filtrosAplicados.push(filtro);
    }
    if (entrada.cohorte) {
      const filtro = await resolverCohorte(contexto.db, visible.id, visible.nombre, entrada.cohorte);
      parametros.cohorte = filtro.id ?? "todas";
      filtrosAplicados.push(filtro);
    } else if (activa) {
      filtrosAplicados.push({ campo: "cohorte", id: activa.id, nombre: activa.codigo, origen: "por_defecto", como_quitarlo: 'pide cohorte: "todas"' });
    }
    const filtros = { ...parsearFiltros(parametros, undefined, activa?.id ?? null), vista: vistaDelTablero(parametros) };
    const inicio = (entrada.pagina - 1) * entrada.tamano_de_pagina;
    const resultado = await paginaDelTablero(contexto.db, visible.id, alcance, filtros, { limite: entrada.tamano_de_pagina, offset: inicio });
    const haySiguiente = inicio + entrada.tamano_de_pagina < resultado.total;
    const base = aSalidaDeTablero(resultado.tablero, filtros, filtrosAplicados, { nombre: visible.nombre, slug: visible.slug }, { deal: (id) => enlaceDeDeal(visible.slug, id), persona: (id) => enlaceDeLead(visible.slug, id) }, entrada.detalle);
    base.tablero.total = resultado.total;
    if (entrada.campos) {
      const permitidos = new Set(entrada.campos);
      for (const columna of base.tablero.columnas) columna.tarjetas = columna.tarjetas.map((tarjeta) => Object.fromEntries(Object.entries(tarjeta).filter(([campo]) => permitidos.has(campo))) as typeof tarjeta);
    }
    const estructurado = { ...base, pagina: entrada.pagina, hay_otra_pagina: haySiguiente };
    return {
      texto: `${num(resultado.total)} deals en el tablero. Página ${num(entrada.pagina)}: ${num(resultado.ids.length)} tarjetas. ${haySiguiente ? `Hay otra página; pide pagina ${entrada.pagina + 1}.` : "No hay otra página."}\n${enlaceDeTab(visible.slug, "deals")}`,
      estructurado,
    };
  },
};

const entradaOpciones = z.object({ programa, de: z.enum(["tablero", "leads", "hechos"]).default("tablero") }).strict();
const salidaOpciones = z.object({ programa: z.object({ nombre: z.string().describe("Nombre legible del programa."), slug: z.string().describe("Identificador opaco del programa.") }).strict().describe("Programa consultado."), de: z.enum(["tablero", "leads", "hechos"]).describe("Familia de filtros consultada."), opciones: z.record(z.string(), z.unknown()).describe("Valores y contratos disponibles para filtrar.") }).strict().describe("Opciones de filtros de un programa.");
export const opcionesDeFiltrosMcp: Herramienta<typeof entradaOpciones> = {
  nombre: "opciones_de_filtros",
  titulo: "Opciones de filtros",
  descripcion: "Úsala cuando necesites filtrar y no conozcas los valores permitidos para tu rol en el tablero, Leads o hechos. No consulta resultados ni modifica datos.",
  entrada: entradaOpciones,
  salida: salidaOpciones,
  puede: (contexto) => puedeVerOperacion(contexto.rol) || veTableroDelPrograma(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const veEquipo = veEquipoComercial(contexto.rol);
    let opciones: Record<string, unknown>;
    if (entrada.de === "tablero") {
      const [tablero, activa] = await Promise.all([opcionesDeTablero(contexto.db, visible.id), cohorteActiva(visible.id, contexto.db)]);
      const { owners, ...resto } = tablero;
      opciones = { ...resto, ...(veEquipo ? { duenos: owners } : {}), cohorte_activa: activa ? { id: activa.id, codigo: activa.codigo } : null };
    } else if (entrada.de === "leads") {
      opciones = Object.fromEntries(Object.entries(camposDeFiltrosDeLeads).map(([nombre, esquema]) => [nombre, z.toJSONSchema(esquema, { unrepresentable: "any" })]));
    } else {
      const tablero = await opcionesDeTablero(contexto.db, visible.id);
      opciones = {
        hechos: Object.fromEntries(Object.entries(HECHOS_CONSULTABLES).map(([nombre, hecho]) => [nombre, {
          dimensiones: dimensionesVisibles(hecho.dimensiones, veEquipo),
          medidas: hecho.medidas,
        }])),
        ...(veEquipo ? { duenos: tablero.owners } : {}),
        cohortes: tablero.cohortes,
      };
    }
    return { texto: `Opciones de ${entrada.de} para ${visible.nombre}.`, estructurado: { programa: { nombre: visible.nombre, slug: visible.slug }, de: entrada.de, opciones } };
  },
};

const entradaBandeja = z.object({ programa }).strict();

export const bandejaMcp: Herramienta<typeof entradaBandeja> = {
  nombre: "bandeja",
  titulo: "Bandeja de pendientes",
  descripcion:
    "Úsala cuando necesites saber qué trabajo operativo está pendiente hoy en un programa. Devuelve llamadas vencidas sin resultado, llamadas sueltas, atención, deals por preparar y agendados sin dueño igual que la pantalla. Un closer ve sus deals donde aplica dueño y Gerencia ve el equipo. No resuelve los pendientes ni modifica datos.",
  entrada: entradaBandeja,
  salida: salidaDeBandeja,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await bandejaParaActor(contexto.db, visible.id, contexto.session, contexto.rol);
    if (!resultado) throw new ErrorDeApp("No existe ese programa", 404);
    const estructurado = aSalidaDeBandeja(resultado, { nombre: visible.nombre, slug: visible.slug }, { deal: (id) => enlaceDeDeal(visible.slug, id), persona: (id) => enlaceDeLead(visible.slug, id) });
    const total = estructurado.llamadas_por_registrar.length + estructurado.llamadas_sin_deal.length + estructurado.atencion.length + estructurado.perdidos.length + estructurado.pendiente_de_setteo.length + estructurado.sin_dueno.length;
    return {
      texto: `${num(total)} pendientes en la bandeja.\nPor registrar: ${num(estructurado.llamadas_por_registrar.length)} · sin deal: ${num(estructurado.llamadas_sin_deal.length)} · atención: ${num(estructurado.atencion.length)} · sin dueño: ${num(estructurado.pendiente_de_setteo.length + estructurado.sin_dueno.length)}\n${enlaceDeTab(visible.slug, "inbox")}`,
      estructurado,
    };
  },
};
