import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { historialDePersona } from "@/lib/queries/personas";
import { PageShell } from "@/components/page-shell";
import { HistorialPersona } from "@/components/historial-persona";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Forma de un UUID v4 tal como lo genera la base. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Historial de una persona (ticket 006, ADR 0003, 0009, 0013, 0015, 0021).
 *
 * La URL lleva el `personId` (uuid opaco) y NUNCA el correo: ningun dato personal
 * viaja en una ruta ni en un query string (restriccion dura de AGENTS.md).
 *
 * Lo ven gerente y closer. El ALCANCE lo decide `historialDePersona` contra la
 * unica funcion de alcance (ADR 0048, ticket 094): un lead de un programa que esta
 * sesion no ve responde 404, igual que un id inexistente. La guarda corre ANTES de
 * mirar el id, asi que sin sesion se redirige al login sin filtrar que ids existen.
 *
 * Es de solo lectura: editar o borrar registros pasados esta fuera del alcance.
 */
export default async function PersonaPage({ params }: Props) {
  const session = await paginaConRol("gerente", "closer");

  const { id } = await params;
  // Un id con otra forma es 404 sin tocar la base: `where id = 'lead@correo.co'`
  // sobre una columna uuid revienta en Postgres, y un 500 diria que el id existe
  // pero algo fallo. Ademas corta de raiz que alguien pruebe a pasar un correo.
  if (!UUID.test(id)) notFound();

  // El rol de vista, no `session.user.rol` crudo (ADR 0028): un developer en vista
  // `closer` ve solo sus programas.
  const historial = await historialDePersona(id, session.user.id, await rolDeVista(session));
  // No existe, o es de un programa fuera del alcance: 404 en los dos casos. Un id
  // inexistente y una persona sin actividad son cosas distintas, y la ficha vacia
  // mentiria; un lead ajeno no se distingue de uno inexistente, a proposito.
  if (!historial) notFound();

  return (
    <PageShell
      titulo={historial.persona.nombre ?? historial.persona.emailNormalizado}
      descripcion={`Historial en ${historial.persona.programaNombre}: llamadas, ventas y abonos.`}
    >
      <HistorialPersona historial={historial} />
    </PageShell>
  );
}
