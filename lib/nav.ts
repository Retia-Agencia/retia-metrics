import type { Rol } from "@/lib/auth/roles";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: "programa" | "documentos" | "ajustes" | "midia";
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

  // Mi dia: solo el closer.
  if (rol === "closer") {
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

  // Documentos: ambos roles.
  items.push({ href: "/documentos", etiqueta: "Documentos", icono: "documentos", roles: ["gerente", "closer"] });

  // Ajustes: solo el gerente.
  if (rol === "gerente") {
    items.push({ href: "/ajustes", etiqueta: "Ajustes", icono: "ajustes", roles: ["gerente"] });
  }

  return items;
}

/**
 * A donde mandar a alguien que entra a "/" segun su rol.
 * Sin rol no hay destino valido dentro de la app: va al login.
 * El gerente aterriza en el primer programa activo; si no hay ninguno, en ajustes.
 * El primer programa se resuelve fuera (contra la base) y entra como dato.
 */
export function rutaInicial(rol: Rol | null, primerPrograma: string | null): string {
  if (!rol) return "/login";
  if (rol === "closer") return "/mi-dia";
  return primerPrograma ? `/programas/${primerPrograma}` : "/ajustes";
}
