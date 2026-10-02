import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esRolValido } from "@/lib/auth/roles";
import { idsDeProgramasVisibles, programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { fichaDeLead } from "@/lib/queries/ficha-lead";
import { otrosProgramasDelCorreo } from "@/lib/queries/otros-programas-del-correo";
import { PageShell } from "@/components/page-shell";
import {
  AvisoOtrosProgramas,
  FichaLeadCabecera,
  FichaLeadContactos,
  FichaLeadDeals,
  FichaLeadEnvios,
} from "@/components/leads/ficha-lead";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ programa: string; id: string }> };

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La ficha del Lead (ticket 073): todos sus envios con lo que cambio entre uno y otro, sus
 * contactos con el envio del que llego cada uno, sus deals abiertos y cerrados, y el aviso si el
 * correo tambien es lead de otro programa (ticket 091). Reemplaza a
 * `/personas/[id]`, que ahora solo redirige aqui.
 *
 * Misma guarda y mismo alcance que la ficha del deal: un lead inexistente, de OTRO programa o
 * de un programa que la sesion no ve responde 404, igual que un slug inexistente (ADR 0048). La
 * URL lleva el id opaco del lead, nunca su correo (AGENTS.md). Solo lectura (ADR 0004).
 */
export default async function FichaDelLeadPage({ params }: Props) {
  const session = await paginaConRol("gerente", "closer");

  const { programa: slug, id } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  // Un id con otra forma es 404 sin tocar la base: un uuid invalido sobre una columna uuid
  // revienta en Postgres, y un 500 diria que algo existe.
  if (!programa || !ES_UUID.test(id) || !esRolValido(rol)) notFound();

  const ficha = await fichaDeLead(db, programa.id, id);
  if (!ficha) notFound();

  // El aviso de otros programas (091): la funcion da el hecho; que se ve de cada programa lo
  // decide el alcance de ESTA sesion (ADR 0048). De un programa que no ve, solo que existe.
  const [otros, visibles] = await Promise.all([
    otrosProgramasDelCorreo(db, ficha.email, programa.id),
    idsDeProgramasVisibles(session.user.id, rol),
  ]);
  const otrosVisibles = otros.filter((o) => visibles.has(o.programId));

  return (
    <PageShell titulo={ficha.nombre ?? ficha.email} descripcion={`${programa.nombre} · Lead`}>
      <div className="space-y-4">
        <Link
          href={`/p/${programa.slug}/leads`}
          className="inline-block text-sm text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Volver a los leads
        </Link>

        <AvisoOtrosProgramas visibles={otrosVisibles} ocultos={otros.length - otrosVisibles.length} />
        <FichaLeadCabecera ficha={ficha} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <FichaLeadEnvios ficha={ficha} />
          <div className="space-y-4">
            <FichaLeadDeals ficha={ficha} slug={programa.slug} />
            <FichaLeadContactos ficha={ficha} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
