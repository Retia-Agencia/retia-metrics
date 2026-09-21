import type { Rol } from "@/lib/auth/roles";
import { esAccesoTotal } from "@/lib/auth/roles";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: "programa" | "recursos" | "ajustes" | "midia" | "productos" | "nerdstats" | "personas";
  roles: readonly Rol[];
};

/**
 * Navegacion por rol. Es pura y declarativa a proposito: es la misma fuente que
 * usa el sidebar y que se puede testear. Los programas NO viven aqui (ADR 0012):
 * salen de la base y entran como dato, uno por programa activo.
 * Ojo: esconder un item NO es seguridad — cada ruta valida su rol en el servidor.
 */
export function navParaRol(
  rol: Rol | null,
  programas: readonly { slug: string; nombre: string }[],
): ItemNav[] {
  if (!rol) return [];

  const items: ItemNav[] = [];

  // Mi dia: el closer, y el developer que ve la union de todo (ADR 0025).
  if (rol === "closer" || esAccesoTotal(rol)) {
    items.push({ href: "/mi-dia", etiqueta: "Mi día", icono: "midia", roles: ["closer"] });
  }

  // Un item por programa activo, en el orden que llega (la base ordena por nombre).
  // Ambos roles lo ven: el dashboard del CRM abre a todos (ADR 0009).
  for (const p of programas) {
    items.push({
      href: `/programas/${p.slug}`,
      etiqueta: p.nombre,
      icono: "programa",
      roles: ["gerente", "closer"],
    });
  }

  // Personas: la puerta al historial de un lead. Ambos roles, como el dashboard
  // (ADR 0009). Antes solo se llegaba desde el buscador de /mi-dia, asi que un
  // gerente no tenia NINGUNA forma de abrir un historial (18-sep).
  items.push({ href: "/personas", etiqueta: "Personas", icono: "personas", roles: ["gerente", "closer"] });

  // Productos: ambos roles los administran (ADR 0016). Es la unica configuracion que
  // un closer puede tocar; su acceso por programa se enforza en el servidor.
  items.push({ href: "/productos", etiqueta: "Productos", icono: "productos", roles: ["gerente", "closer"] });

  // Recursos: ambos roles leen (brochures y links de pago vigentes). Solo quien
  // ADMINISTRA ve los controles de edicion (`esAdministrador`, ADR 0025 punto 5), y
  // eso se decide en el servidor (ticket 023).
  items.push({ href: "/recursos", etiqueta: "Recursos", icono: "recursos", roles: ["gerente", "closer"] });

  // Nerd Stats: SOLO el developer. Es la unica ruta exclusiva suya (ticket 025), y
  // por eso es la unica que pregunta por `esAccesoTotal` sin un rol al lado.
  if (esAccesoTotal(rol)) {
    items.push({ href: "/nerd-stats", etiqueta: "Nerd Stats", icono: "nerdstats", roles: ["developer"] });
  }

  // Ajustes: los tres roles desde el 20-sep (enmienda del ticket 013). Dejo de ser
  // exclusivo del gerente cuando un closer paso a administrar las plataformas de
  // pago: sin la puerta tendria el permiso y ninguna forma de llegar. El INDICE
  // proyecta por rol (un closer solo ve la tarjeta de catalogos) y cada subpagina
  // conserva su propia guarda, que es donde vive la seguridad.
  items.push({ href: "/ajustes", etiqueta: "Ajustes", icono: "ajustes", roles: ["gerente", "closer"] });

  return items;
}

/**
 * A donde mandar a alguien que entra a "/" segun su rol.
 * Sin rol no hay destino valido dentro de la app: va al login.
 * El gerente aterriza en el primer programa activo; si no hay ninguno, en ajustes.
 * El developer (ADR 0025) aterriza igual que el gerente: es el mismo trabajo de
 * administracion, y un dashboard de programa es un mejor punto de partida que la
 * vista de closer. El primer programa se resuelve fuera (contra la base) y entra
 * como dato.
 */
export function rutaInicial(rol: Rol | null, primerPrograma: string | null): string {
  if (!rol) return "/login";
  if (rol === "closer") return "/mi-dia";
  return primerPrograma ? `/programas/${primerPrograma}` : "/ajustes";
}
