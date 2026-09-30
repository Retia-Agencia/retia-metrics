import type { Rol } from "@/lib/auth/roles";
import { esAccesoTotal, trabajaLeads } from "@/lib/auth/roles";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: "dashboard" | "deals" | "inbox" | "calls" | "recursos" | "ajustes" | "midia" | "productos" | "nerdstats" | "personas" | "students";
  roles: readonly Rol[];
};

/**
 * Las tabs que viven DENTRO de un programa: `/p/<programa>/<tab>` (ADR 0050, ticket
 * 097). El programa es un segmento de la ruta y no un parametro: es una frontera (ADR
 * 0043), no un filtro, y el filtro vive en la URL, nunca en la sesion (ADR 0023).
 *
 * Solo entran las tabs que ya tienen pantalla (Alejo, 28-sep): cada ticket que construye
 * una (Leads 072, Deals 069, Calls 098, Students 099...) la agrega aqui y en la nav.
 */
export const TABS_DE_PROGRAMA = ["dashboard", "deals", "inbox", "calls", "students"] as const;
export type TabDePrograma = (typeof TABS_DE_PROGRAMA)[number];

/** La tab con la que se entra a un programa cuando no se viene de otra. */
export const TAB_POR_DEFECTO: TabDePrograma = "dashboard";

/** La ruta de una tab dentro de un programa. */
export function rutaDePrograma(slug: string, tab: TabDePrograma = TAB_POR_DEFECTO): string {
  return `/p/${slug}/${tab}`;
}

/** El slug del programa de una ruta `/p/<slug>/...`, o `null` si la ruta no es de un programa. */
export function programaDeRuta(pathname: string): string | null {
  const [primero, slug] = pathname.split("/").filter(Boolean);
  return primero === "p" && slug ? slug : null;
}

/**
 * A donde lleva el selector al elegir otro programa. Si se esta en una tab de programa,
 * se queda en ESA tab (ticket 097); lo que venga detras (un id, `/p/a/deals/<id>`) y la
 * query se sueltan, porque un id y un filtro (un closer, una cohorte) son del programa
 * anterior y en el nuevo apuntarian a nada. Desde una ruta sin programa (Ajustes,
 * Productos) se entra por la tab por defecto.
 */
export function rutaAlCambiarDePrograma(pathname: string, nuevoSlug: string): string {
  const [primero, slug, tab] = pathname.split("/").filter(Boolean);
  if (primero === "p" && slug && (TABS_DE_PROGRAMA as readonly string[]).includes(tab ?? "")) {
    return rutaDePrograma(nuevoSlug, tab as TabDePrograma);
  }
  return rutaDePrograma(nuevoSlug);
}

/**
 * Navegacion por rol. Es pura y declarativa a proposito: es la misma fuente que usa el
 * sidebar y que se puede testear. Los programas NO viven aqui (ADR 0012): la nav recibe
 * el programa ELEGIDO como dato, y sus tabs apuntan a el. Sin programa visible, las tabs
 * de programa no aparecen.
 * Ojo: esconder un item NO es seguridad — cada ruta valida su rol en el servidor.
 */
export function navParaRol(rol: Rol | null, programa: string | null): ItemNav[] {
  if (!rol) return [];

  const items: ItemNav[] = [];

  // Mi dia: quien trabaja leads (closer y developer, ADR 0025). Se queda hasta que el
  // Inbox (ticket 071) lo reemplace; el ADR 0050 no quiere dos pantallas de inicio.
  if (trabajaLeads(rol)) {
    items.push({ href: "/mi-dia", etiqueta: "Mi día", icono: "midia", roles: ["closer"] });
  }

  // Dashboard del programa elegido. Lo ven todos los roles, cada uno en SUS programas
  // (ADR 0048): el selector solo ofrece los visibles y la ruta devuelve 404 a los demas.
  if (programa) {
    items.push({
      href: rutaDePrograma(programa, "dashboard"),
      etiqueta: "Dashboard",
      icono: "dashboard",
      roles: ["gerente", "closer"],
    });
    // Deals: el Kanban del programa (ADR 0050, ticket 069). Lo ven gerente y closer (y el
    // developer por `esAccesoTotal`); un closer solo en sus programas, como el Dashboard.
    items.push({
      href: rutaDePrograma(programa, "deals"),
      etiqueta: "Deals",
      icono: "deals",
      roles: ["gerente", "closer"],
    });
    // Inbox: las dos listas por las que un deal consigue dueño —Pendiente Setteo y
    // Agendados sin dueño— (ADR 0050, ticket 070). Junto a Deals, del mismo programa; un
    // closer solo en sus programas. El boton de reclamar lo ve quien trabaja leads, pero
    // la reja de verdad es el servidor.
    items.push({
      href: rutaDePrograma(programa, "inbox"),
      etiqueta: "Inbox",
      icono: "inbox",
      roles: ["gerente", "closer"],
    });
    items.push({
      href: rutaDePrograma(programa, "calls"),
      etiqueta: "Calls",
      icono: "calls",
      roles: ["gerente", "closer"],
    });
    // Students: los deals en Abonado o Completo por cohorte (ticket 099). Reemplaza las
    // pestañas `Estudiantes <cohorte>` de las hojas; mismo alcance que Deals.
    items.push({
      href: rutaDePrograma(programa, "students"),
      etiqueta: "Students",
      icono: "students",
      roles: ["gerente", "closer"],
    });
  }

  // Personas: la puerta al historial de un lead. Busca en todos los programas visibles;
  // pasa a ser la tab Leads, de un programa, con el ticket 072.
  items.push({ href: "/personas", etiqueta: "Personas", icono: "personas", roles: ["gerente", "closer"] });

  // Productos: ambos roles los administran (ADR 0016). Es la unica configuracion que
  // un closer puede tocar; su acceso por programa se enforza en el servidor.
  items.push({ href: "/productos", etiqueta: "Productos", icono: "productos", roles: ["gerente", "closer"] });

  // Recursos: ambos roles leen (brochures y links de pago vigentes). Solo quien
  // ADMINISTRA ve los controles de edicion (`esAdministrador`, ADR 0025 punto 5), y
  // eso se decide en el servidor (ticket 023).
  items.push({ href: "/recursos", etiqueta: "Recursos", icono: "recursos", roles: ["gerente", "closer"] });

  // Ajustes: los tres roles desde el 20-sep (enmienda del ticket 013). Dejo de ser
  // exclusivo del gerente cuando un closer paso a administrar las plataformas de
  // pago: sin la puerta tendria el permiso y ninguna forma de llegar. El INDICE
  // proyecta por rol (un closer solo ve la tarjeta de catalogos) y cada subpagina
  // conserva su propia guarda, que es donde vive la seguridad.
  items.push({ href: "/ajustes", etiqueta: "Ajustes", icono: "ajustes", roles: ["gerente", "closer"] });

  // Nerd Stats: SOLO el developer. Es la unica ruta exclusiva suya (ticket 025), y
  // por eso es la unica que pregunta por `esAccesoTotal` sin un rol al lado.
  if (esAccesoTotal(rol)) {
    items.push({ href: "/nerd-stats", etiqueta: "Nerd Stats", icono: "nerdstats", roles: ["developer"] });
  }

  return items;
}

/**
 * A donde mandar a alguien que entra a "/" segun su rol.
 * Sin rol no hay destino valido dentro de la app: va al login.
 * El gerente y el developer (ADR 0025) aterrizan en el Dashboard del primer programa
 * (ADR 0050); si no hay ninguno, en ajustes. El closer aterriza en el **Inbox** de su
 * primer programa visible (ticket 071, ADR 0050: el Inbox es su tab de inicio); si no ve
 * ninguno, cae en `/mi-dia`, que sigue existiendo como respaldo. El primer programa se
 * resuelve fuera (contra la base, segun el alcance del rol) y entra como dato.
 */
export function rutaInicial(rol: Rol | null, primerPrograma: string | null): string {
  if (!rol) return "/login";
  if (rol === "closer") return primerPrograma ? rutaDePrograma(primerPrograma, "inbox") : "/mi-dia";
  return primerPrograma ? rutaDePrograma(primerPrograma, "dashboard") : "/ajustes";
}
