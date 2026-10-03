import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esRolValido } from "@/lib/auth/roles";
import { programasVisibles, programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { membresiasConCalendlyDe } from "@/lib/catalogo/usuarios";
import { cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { programasActivos } from "@/lib/queries/programas";
import { PageShell } from "@/components/page-shell";
import { PerfilDeMiEspacio } from "@/components/mi-espacio/perfil-de-mi-espacio";
import { TabsDeMiEspacio, type TabMiEspacio } from "@/components/mi-espacio/tabs-de-mi-espacio";
import { CalendlyMembresias } from "@/components/calendly-membresias";
import { asignarMiCalendlyAccion } from "./acciones";
import { TabPendientes } from "@/components/mi-espacio/tab-pendientes";
import { TabMisDeals } from "@/components/mi-espacio/tab-mis-deals";
import { TabMisLlamadas } from "@/components/mi-espacio/tab-mis-llamadas";
import { TabMisStudents } from "@/components/mi-espacio/tab-mis-students";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const TABS: readonly TabMiEspacio[] = ["pendientes", "deals", "llamadas", "students"];

/**
 * Mi espacio (ticket 172): todo lo del usuario en una ruta. Arriba el **perfil** (nombre,
 * foto y rol de Google, y la cuenta de Calendly por programa con el componente del 169);
 * debajo, con selector de programa obligatorio (el programa es frontera, ADR 0043) y en
 * tabs, lo del usuario EN ese programa: Pendientes (Inbox), Mis deals (Kanban), Mis
 * llamadas y Mis students, todo acotado al usuario (ADR 0075: deals y llamadas propios).
 *
 * Reemplaza a `/mi-dia` y a `/perfil` (que ahora redirigen). La guarda es la de quien
 * trabaja leads (`paginaConRol("closer")`: closer y developer por `esAccesoTotal`), igual
 * que `/mi-dia`. `closer_id` NO se muestra (167, 159).
 *
 * El alcance es SIEMPRE el del usuario de la sesión (su id), no el de administrador: Mi
 * espacio es "lo mío". Un developer que suplanta a un closer ("ver como", ticket 172) ve
 * exactamente lo de ese closer, porque la sesión efectiva ya trae su id, rol y membresías.
 */
export default async function MiEspacioPage({ searchParams }: Props) {
  const session = await paginaConRol("closer");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) notFound();

  const userId = session.user.id;
  const membresias = await membresiasConCalendlyDe(db, userId);

  // Perfil: nombre, foto y rol vienen de Google / la sesión; no se editan aquí.
  const perfil = (
    <PerfilDeMiEspacio
      nombre={session.user.name ?? session.user.email ?? "Usuario"}
      imagen={session.user.image ?? null}
      rol={rol}
    />
  );

  // Sin membresías no hay pantalla vacía (A-04): un mensaje y el perfil, nada más.
  if (membresias.length === 0) {
    return (
      <PageShell titulo="Mi espacio" descripcion="Tu perfil y tu trabajo por programa.">
        <div className="space-y-6">
          {perfil}
          <p className="max-w-prose text-sm text-muted-foreground">
            Todavía no tienes programas asignados; pídele a tu gerente que te agregue al
            equipo de un programa.
          </p>
        </div>
      </PageShell>
    );
  }

  // El Calendly por programa (componente del 169), solo de los programas con membresía.
  const programIds = membresias.map((m) => m.programId);
  const programasDeCalendly = (await programasActivos()).filter((p) => programIds.includes(p.id));
  const cuentas = await cuentasPorPrograma(db, programIds);

  const query = await searchParams;

  // Selector de programa obligatorio por URL. Un slug ajeno es 404 (igual que las tabs de
  // programa); sin `?programa` se toma el primero visible.
  const visibles = await programasVisibles(userId, rol);
  const pedido = uno(query.programa);
  const programa = pedido
    ? await programaVisiblePorSlug(userId, rol, pedido)
    : (visibles[0] ?? null);
  if (!programa) notFound();

  const tabPedida = uno(query.tab);
  const tab: TabMiEspacio = TABS.includes(tabPedida as TabMiEspacio)
    ? (tabPedida as TabMiEspacio)
    : "pendientes";

  return (
    <PageShell titulo="Mi espacio" descripcion="Tu perfil y tu trabajo por programa.">
      <div className="space-y-6">
        {perfil}

        <CalendlyMembresias
          membresias={membresias}
          programas={programasDeCalendly}
          cuentas={cuentas}
          accion={asignarMiCalendlyAccion}
        />

        <div className="space-y-4">
          <SelectorDePrograma programas={visibles} actual={programa.slug} tab={tab} />
          <TabsDeMiEspacio slug={programa.slug} actual={tab} />

          {tab === "pendientes" ? (
            <TabPendientes programId={programa.id} slug={programa.slug} userId={userId} rol={rol} />
          ) : null}
          {tab === "deals" ? (
            <TabMisDeals programId={programa.id} slug={programa.slug} userId={userId} rol={rol} busqueda={query} />
          ) : null}
          {tab === "llamadas" ? (
            <TabMisLlamadas programId={programa.id} slug={programa.slug} userId={userId} rol={rol} />
          ) : null}
          {tab === "students" ? (
            <TabMisStudents programId={programa.id} slug={programa.slug} userId={userId} />
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

/** El selector de programa de Mi espacio: enlaces, conserva la tab actual. */
function SelectorDePrograma({
  programas,
  actual,
  tab,
}: {
  programas: readonly { slug: string; nombre: string }[];
  actual: string;
  tab: TabMiEspacio;
}) {
  if (programas.length <= 1) return null;
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Programa">
      {programas.map((p) => (
        <Link
          key={p.slug}
          href={`/mi-espacio?programa=${p.slug}&tab=${tab}`}
          aria-current={p.slug === actual ? "page" : undefined}
          className={
            p.slug === actual
              ? "rounded-lg bg-marca-suave px-3 py-1.5 text-sm font-medium text-marca"
              : "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          {p.nombre}
        </Link>
      ))}
    </nav>
  );
}
