import type { Rol, SujetoDeCapacidad } from "@/lib/auth/roles";
import { administraGlobal, esAccesoTotal, esAdministrador, manejaPauta, manejaPautaGlobal, marcaOnboarding, trabajaLeads, veTableroDelPrograma, leePrograma } from "@/lib/auth/roles";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: "hub" | "deals" | "inbox" | "calls" | "recursos" | "ajustes" | "miespacio" | "nerdstats" | "students" | "leads" | "programa";
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
export const TABS_DE_PROGRAMA = ["hub", "leads", "deals", "inbox", "calls", "students", "programa"] as const;
export type TabDePrograma = (typeof TABS_DE_PROGRAMA)[number];

/** La tab con la que se entra a un programa cuando no se viene de otra. */
export const TAB_POR_DEFECTO: TabDePrograma = "hub";

/** Ruta del Hub de todos los programas visibles: solo suma (ADR 0048, ADR 0086). */
export const RUTA_HUB_TODOS = "/hub";

/** Las pestañas del Hub, en el orden del ADR 0086. */
export const SECCIONES_DEL_HUB = ["hoy", "comercial", "dinero", "pauta", "origen"] as const;
export type SeccionDelHub = (typeof SECCIONES_DEL_HUB)[number];

/** Las pestañas del Dashboard que cambiaron de nombre al pasar al Hub (ticket 250). */
const SECCION_VIEJA_EN_EL_HUB: Readonly<Record<string, SeccionDelHub>> = {
  pulso: "hoy",
  operacion: "comercial",
};

/**
 * La query con la que una URL vieja (`dashboard`, `metas` y sus listas) abre la misma vista
 * en el Hub (ticket 250): conserva cada filtro y traduce la pestaña al nombre nuevo.
 * `seccion` la fija cuando la ruta vieja era una pestaña entera (Metas vive en Hoy).
 * Devuelve `""` o `"?..."`.
 */
export function queryHaciaElHub(
  busqueda: Record<string, string | string[] | undefined>,
  seccion?: SeccionDelHub,
): string {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(busqueda)) {
    for (const v of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) {
      q.append(clave, clave === "seccion" ? SECCION_VIEJA_EN_EL_HUB[v] ?? v : v);
    }
  }
  if (seccion) q.set("seccion", seccion);
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}
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
    return primero === "p" && slug && tab === "hub"
      ? conSeccion(RUTA_HUB_TODOS)
      : RUTA_HUB_TODOS;
  }
  if (primero === "p" && slug && (TABS_DE_PROGRAMA as readonly string[]).includes(tab ?? "")) {
    return conSeccion(rutaDePrograma(nuevoSlug, tab as TabDePrograma));
  }
  if (pathname === RUTA_HUB_TODOS || pathname.startsWith(`${RUTA_HUB_TODOS}/`)) {
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
export function navParaRol(sujeto: SujetoDeCapacidad, programa: string | null, alcanceLimitado = false): ItemNav[] {
  const { rol } = sujeto;
  if (!rol) return [];

  // El paid trafficker (ADR 0052) entra a Ajustes —adentro solo ve Canales (lo proyecta
  // el índice)— y, desde el ticket 179, a Mi espacio, su propia sección Canales (pares sin
  // clasificar y conteo por canal). Ve el Hub y, desde el ticket 266, la ficha del Programa
  // elegido, sin el trabajo del equipo comercial. No administra la app ni trabaja leads, así que no
  // tiene las demás tabs operativas ni Recursos. Se pregunta por capacidad —`manejaPauta` sin
  // administrar ni trabajar leads—, nunca por el literal del rol (ADR 0025).
  if (manejaPauta(rol) && !esAdministrador(rol) && !trabajaLeads(sujeto)) {
    return [
      { href: "/mi-espacio", etiqueta: "Mi espacio", icono: "miespacio", roles: ["paid_trafficker"] },
      ...(programa
        ? [
            { href: rutaDePrograma(programa, "hub"), etiqueta: "Hub", icono: "hub", roles: ["paid_trafficker"] } satisfies ItemNav,
            { href: rutaDePrograma(programa, "programa"), etiqueta: "Programa", icono: "programa", roles: ["paid_trafficker"] } satisfies ItemNav,
          ]
        : []),
      // Su Ajustes es Canales y Meta: la misma pregunta que la guarda del índice (ADR 0094 punto 4).
      ...(manejaPautaGlobal({ rol, alcanceLimitado })
        ? [{ href: "/ajustes", etiqueta: "Ajustes", icono: "ajustes", roles: ["paid_trafficker"] } satisfies ItemNav]
        : []),
    ];
  }

  // El customer success (ticket 145) ve SOLO los Students del programa elegido, en los
  // programas donde tiene membresía activa. Nada más: ni otras tabs, ni Mi espacio, ni
  // Recursos ni Ajustes. Se pregunta por capacidad —`marcaOnboarding` sin administrar ni
  // trabajar leads ni manejar pauta—, nunca por el literal del rol (ADR 0025). Sin programa
  // visible no tiene ninguna tab.
  if (marcaOnboarding(rol) && !esAdministrador(rol) && !trabajaLeads(sujeto) && !manejaPauta(rol)) {
    return programa
      ? [{ href: rutaDePrograma(programa, "students"), etiqueta: "Students", icono: "students", roles: ["customer_success"] }]
      : [];
  }

  const items: ItemNav[] = [];

  // Mi espacio: todo lo del usuario en una ruta (perfil + sus secciones por rol, ticket
  // 179). Lo ven quien trabaja leads (closer y developer), quien administra (gerente) y el
  // developer por `esAccesoTotal`. El paid trafficker lo tiene por su rama de arriba. Es por
  // CAPACIDAD, nunca por el literal del rol (ADR 0025).
  if (trabajaLeads(sujeto) || esAdministrador(rol)) {
    const roles: Rol[] = trabajaLeads(sujeto) ? ["closer"] : ["gerente"];
    items.push({ href: "/mi-espacio", etiqueta: "Mi espacio", icono: "miespacio", roles });
  }

  // Hub del programa elegido (ADR 0086, ticket 250; antes Dashboard, y Metas vive ahora en su
  // pestaña Hoy). Lo ve quien ve el tablero (gerente, developer y el paid trafficker por su
  // rama de arriba); el closer NO (ticket 224, ADR 0082): la ruta le responde 404. El selector
  // solo ofrece los programas visibles y cada ruta valida su rol en el servidor. Se pregunta
  // por capacidad (`veTableroDelPrograma`), nunca por el literal del rol.
  if (programa) {
    if (veTableroDelPrograma(rol)) {
      items.push({
        href: rutaDePrograma(programa, "hub"),
        etiqueta: "Hub",
        icono: "hub",
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
    // developer por `esAccesoTotal`); un closer solo en sus programas.
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
    // cohortes, destinos, Calendly, fuentes, comision y equipo. La LEE quien administra y
    // el paid trafficker (ticket 266, ADR 0082 enmendado el 15-oct); el closer no entra.
    // Por capacidad, nunca por el literal del rol.
    if (leePrograma(rol)) {
      items.push({
        href: rutaDePrograma(programa, "programa"),
        etiqueta: "Programa",
        icono: "programa",
        roles: ["gerente", "paid_trafficker"],
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
  if (administraGlobal({ rol, alcanceLimitado })) {
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
 * El gerente y el developer (ADR 0025) aterrizan en el Hub del primer programa
 * (ADR 0050); si no hay ninguno, en ajustes. El closer y el paid trafficker aterrizan en
 * **Mi espacio** (tickets 172 y 179): el closer ve su perfil y, por programa, sus
 * pendientes, deals, llamadas y students; el paid trafficker ve su sección Canales. El
 * primer programa se resuelve fuera (contra la base, segun el alcance del rol) y entra como
 * dato; para el closer y el paid trafficker ya no hace falta, pero se conserva la firma
 * porque el gerente y el developer sí lo usan.
 */
export function rutaInicial(sujeto: SujetoDeCapacidad, primerPrograma: string | null): string {
  const { rol } = sujeto;
  if (!rol) return "/login";
  if (trabajaLeads(sujeto) && !esAdministrador(rol)) return "/mi-espacio";
  // El paid trafficker aterriza en Mi espacio (ticket 179): su sección Canales (pares sin
  // clasificar y conteo por canal) es ahora su punto de entrada, no `/ajustes/canales`.
  // Por capacidad, nunca por el literal del rol (ADR 0025).
  if (manejaPauta(rol) && !esAdministrador(rol) && !trabajaLeads(sujeto)) return "/mi-espacio";
  // El customer success (ticket 145) aterriza en los Students de su primer programa visible:
  // es la única pantalla que ve. Por capacidad —`marcaOnboarding` sin administrar, trabajar
  // leads ni manejar pauta—, nunca por el literal del rol (ADR 0025). Sin un programa visible
  // va a Mi espacio, que para ese rol muestra el mensaje de "pídele a gerencia que te agregue
  // a un programa" (A-04 del customer success): un destino dentro de la app, no el login.
  if (marcaOnboarding(rol) && !esAdministrador(rol) && !trabajaLeads(sujeto) && !manejaPauta(rol)) {
    return primerPrograma ? rutaDePrograma(primerPrograma, "students") : "/mi-espacio";
  }
  return primerPrograma ? rutaDePrograma(primerPrograma, "hub") : "/ajustes";
}
