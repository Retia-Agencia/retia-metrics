import { paginaConAdministracionGlobal } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { CatalogosAdmin } from "@/components/catalogos-admin";
import { cargarDatosDeCatalogos } from "@/lib/ajustes/catalogos/cargar-datos";

export const dynamic = "force-dynamic";

/**
 * Pantalla unica de administracion de catalogos (ticket 013, ADR 0012). Motivos (y los
 * demas catalogos del registro) los administra SOLO quien administra (gerente y
 * developer, `esAdministrador`): desde el ticket 178 (ADR 0077) un closer no entra aqui,
 * y las plataformas de pago que antes creaba desde esta pantalla las administra ahora
 * desde la tab Programa.
 *
 * La guarda admite al developer por `puedeAcceder` (ADR 0025) y `esAdministrador` sobre
 * el ROL DE VISTA (ADR 0028) cierra la vista `closer` —nunca `rol === "..."` (ADR 0025
 * punto 5): el developer administra y quedarse afuera de su propia app es el bug que este
 * repo ya arreglo dos veces.
 */
export default async function CatalogosPage() {
  await paginaConAdministracionGlobal();

  // Quien llega aqui administra: ve todos los catalogos del registro y todos los
  // programas activos para vincular una plataforma.
  const { catalogos } = await cargarDatosDeCatalogos(db);

  return (
    <PageShell
      titulo="Motivos"
      descripcion="Se usan al perder, retroceder o recuperar un deal."
      volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
      fija
    >
      <PantallaFija>
        <CatalogosAdmin catalogos={catalogos} />
      </PantallaFija>
    </PageShell>
  );
}
