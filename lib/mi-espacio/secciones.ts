import type { Rol } from "@/lib/auth/roles";
import { esAdministrador, manejaPauta, trabajaLeads } from "@/lib/auth/roles";

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
  | "atencion"
  | "metricas"
  | "canales"
  | "por-decidir";

export interface SeccionMiEspacio {
  id: SeccionId;
  etiqueta: string;
  /** `true` si el rol cumple la capacidad que habilita la sección. */
  habilita: (rol: Rol | null) => boolean;
  /** `true` si la sección se mira por programa (selector obligatorio, frontera ADR 0043). */
  usaSelectorDePrograma: boolean;
}

/**
 * El catálogo, en orden de aparición. Una sección por capacidad:
 *  - Las dos de quien trabaja leads: atención y métricas personales.
 *  - `canales` para quien maneja pauta sin administrar ni trabajar leads (paid trafficker).
 *  - `por-decidir` para quien administra sin trabajar leads (gerente): la operación del CRM
 *    que le toca decidir, NUNCA los deals de los closers.
 *
 * Las capacidades se componen SOLO con las preguntas de `roles.ts`. Un developer responde
 * `true` a `trabajaLeads`, `manejaPauta` y `esAdministrador`, así que en vista `todo` ve
 * la unión; la página decide con el rol de vista (en `todo` muestra el mensaje que lo
 * explica, porque "todo" no es un rol con secciones propias).
 */
export const SECCIONES: readonly SeccionMiEspacio[] = [
  {
    id: "atencion",
    etiqueta: "Necesita atención",
    habilita: (rol) => trabajaLeads(rol),
    usaSelectorDePrograma: true,
  },
  {
    id: "metricas",
    etiqueta: "Mis métricas",
    habilita: (rol) => trabajaLeads(rol),
    usaSelectorDePrograma: true,
  },
  {
    id: "canales",
    etiqueta: "Canales",
    // El paid trafficker: maneja pauta pero no administra la app ni trabaja leads. Por
    // capacidad, nunca por el literal del rol (ADR 0025).
    habilita: (rol) => manejaPauta(rol) && !esAdministrador(rol) && !trabajaLeads(rol),
    // Los Canales son globales y el paid trafficker no tiene membresías: la sección no se
    // acota por programa (ve todo, como hoy en /ajustes/canales).
    usaSelectorDePrograma: false,
  },
  {
    id: "por-decidir",
    etiqueta: "Por decidir",
    // El gerente: administra pero no trabaja leads. El developer entra por `todo` (la
    // página decide con el rol de vista), no por aquí: en vista `gerente` sí ve esto.
    habilita: (rol) => esAdministrador(rol) && !trabajaLeads(rol),
    usaSelectorDePrograma: true,
  },
] as const;

/** Las secciones que el rol de vista cumple, en orden. Vacío si ninguna aplica. */
export function seccionesDeRol(rol: Rol | null): SeccionMiEspacio[] {
  return SECCIONES.filter((s) => s.habilita(rol));
}

/**
 * La sección que se debe mostrar dado el rol y la `?tab=` pedida por la URL.
 *
 * - Si el rol no cumple NINGUNA sección, `null` (la página muestra el mensaje del dueño).
 * - Si la pedida existe y el rol la cumple, esa.
 * - En cualquier otro caso (sin `?tab=`, o una `?tab=` de otra sección forjada a mano), la
 *   PRIMERA del rol. Forjar `?tab=canales` siendo closer NUNCA muestra Canales: cae en la
 *   primera del closer (ADR 0025: la capacidad decide, no la URL).
 */
export function seccionPedida(rol: Rol | null, tabPedida: string | undefined): SeccionMiEspacio | null {
  const disponibles = seccionesDeRol(rol);
  if (disponibles.length === 0) return null;
  const pedida = disponibles.find((s) => s.id === tabPedida);
  return pedida ?? disponibles[0];
}
