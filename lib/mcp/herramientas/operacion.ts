import { z } from "zod";
import { puedeVerFichaDeLead, puedeVerOperacion } from "@/lib/auth/roles";
import { ErrorDeApp } from "@/lib/errors";
import { monto, num } from "@/lib/format";
import { idOpacoSchema } from "@/lib/identificadores";
import { enlaceDeDeal, enlaceDeLead, enlaceDeTab } from "@/lib/mcp/enlaces";
import { aSalidaDeBandeja, aSalidaDeBuscarLeads, aSalidaDeFichaDeDeal, aSalidaDeFichaDeLead, aSalidaDeTablero, salidaDeBandeja, salidaDeBuscarLeads, salidaDeFichaDeDeal, salidaDeFichaDeLead, salidaDeTablero } from "@/lib/mcp/salidas/operacion";
import { camposDeFiltrosDeLeads, filtrosDeLeads } from "@/lib/queries/filtros-de-leads";
import { alertasDelDeal } from "@/lib/queries/ficha-deal";
import { camposDeFiltrosKanban } from "@/lib/queries/kanban";
import { leadsDelPrograma } from "@/lib/queries/leads";
import { TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
import { bandejaParaActor, fichaDeDealVisible, fichaDeLeadParaActor, tableroDeDealsParaActor } from "@/lib/queries/operacion";
import { programaVisible } from "./programa";
import type { Herramienta } from "./tipos";

const programa = z.string().min(1).max(100);
const pagina = z.number().int().min(1).max(1_000_000).default(1);

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

const entradaFicha = z.object({ programa, id: idOpacoSchema }).strict();

export const fichaDeLeadMcp: Herramienta<typeof entradaFicha> = {
  nombre: "ficha_de_lead",
  titulo: "Ficha de una persona",
  descripcion:
    "Úsala cuando ya tengas el identificador opaco de una persona y necesites su detalle. Devuelve contactos, envíos y deals con la misma proyección de la pantalla; Customer Success recibe solo el detalle básico. Cada deal y la persona incluyen enlace al CRM. No modifica la ficha.",
  entrada: entradaFicha,
  salida: salidaDeFichaDeLead,
  puede: (contexto) => puedeVerFichaDeLead(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await fichaDeLeadParaActor(contexto.db, visible.id, entrada.id, {
      rol: contexto.rol,
      operaComoCloser: contexto.session.user.operaComoCloser,
    });
    if (!resultado) throw new ErrorDeApp("No existe ese lead", 404);
    const estructurado = aSalidaDeFichaDeLead(resultado, { nombre: visible.nombre, slug: visible.slug }, { persona: (id) => enlaceDeLead(visible.slug, id), deal: (id) => enlaceDeDeal(visible.slug, id) });
    return {
      texto: `${resultado.ficha.nombre ?? resultado.ficha.email} · ${resultado.ficha.email}\n${num(resultado.ficha.envios.length)} envíos · ${num(resultado.ficha.deals.length)} deals\n${estructurado.ficha.enlace}`,
      estructurado,
    };
  },
};

export const fichaDeDealMcp: Herramienta<typeof entradaFicha> = {
  nombre: "ficha_de_deal",
  titulo: "Ficha de un deal",
  descripcion:
    "Úsala cuando ya tengas el identificador opaco de un deal y necesites su historia operativa. Devuelve etapa, dueño, llamadas, abonos, actividades, bitácora y alertas; un closer solo puede abrir los mismos deals que en la pantalla. El dinero conserva su moneda y — significa que no se puede calcular. No modifica el deal.",
  entrada: entradaFicha,
  salida: salidaDeFichaDeDeal,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await fichaDeDealVisible(contexto.db, visible.id, entrada.id, contexto.session, contexto.rol);
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

const entradaTablero = z.object({ programa, ...camposDeFiltrosKanban }).strict();

function parametrosDeTablero(entrada: z.output<typeof entradaTablero>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(entrada)
    .filter(([clave, valor]) => clave !== "programa" && valor !== undefined)
    .map(([clave, valor]) => [clave, String(valor)]));
}

export const tableroDeDealsMcp: Herramienta<typeof entradaTablero> = {
  nombre: "tablero_de_deals",
  titulo: "Tablero de deals",
  descripcion:
    "Úsala cuando necesites ver o filtrar el pipeline comercial completo de un programa. Devuelve el tablero de Deals con las mismas vistas, orden y filtros de la pantalla, además de las opciones válidas de sus selectores. Cada tarjeta enlaza al deal y a la persona. No modifica ni mueve deals.",
  entrada: entradaTablero,
  salida: salidaDeTablero,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await tableroDeDealsParaActor(contexto.db, visible.id, contexto.session, parametrosDeTablero(entrada));
    const estructurado = aSalidaDeTablero(resultado.tablero, resultado.filtros, resultado.opciones, { nombre: visible.nombre, slug: visible.slug }, { deal: (id) => enlaceDeDeal(visible.slug, id), persona: (id) => enlaceDeLead(visible.slug, id) });
    return {
      texto: `${num(resultado.tablero.total)} deals en el tablero.\n${resultado.tablero.columnas.map((c) => `${c.clave}: ${num(c.tarjetas.length)}`).join("\n")}\n${enlaceDeTab(visible.slug, "deals")}`,
      estructurado,
    };
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
