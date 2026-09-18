import { paginaConRol } from "@/lib/auth/page-guards";
import { PageShell } from "@/components/page-shell";
import { PersonasBuscador } from "@/components/personas-buscador";

export const dynamic = "force-dynamic";

/**
 * `/personas`: la puerta al historial de un lead.
 *
 * Nace de un hueco, no de un pedido (18-sep): `/personas/[id]` existia y su guarda
 * dejaba entrar a gerente y closer, pero el UNICO enlace hacia alla vivia dentro del
 * buscador de `/mi-dia`, que es exclusiva de closer (ADR 0003). Resultado: un gerente
 * podia abrir el historial y no tenia como llegar a el. Faltaba la ruta, no el
 * permiso.
 *
 * La ven gerente y closer, como el dashboard (ADR 0009). Contra que programas busca
 * cada uno lo decide `buscarPersonas` segun el rol, no esta pagina.
 */
export default async function PersonasPage() {
  await paginaConRol("gerente", "closer");

  return (
    <PageShell
      titulo="Personas"
      descripcion="Busca un lead por nombre o correo y abre su historial de llamadas, ventas y abonos."
    >
      <PersonasBuscador />
    </PageShell>
  );
}
