import type { Rol } from "@/lib/auth/roles";
import { esAccesoTotal, esAdministrador, manejaPauta, marcaOnboarding, trabajaLeads, veTableroDelPrograma, configuraPrograma } from "@/lib/auth/roles";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: "dashboard" | "metas" | "deals" | "inbox" | "calls" | "recursos" | "ajustes" | "miespacio" | "nerdstats" | "students" | "leads" | "programa";
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
export const TABS_DE_PROGRAMA = ["dashboard", "metas", "leads", "deals", "inbox", "calls", "students", "programa"] as const;
export type TabDePrograma = (typeof TABS_DE_PROGRAMA)[number];

/** La tab con la que se entra a un programa cuando no se viene de otra. */
export const TAB_POR_DEFECTO: TabDePrograma = "dashboard";

/** Ruta del comparativo permitido entre todos los programas visibles (ADR 0048). */
export const RUTA_DASHBOARD_TODOS = "/dashboard";
/** No puede ser un slug: los slugs no admiten dos puntos. */
export const VALOR_PROGRAMA_TODOS = ":todos";

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
 * se queda en ESA tab (ticket 097); lo que venga detras (un id, `/p/a/deals/<id>`) y los
 * filtros se sueltan, porque pertenecen al programa anterior y en el nuevo podrían apuntar
 * a nada. `seccion` es la excepción: representa la subpestaña visible, no un filtro, y se
 * conserva (ticket 204). Desde una ruta sin programa (Ajustes, catálogos) se entra por la
 * pestaña por defecto.
 */
export function rutaAlCambiarDePrograma(
  pathname: string,
  nuevoSlug: string,
  query?: Pick<URLSearchParams, "get">,
): string {
  const [primero, slug, tab] = pathname.split("/").filter(Boolean);
  const conSeccion = (ruta: string): string => {
    const seccion = query?.get("seccion");
    if (!seccion) return ruta;
    return `${ruta}?${new URLSearchParams({ seccion }).toString()}`;
  };

  if (nuevoSlug === VALOR_PROGRAMA_TODOS) {
    return primero === "p" && slug && tab === "dashboard"
      ? conSeccion(RUTA_DASHBOARD_TODOS)
      : RUTA_DASHBOARD_TODOS;
  }
  if (primero === "p" && slug && (TABS_DE_PROGRAMA as readonly string[]).includes(tab ?? "")) {
    return conSeccion(rutaDePrograma(nuevoSlug, tab as TabDePrograma));
  }
  if (pathname === RUTA_DASHBOARD_TODOS || pathname.startsWith(`${RUTA_DASHBOARD_TODOS}/`)) {
    return conSeccion(rutaDePrograma(nuevoSlug));
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

  // El paid trafficker (ADR 0052) entra a Ajustes —adentro solo ve Canales (lo proyecta
  // el índice)— y, desde el ticket 179, a Mi espacio, su propia sección Canales (pares sin
  // clasificar y conteo por canal). Desde el ticket 102 ve el Dashboard del programa elegido,
  // sin el trabajo del equipo comercial. No administra la app ni trabaja leads, así que no
  // tiene las demás tabs de programa ni Recursos. Se pregunta por capacidad —`manejaPauta` sin
  // administrar ni trabajar leads—, nunca por el literal del rol (ADR 0025).
  if (manejaPauta(rol) && !esAdministrador(rol) && !trabajaLeads(rol)) {
    return [
      { href: "/mi-espacio", etiqueta: "Mi espacio", icono: "miespacio", roles: ["paid_trafficker"] },
      ...(programa
        ? [{ href: rutaDePrograma(programa, "dashboard"), etiqueta: "Dashboard", icono: "dashboard", roles: ["paid_trafficker"] } satisfies ItemNav]
        : []),
      { href: "/ajustes", etiqueta: "Ajustes", icono: "ajustes", roles: ["paid_trafficker"] },
    ];
  }

  // El customer success (ticket 145) ve SOLO los Students del programa elegido, en los
  // programas donde tiene membresía activa. Nada más: ni otras tabs, ni Mi espacio, ni
  // Recursos ni Ajustes. Se pregunta por capacidad —`marcaOnboarding` sin administrar ni
  // trabajar leads ni manejar pauta—, nunca por el literal del rol (ADR 0025). Sin programa
  // visible no tiene ninguna tab.
  if (marcaOnboarding(rol) && !esAdministrador(rol) && !trabajaLeads(rol) && !manejaPauta(rol)) {
    return programa
      ? [{ href: rutaDePrograma(programa, "students"), etiqueta: "Students", icono: "students", roles: ["customer_success"] }]
      : [];
  }

  const items: ItemNav[] = [];

  // Mi espacio: todo lo del usuario en una ruta (perfil + sus secciones por rol, ticket
  // 179). Lo ven quien trabaja leads (closer y developer), quien administra (gerente) y el
  // developer por `esAccesoTotal`. El paid trafficker lo tiene por su rama de arriba. Es por
  // CAPACIDAD, nunca por el literal del rol (ADR 0025).
  if (trabajaLeads(rol) || esAdministrador(rol)) {
    const roles: Rol[] = trabajaLeads(rol) ? ["closer"] : ["gerente"];
    items.push({ href: "/mi-espacio", etiqueta: "Mi espacio", icono: "miespacio", roles });
  }

  // Dashboard del programa elegido. Lo ve quien ve el tablero (gerente, developer y el paid
  // trafficker por su rama de arriba); el closer ya NO (ticket 224, ADR 0082): la ruta le
  // responde 404. El selector solo ofrece los programas visibles y cada ruta valida su rol en
  // el servidor. Se pregunta por capacidad (`veTableroDelPrograma`), nunca por el literal del rol.
  if (programa) {
    if (veTableroDelPrograma(rol)) {
      items.push({
        href: rutaDePrograma(programa, "dashboard"),
        etiqueta: "Dashboard",
        icono: "dashboard",
        roles: ["gerente"],
      });
      // Metas: cae con el Dashboard (misma capacidad, ticket 224).
      items.push({
        href: rutaDePrograma(programa, "metas"),
        etiqueta: "Metas",
        icono: "metas",
        roles: ["gerente"],
      });
    }
    // Leads: la base del programa, lo que todavia no es oportunidad (ticket 072). Mismo
    // alcance que Deals; Personas se queda como buscador entre programas.
    items.push({
      href: rutaDePrograma(programa, "leads"),
      etiqueta: "Leads",
      icono: "leads",
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
    // Inbox: las dos listas por las que un deal consigue dueño —Por settear y
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
    // Students: los deals en Ganado Pago Parcial o Ganado Pagado Completo por cohorte (ticket 099). Reemplaza las
    // pestañas `Estudiantes <cohorte>` de las hojas; mismo alcance que Deals.
    items.push({
      href: rutaDePrograma(programa, "students"),
      etiqueta: "Students",
      icono: "students",
      roles: ["gerente", "closer"],
    });
    // Programa: la ficha del programa elegido (ticket 100, la tab Programs del ADR 0050):
    // cohortes, destinos, Calendly, fuentes, comision y equipo. Solo quien CONFIGURA el
    // programa (gerente y developer, `configuraPrograma`); el closer, que antes la LEIA, ya
    // no entra (ticket 224, ADR 0082): la ruta le responde 404. Por capacidad, nunca por el
    // literal del rol.
    if (configuraPrograma(rol)) {
      items.push({
        href: rutaDePrograma(programa, "programa"),
        etiqueta: "Programa",
        icono: "programa",
        roles: ["gerente"],
      });
    }
  }

  // Personas: la puerta al historial de un lead. Busca en todos los programas visibles;
  // pasa a ser la tab Leads, de un programa, con el ticket 072.

  // Recursos: ambos roles leen (brochures y links de pago vigentes). Solo quien
  // ADMINISTRA ve los controles de edicion (`esAdministrador`, ADR 0025 punto 5), y
  // eso se decide en el servidor (ticket 023).
  items.push({ href: "/recursos", etiqueta: "Recursos", icono: "recursos", roles: ["gerente", "closer"] });

  // Ajustes: solo quien ADMINISTRA la app (gerente y developer, `esAdministrador`). El closer
  // dejo de verlo (ticket 224, ADR 0082): ya no administra plataformas de pago desde aqui y la
  // ficha del Programa, donde lo hacia, es ahora de administradores. El paid trafficker lo ve
  // por su rama de arriba (entra a Canales). El INDICE proyecta por rol y cada subpagina
  // conserva su propia guarda, que es donde vive la seguridad.
  if (esAdministrador(rol)) {
    items.push({ href: "/ajustes", etiqueta: "Ajustes", icono: "ajustes", roles: ["gerente"] });
  }

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
 * (ADR 0050); si no hay ninguno, en ajustes. El closer y el paid trafficker aterrizan en
 * **Mi espacio** (tickets 172 y 179): el closer ve su perfil y, por programa, sus
 * pendientes, deals, llamadas y students; el paid trafficker ve su sección Canales. El
 * primer programa se resuelve fuera (contra la base, segun el alcance del rol) y entra como
 * dato; para el closer y el paid trafficker ya no hace falta, pero se conserva la firma
 * porque el gerente y el developer sí lo usan.
 */
export function rutaInicial(rol: Rol | null, primerPrograma: string | null): string {
  if (!rol) return "/login";
  if (rol === "closer") return "/mi-espacio";
  // El paid trafficker aterriza en Mi espacio (ticket 179): su sección Canales (pares sin
  // clasificar y conteo por canal) es ahora su punto de entrada, no `/ajustes/canales`.
  // Por capacidad, nunca por el literal del rol (ADR 0025).
  if (manejaPauta(rol) && !esAdministrador(rol) && !trabajaLeads(rol)) return "/mi-espacio";
  // El customer success (ticket 145) aterriza en los Students de su primer programa visible:
  // es la única pantalla que ve. Por capacidad —`marcaOnboarding` sin administrar, trabajar
  // leads ni manejar pauta—, nunca por el literal del rol (ADR 0025). Sin un programa visible
  // va a Mi espacio, que para ese rol muestra el mensaje de "pídele a gerencia que te agregue
  // a un programa" (A-04 del customer success): un destino dentro de la app, no el login.
  if (marcaOnboarding(rol) && !esAdministrador(rol) && !trabajaLeads(rol) && !manejaPauta(rol)) {
    return primerPrograma ? rutaDePrograma(primerPrograma, "students") : "/mi-espacio";
  }
  return primerPrograma ? rutaDePrograma(primerPrograma, "dashboard") : "/ajustes";
}
