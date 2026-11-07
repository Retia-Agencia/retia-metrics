import { z } from "zod";
import { puedeVerFichaDeLead, puedeVerOperacion } from "@/lib/auth/roles";
import { ErrorDeApp } from "@/lib/errors";
import { monto, num } from "@/lib/format";
import { idOpacoSchema } from "@/lib/identificadores";
import { enlaceDeDeal, enlaceDeLead, enlaceDeTab } from "@/lib/mcp/enlaces";
import { camposDeFiltrosDeLeads, filtrosDeLeads } from "@/lib/queries/filtros-de-leads";
import { alertasDelDeal } from "@/lib/queries/ficha-deal";
import { camposDeFiltrosKanban } from "@/lib/queries/kanban";
import { leadsDelPrograma } from "@/lib/queries/leads";
import { TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
import { bandejaParaActor, fichaDeDealVisible, fichaDeLeadParaActor, tableroDeDealsParaActor } from "@/lib/queries/operacion";
import { programaVisible } from "./programa";
import type { Herramienta } from "./tipos";

const programa = z.string().min(1);
const pagina = z.number().int().min(1).max(1_000_000).default(1);

const entradaBuscar = z.object({ programa, ...camposDeFiltrosDeLeads, pagina }).strict();

export const buscarLeadsMcp: Herramienta<typeof entradaBuscar> = {
  nombre: "buscar_leads",
  descripcion:
    "Busca personas dentro de un programa por nombre, correo o teléfono, con los mismos filtros de Leads: deal, calidad, abandono, duplicado, fecha y orden. " +
    "El texto requiere al menos dos caracteres y no se guarda en la bitácora. Devuelve hasta 50 filas y dice si hay otra página; cada fila incluye el enlace a la ficha.",
  entrada: entradaBuscar,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const { filtro } = filtrosDeLeads(entrada, entrada.pagina - 1);
    const resultado = await leadsDelPrograma(contexto.db, visible.id, { ...filtro, porPagina: TAMANO_PAGINA });
    const filas = resultado.filas.map((fila) => ({ ...fila, enlace: enlaceDeLead(visible.slug, fila.id) }));
    const haySiguiente = entrada.pagina * TAMANO_PAGINA < resultado.total;
    return {
      texto: [
        `${num(resultado.total)} leads encontrados.`,
        `Página ${num(entrada.pagina)}: ${num(filas.length)} filas. ${haySiguiente ? `Hay otra página; pide pagina ${entrada.pagina + 1}.` : "No hay otra página."}`,
        ...filas.map((fila) => `- ${fila.nombre ?? fila.email} · ${fila.email} · ${fila.enlace}`),
      ].join("\n"),
      estructurado: { programa: { nombre: visible.nombre, slug: visible.slug }, total: resultado.total, pagina: entrada.pagina, haySiguiente, filas },
    };
  },
};

const entradaFicha = z.object({ programa, id: idOpacoSchema }).strict();

export const fichaDeLeadMcp: Herramienta<typeof entradaFicha> = {
  nombre: "ficha_de_lead",
  descripcion:
    "Devuelve la ficha de una persona del programa por su id opaco: contactos, envíos y deals. Aplica exactamente la proyección de la pantalla; Customer Success recibe solo el detalle básico. Cada deal y el lead incluyen enlace al CRM.",
  entrada: entradaFicha,
  puede: (contexto) => puedeVerFichaDeLead(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await fichaDeLeadParaActor(contexto.db, visible.id, entrada.id, {
      rol: contexto.rol,
      operaComoCloser: contexto.session.user.operaComoCloser,
    });
    if (!resultado) throw new ErrorDeApp("No existe ese lead", 404);
    const ficha = {
      ...resultado.ficha,
      enlace: enlaceDeLead(visible.slug, resultado.ficha.id),
      deals: resultado.ficha.deals.map((deal) => ({ ...deal, enlace: enlaceDeDeal(visible.slug, deal.id) })),
    };
    return {
      texto: `${ficha.nombre ?? ficha.email} · ${ficha.email}\n${num(ficha.envios.length)} envíos · ${num(ficha.deals.length)} deals\n${ficha.enlace}`,
      estructurado: { programa: { nombre: visible.nombre, slug: visible.slug }, basico: resultado.basico, ficha },
    };
  },
};

export const fichaDeDealMcp: Herramienta<typeof entradaFicha> = {
  nombre: "ficha_de_deal",
  descripcion:
    "Devuelve la ficha operativa de un deal por su id opaco, con etapa, dueño, llamadas, abonos, actividades, bitácora y alertas. Un closer solo puede abrir los mismos deals que en la pantalla. El dinero conserva su moneda y — significa que no se puede calcular.",
  entrada: entradaFicha,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await fichaDeDealVisible(contexto.db, visible.id, entrada.id, contexto.session, contexto.rol);
    if (!resultado) throw new ErrorDeApp("No existe ese deal", 404);
    const alertas = await alertasDelDeal(contexto.db, visible.id, resultado.ficha.dealId);
    const ficha = {
      ...resultado.ficha,
      enlace: enlaceDeDeal(visible.slug, resultado.ficha.dealId),
      lead: { ...resultado.ficha.lead, enlace: enlaceDeLead(visible.slug, resultado.ficha.lead.id) },
    };
    const vendido = ficha.valorVendidoUsd === null ? "—" : monto(ficha.valorVendidoUsd, "USD");
    return {
      texto: `${ficha.lead.nombre ?? ficha.lead.email} · ${ficha.etapa}\nVendido: ${vendido}\nAlertas: ${num((alertas?.urgentes.length ?? 0) + (alertas?.alertas.length ?? 0))}\n${ficha.enlace}`,
      estructurado: { programa: { nombre: visible.nombre, slug: visible.slug }, ficha, alertas },
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
  descripcion:
    "Devuelve el tablero de Deals con las mismas vistas, orden y filtros de la pantalla: texto, dueño, cohorte, canal, calidad, valor, antigüedad y fecha. Incluye las opciones válidas de sus selectores. Cada tarjeta enlaza tanto al deal como al lead.",
  entrada: entradaTablero,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await tableroDeDealsParaActor(contexto.db, visible.id, contexto.session, parametrosDeTablero(entrada));
    const columnas = resultado.tablero.columnas.map((columna) => ({
      ...columna,
      tarjetas: columna.tarjetas.map((tarjeta) => ({
        ...tarjeta,
        enlace: enlaceDeDeal(visible.slug, tarjeta.dealId),
        enlaceLead: enlaceDeLead(visible.slug, tarjeta.leadId),
      })),
    }));
    const enProximaCohorte = resultado.tablero.enProximaCohorte.map((tarjeta) => ({
      ...tarjeta,
      enlace: enlaceDeDeal(visible.slug, tarjeta.dealId),
      enlaceLead: enlaceDeLead(visible.slug, tarjeta.leadId),
    }));
    return {
      texto: `${num(resultado.tablero.total)} deals en el tablero.\n${columnas.map((c) => `${c.clave}: ${num(c.tarjetas.length)}`).join("\n")}\n${enlaceDeTab(visible.slug, "deals")}`,
      estructurado: { programa: { nombre: visible.nombre, slug: visible.slug }, filtros: resultado.filtros, opciones: resultado.opciones, tablero: { ...resultado.tablero, columnas, enProximaCohorte } },
    };
  },
};

const entradaBandeja = z.object({ programa }).strict();

function conEnlaceDeDeal<T extends { dealId: string | null; sugerencias?: readonly { dealId: string }[] }>(fila: T, slug: string) {
  return {
    ...fila,
    enlace: fila.dealId ? enlaceDeDeal(slug, fila.dealId) : null,
    ...(fila.sugerencias
      ? { sugerencias: fila.sugerencias.map((sugerencia) => ({
          ...sugerencia,
          enlace: enlaceDeDeal(slug, sugerencia.dealId),
        })) }
      : {}),
  };
}

export const bandejaMcp: Herramienta<typeof entradaBandeja> = {
  nombre: "bandeja",
  descripcion:
    "Devuelve la Bandeja del programa igual que la pantalla: llamadas vencidas sin resultado, llamadas sueltas, atención, deals por settear y agendados sin dueño. Un closer ve sus deals donde la pantalla aplica dueño; Gerencia ve el equipo. Los montos conservan moneda.",
  entrada: entradaBandeja,
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisible(contexto, entrada.programa);
    const resultado = await bandejaParaActor(contexto.db, visible.id, contexto.session, contexto.rol);
    if (!resultado) throw new ErrorDeApp("No existe ese programa", 404);
    const inbox = {
      ...resultado.inbox,
      llamadasDeHoy: resultado.inbox.llamadasDeHoy.map((fila) => conEnlaceDeDeal(fila, visible.slug)),
      llamadasSueltas: resultado.inbox.llamadasSueltas.map((fila) => conEnlaceDeDeal(fila, visible.slug)),
      llamadasSinCloser: resultado.inbox.llamadasSinCloser.map((fila) => conEnlaceDeDeal(fila, visible.slug)),
      atencion: resultado.inbox.atencion.map((fila) => ({
        ...conEnlaceDeDeal(fila, visible.slug),
        saldoLegible: fila.saldo === null || fila.moneda === null ? "—" : monto(fila.saldo, fila.moneda),
      })),
    };
    const secciones = {
      pendienteSetteo: resultado.secciones.pendienteSetteo.map((fila) => ({ ...fila, enlace: enlaceDeDeal(visible.slug, fila.dealId), enlaceLead: enlaceDeLead(visible.slug, fila.leadId) })),
      unclaimed: resultado.secciones.unclaimed.map((fila) => ({ ...fila, enlace: enlaceDeDeal(visible.slug, fila.dealId), enlaceLead: enlaceDeLead(visible.slug, fila.leadId) })),
    };
    const perdidos = resultado.perdidos.map((fila) => ({ ...fila, enlace: enlaceDeDeal(visible.slug, fila.dealId) }));
    const total = inbox.llamadasDeHoy.length + inbox.llamadasSueltas.length + inbox.atencion.length + perdidos.length + secciones.pendienteSetteo.length + secciones.unclaimed.length;
    return {
      texto: `${num(total)} pendientes en la bandeja.\nPor registrar: ${num(inbox.llamadasDeHoy.length)} · sin deal: ${num(inbox.llamadasSueltas.length)} · atención: ${num(inbox.atencion.length)} · sin dueño: ${num(secciones.pendienteSetteo.length + secciones.unclaimed.length)}\n${enlaceDeTab(visible.slug, "inbox")}`,
      estructurado: { programa: { nombre: visible.nombre, slug: visible.slug }, inbox, perdidos, secciones },
    };
  },
};
