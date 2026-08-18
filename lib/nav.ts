import type { Rol } from "@/lib/auth/roles";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: "comunicarte" | "tactical" | "documentos" | "ajustes" | "midia";
  roles: readonly Rol[];
};

/**
 * Navegacion por rol. La lista es declarativa a proposito: es la misma fuente
 * que usa el sidebar y que se puede testear.
 * Ojo: esconder un item NO es seguridad — cada ruta valida su rol en el servidor.
 */
export const ITEMS_NAV: readonly ItemNav[] = [
  { href: "/mi-dia", etiqueta: "Mi día", icono: "midia", roles: ["closer"] },
  { href: "/comunicarte", etiqueta: "Comunicarte", icono: "comunicarte", roles: ["gerente"] },
  { href: "/tactical-investor", etiqueta: "Tactical Investor", icono: "tactical", roles: ["gerente"] },
  { href: "/documentos", etiqueta: "Documentos", icono: "documentos", roles: ["gerente", "closer"] },
  { href: "/ajustes", etiqueta: "Ajustes", icono: "ajustes", roles: ["gerente"] },
];

export function navParaRol(rol: Rol): ItemNav[] {
  return ITEMS_NAV.filter((item) => item.roles.includes(rol));
}

/** A donde mandar a alguien que entra a "/" segun su rol. */
export function rutaInicial(rol: Rol): string {
  return rol === "gerente" ? "/comunicarte" : "/mi-dia";
}

export const PROGRAMAS = [
  { slug: "comunicarte", nombre: "Comunicarte" },
  { slug: "tactical-investor", nombre: "Tactical Investor" },
] as const;
