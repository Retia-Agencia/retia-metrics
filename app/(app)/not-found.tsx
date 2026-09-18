import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";

/**
 * El 404 de adentro de la app: lo que ve alguien con sesion cuando pide un id que no
 * existe (`/personas/<uuid>` que no esta, o con forma invalida) o una ruta que no hay.
 *
 * Existe porque el de Next viene en ingles y sin estilo ("404 · This page could not be
 * found"), y la UI de este proyecto es en espanol (AGENTS.md). Se renderiza DENTRO del
 * layout de `(app)`, asi que conserva el sidebar y la persona no queda en un callejon
 * sin salida.
 *
 * No dice QUE no se encontro, a proposito: el id que se pidio puede ser el de una
 * persona, y repetirlo seria filtrar por que ids se pregunta.
 */
export default function NoEncontrado() {
  return (
    <PageShell
      titulo="No encontramos eso"
      descripcion="El enlace puede estar viejo, o el registro ya no existe."
    >
      <Button size="sm" nativeButton={false} render={<Link href="/">Volver al inicio</Link>} />
    </PageShell>
  );
}
