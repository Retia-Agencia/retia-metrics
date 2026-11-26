import type { SujetoDeCapacidad } from "@/lib/auth/roles";
import { esAccesoTotal, esAdministrador, manejaPauta, trabajaLeads } from "@/lib/auth/roles";

/**
 * El REGISTRO de las secciones de Mi espacio (ticket 179, ADR 0077 punto 1): qué ve cada
 * quien, dirigido por una tabla y no por un `if` por pantalla.
 *
 * Dos ejes que NO se mezclan (decisión de Mani, 3-oct):
 *  - **De quién:** siempre la persona de la sesión (sus deals, sus llamadas, sus canales),
 *    nunca "todo lo que el rol alcanza" —eso vive en las tabs del programa—.
 *  - **Qué secciones:** las del trabajo de su rol, y nada más.
 *
 * Cada sección declara la pregunta de CAPACIDAD que la habilita (`trabajaLeads`,
 * `manejaPauta`, `esAdministrador`, de `lib/auth/roles.ts`), **nunca** `rol === "..."`
 * (ADR 0025: el literal escrito a mano deja al developer afuera; lo caza el guardián de
 * `rol-de-vista-centralizado`). Cuando llegue Customer Success (145), es una pregunta
 * nueva en `roles.ts` y una fila aquí.
 *
 * Módulo PURO (sin base, sin next-auth): lo pueden importar los componentes cliente. El
 * rol que entra es el ROL DE VISTA (`rolDeVista`, ADR 0028): un developer en vista
 * `closer` ve las secciones del closer, igual que un closer real.
 */

/** El id de una sección: también el valor de `?tab=` en la URL. */
export type SeccionId =
  | "mi-dia"
  | "info"
  | "metricas"
  | "canales"
  | "por-decidir";

export interface SeccionMiEspacio {
  id: SeccionId;
  etiqueta: string;
  /** `true` si el rol cumple la capacidad que habilita la sección. */
  habilita: (sujeto: SujetoDeCapacidad) => boolean;
  /** `true` si la sección se mira por programa (frontera ADR 0043). */
  porPrograma: boolean;
}

/**
 * El catálogo, en orden de aparición. Info va última para todo rol que tiene Mi espacio:
 * contiene el perfil, la foto, el rol, los enlaces de captación y la cuenta de Calendly.
 * Antes aparecen las secciones de trabajo de cada capacidad:
 *  - Las de quien trabaja leads: Mi día y Métricas personales.
 *  - `canales` para quien maneja pauta sin administrar ni trabajar leads (paid trafficker).
 *  - `por-decidir` para el gerente: la operación del CRM que le toca decidir, también
 *    cuando suma la capacidad de closer (ticket 236 / ADR 0084).
 *
 * Las capacidades se componen SOLO con las preguntas de `roles.ts`. Un developer responde
 * `true` a `trabajaLeads`, `manejaPauta` y `esAdministrador`, así que en vista `todo` ve
 * la unión; la página decide con el rol de vista (en `todo` muestra el mensaje que lo
 * explica, porque "todo" no es un rol con secciones propias).
 */
export const SECCIONES: readonly SeccionMiEspacio[] = [
  {
    id: "mi-dia",
    etiqueta: "Mi día",
    habilita: (sujeto) => trabajaLeads(sujeto),
    porPrograma: true,
  },
  {
    id: "metricas",
    etiqueta: "Métricas",
    habilita: (sujeto) => trabajaLeads(sujeto),
    porPrograma: true,
  },
  {
    id: "canales",
    etiqueta: "Canales",
    // El paid trafficker: maneja pauta pero no administra la app ni trabaja leads. Por
    // capacidad, nunca por el literal del rol (ADR 0025).
    habilita: (sujeto) => manejaPauta(sujeto.rol) && !esAdministrador(sujeto.rol) && !trabajaLeads(sujeto),
    // Los Canales son globales y el paid trafficker no tiene membresías: la sección no se
    // acota por programa (ve todo, como hoy en /ajustes/canales).
    porPrograma: false,
  },
  {
    id: "por-decidir",
    etiqueta: "Por decidir",
    // El gerente conserva esta sección aunque opere como closer (ticket 236). El
    // developer entra por `todo`, no por aquí: en vista `gerente` sí ve esto.
    habilita: (sujeto) => esAdministrador(sujeto.rol) && !esAccesoTotal(sujeto.rol),
    porPrograma: true,
  },
  {
    id: "info",
    etiqueta: "Info",
    // Todo rol que tiene Mi espacio: trabaja leads, administra o maneja pauta. El developer
    // cumple las tres, así que también la ve. Por capacidad, nunca por el literal del rol.
    habilita: (sujeto) => trabajaLeads(sujeto) || esAdministrador(sujeto.rol) || manejaPauta(sujeto.rol),
    porPrograma: false,
  },
] as const;

/** Las secciones que el rol de vista cumple, en orden. Vacío si ninguna aplica. */
export function seccionesDeRol(sujeto: SujetoDeCapacidad): SeccionMiEspacio[] {
  return SECCIONES.filter((s) => s.habilita(sujeto));
}

/**
 * La sección POR DEFECTO del rol: el trabajo de su rol, no Info. Para quien trabaja leads
 * es Mi día; para el gerente, Por decidir; para el paid trafficker, Canales. Info queda
 * como red por si un rol sólo tuviera esa sección.
 */
export function seccionPorDefecto(sujeto: SujetoDeCapacidad): SeccionMiEspacio | null {
  const disponibles = seccionesDeRol(sujeto);
  if (disponibles.length === 0) return null;
  return trabajaLeads(sujeto)
    ? disponibles.find((s) => s.id === "mi-dia") ?? disponibles[0]
    : disponibles.find((s) => s.id !== "info") ?? disponibles[0];
}

/**
 * La sección que se debe mostrar dado el rol y la `?tab=` pedida por la URL.
 *
 * - Si el rol no cumple NINGUNA sección, `null` (la página muestra el mensaje del dueño).
 * - Si la pedida existe y el rol la cumple, esa.
 * - En cualquier otro caso (sin `?tab=`, o una `?tab=` de otra sección forjada a mano), la
 *   POR DEFECTO del rol —su trabajo, no Info—. Forjar `?tab=canales` siendo closer NUNCA
 *   muestra Canales: cae en su sección por defecto (ADR 0025: la capacidad decide, no la URL).
 */
export function seccionPedida(sujeto: SujetoDeCapacidad, tabPedida: string | undefined): SeccionMiEspacio | null {
  const disponibles = seccionesDeRol(sujeto);
  if (disponibles.length === 0) return null;
  const pedida = disponibles.find((s) => s.id === tabPedida);
  return pedida ?? seccionPorDefecto(sujeto);
}
