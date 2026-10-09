import Link from "next/link";
import type { ReactElement } from "react";
import { notFound, redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { requireSesionReal } from "@/lib/auth/guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAccesoTotal, esAdministrador, esRolValido, manejaPauta, marcaOnboarding, trabajaLeads, type Rol } from "@/lib/auth/roles";
import { programasVisibles, programaVisiblePorSlug } from "@/lib/auth/alcance";
import { rutaDePrograma } from "@/lib/nav";
import { db } from "@/lib/db";
import { membresiasConCalendlyDe } from "@/lib/catalogo/usuarios";
import { cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { programasActivos } from "@/lib/queries/programas";
import { hoyEnBogota } from "@/lib/format";
import { seccionPedida, seccionesDeRol, type SeccionMiEspacio } from "@/lib/mi-espacio/secciones";
import { PageShell } from "@/components/page-shell";
import { PerfilDeMiEspacio } from "@/components/mi-espacio/perfil-de-mi-espacio";
import { TabsDeMiEspacio } from "@/components/mi-espacio/tabs-de-mi-espacio";
import { CalendlyMembresias } from "@/components/calendly-membresias";
import { EnlacesDeCaptacion } from "@/components/mi-espacio/enlaces-de-captacion";
import { enlacesDeCaptacion } from "@/lib/atribucion/captacion-del-closer";
import { asignarMiCalendlyAccion } from "./acciones";
import { TabAtencion } from "@/components/mi-espacio/tab-atencion";
import { TabMetricas } from "@/components/mi-espacio/tab-metricas";
import { TabCanales } from "@/components/mi-espacio/tab-canales";
import { TabPorDecidir } from "@/components/mi-espacio/tab-por-decidir";
import { elegirPrograma } from "@/lib/programa-preferido";
import { programaPreferidoDeCookie } from "@/lib/programa-preferido-servidor";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Mi espacio (tickets 172, 179): el perfil arriba y, debajo, SOLO lo que le corresponde a
 * esa persona y SOLO las secciones del trabajo de su rol (ADR 0077 punto 1). Dos ejes que
 * no se mezclan (decisión de Mani, 3-oct):
 *  - **De quién:** siempre la persona de la sesión; nunca "todo lo que el rol alcanza"
 *    (eso vive en las tabs del programa).
 *  - **Qué secciones:** las del trabajo de su rol, dirigidas por el registro
 *    `lib/mi-espacio/secciones.ts` (nunca `rol === "..."`, ADR 0025).
 *
 * Quién ve qué, por capacidad:
 *  - `trabajaLeads` (closer, setter): Necesita atención y Mis métricas,
 *    con selector de programa y, sin membresías, el mensaje A-04. El Calendly y ese mensaje
 *    SOLO aplican a quien trabaja leads.
 *  - `manejaPauta` sin administrar ni trabajar leads (paid trafficker): Canales. Sin
 *    selector de programa ni mensaje de membresías.
 *  - `esAdministrador` sin trabajar leads (gerente): Por decidir, con selector de programa.
 *  - El developer: ve las secciones de su ROL DE VISTA; en vista `todo` (acceso total) no
 *    hay secciones propias, así que se muestra el mensaje que lo explica y ofrece "Ver como
 *    closer". Se decide con `esAccesoTotal` del rol REAL (`requireSesionReal`), nunca con
 *    el literal del rol.
 *
 * La guarda admite los cuatro roles base (`paginaConRol("gerente", "closer",
 * "paid_trafficker", "customer_success")`); el developer pasa por `esAccesoTotal`. El filtro
 * de la vista corre en `rolDeVista`. `closer_id` NO se muestra (167, 159).
 *
 * El customer success (ticket 145) sólo entra aquí cuando NO tiene un programa visible: su
 * pantalla es Students, así que con un programa se le redirige a él, y sin ninguno ve el
 * estado vacío que le pide a gerencia una membresía (A-04 del customer success). No tiene
 * secciones propias en el registro, así que nunca cae en el camino de las tabs.
 */
export default async function MiEspacioPage({ searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer", "paid_trafficker", "customer_success");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) notFound();

  const userId = session.user.id;
  const query = await searchParams;

  // El customer success: su pantalla es Students. Si ve algún programa, se le lleva al primero
  // (nunca se queda en Mi espacio con contenido ajeno); si no ve ninguno, el estado vacío que
  // le dice que gerencia debe asignarle un programa. Se decide por CAPACIDAD —`marcaOnboarding`
  // sin administrar, trabajar leads ni manejar pauta—, nunca por el literal del rol (ADR 0025).
  if (marcaOnboarding(rol) && !trabajaLeads(rol) && !esAdministrador(rol) && !manejaPauta(rol)) {
    const visibles = await programasVisibles(userId, rol);
    if (visibles.length > 0) {
      const preferido = await programaPreferidoDeCookie();
      const elegido = elegirPrograma(visibles, preferido) ?? visibles[0];
      redirect(rutaDePrograma(elegido.slug, "students"));
    }
    return (
      <PageShell titulo="Mi espacio" descripcion="Tu perfil y tu trabajo por programa.">
        <div className="space-y-6">
          <PerfilDeMiEspacio
            nombre={session.user.name ?? session.user.email ?? "Usuario"}
            imagen={session.user.image ?? null}
            rol={rol}
          />
          <p className="max-w-prose text-sm text-muted-foreground">
            Aún no tienes un programa asignado. Pídele a gerencia que te agregue a uno.
          </p>
        </div>
      </PageShell>
    );
  }

  // El developer en vista `todo` (acceso total) no tiene secciones propias: Mi espacio es
  // de la persona, y en `todo` no se suplanta a nadie. Se muestra el mensaje del dueño con
  // "Ver como closer". Se decide con el rol de vista (bajo suplantación la sesión efectiva
  // ya no es acceso total y cae por el camino del closer). Va ANTES de cargar membresías:
  // el dueño no tiene espacio propio por programa.
  if (esAccesoTotal(rol)) {
    return (
      <PageShell titulo="Mi espacio" descripcion="Tu perfil y tu trabajo por programa.">
        <div className="space-y-6">
          <PerfilDeMiEspacio
            nombre={session.user.name ?? session.user.email ?? "Usuario"}
            imagen={session.user.image ?? null}
            rol={rol}
          />
          <p className="max-w-prose text-sm text-muted-foreground">
            {MENSAJE_DEL_DUENO}
          </p>
        </div>
      </PageShell>
    );
  }

  // Perfil: nombre, foto y rol vienen de Google / la sesión. Para quien trabaja leads el
  // nombre sale de la membresía (local login no mete `users.nombre` en la sesión); el
  // gerente y el paid trafficker no cargan membresías, así que usan el de la sesión.
  const puedeTrabajar = trabajaLeads(rol);
  const membresias = puedeTrabajar ? await membresiasConCalendlyDe(db, userId) : [];
  const nombrePerfil = membresias[0]?.usuario ?? session.user.name ?? session.user.email ?? "Usuario";
  const perfil = (
    <PerfilDeMiEspacio nombre={nombrePerfil} imagen={session.user.image ?? null} rol={rol} />
  );

  // El trabajo de quien trabaja leads vive por programa, así que necesita membresías: el
  // Calendly por programa (169) y, sin membresías, el mensaje A-04. El gerente y el paid
  // trafficker NO pasan por aquí (no trabajan leads): no ven ni Calendly ni ese mensaje.
  if (puedeTrabajar && membresias.length === 0) {
    // El dueño en vista `closer` (sin suplantar) tampoco tiene membresías: no se le pide que
    // le hable a su gerente. Se decide por la cuenta de VERDAD (excepción nombrada en el
    // guardián de `rol-de-vista-centralizado`); bajo "ver como" la sesión efectiva es la del
    // closer suplantado y el mensaje es el suyo.
    const real = await requireSesionReal();
    const esDueno = esAccesoTotal(real.user.rol) && real.user.id === userId;
    return (
      <PageShell titulo="Mi espacio" descripcion="Tu perfil y tu trabajo por programa.">
        <div className="space-y-6">
          {perfil}
          <p className="max-w-prose text-sm text-muted-foreground">
            {esDueno
              ? MENSAJE_DEL_DUENO
              : "Todavía no tienes programas asignados; pídele a tu gerente que te agregue al equipo de un programa."}
          </p>
        </div>
      </PageShell>
    );
  }

  // Las secciones del rol de vista (dirigidas por el registro). La pedida, si el rol la
  // cumple; si no (sin `?tab=` o una `?tab=` de otra sección forjada a mano), la primera.
  const secciones = seccionesDeRol(rol);
  const seccion = seccionPedida(rol, uno(query.tab));
  if (!seccion) notFound();

  // El Calendly solo para quien trabaja leads, y solo de los programas con membresía (169).
  const calendly = puedeTrabajar ? await bloqueCalendly(membresias) : null;
  // Sus enlaces de captacion (086), de los mismos programas: calculados, nunca guardados.
  const enlaces = puedeTrabajar ? await enlacesDeCaptacion(db, userId) : [];

  // Selector de programa solo para las secciones que lo usan. El programa es frontera: un
  // slug ajeno es 404 (igual que las tabs de programa); sin `?programa` se toma el ultimo
  // visible recordado o el primero.
  let programa: { id: string; slug: string; nombre: string } | null = null;
  let visibles: { id: string; slug: string; nombre: string }[] = [];
  if (seccion.usaSelectorDePrograma) {
    visibles = await programasVisibles(userId, rol);
    const pedido = uno(query.programa);
    const preferido = await programaPreferidoDeCookie();
    programa = seccion.id === "metricas" && pedido === "todos"
      ? null
      : pedido
      ? await programaVisiblePorSlug(userId, rol, pedido)
      : elegirPrograma(visibles, preferido);
    if (!programa && !(seccion.id === "metricas" && pedido === "todos" && visibles.length > 0)) notFound();
  }

  return (
    <PageShell titulo="Mi espacio" descripcion="Tu perfil y tu trabajo por programa.">
      <div className="space-y-6">
        {perfil}
        {calendly}
        <EnlacesDeCaptacion enlaces={enlaces} />

        <div className="space-y-4">
          <TabsDeMiEspacio secciones={secciones} actual={seccion.id} slug={programa?.slug ?? null} />
          {seccion.usaSelectorDePrograma ? (
            <SelectorDePrograma programas={visibles} actual={programa?.slug ?? "todos"} tab={seccion.id} busqueda={query} />
          ) : null}

          {Seccion({ seccion, programa, programas: visibles, userId, rol, busqueda: query })}
        </div>
      </div>
    </PageShell>
  );
}

/**
 * El elemento de la sección elegida (función, no componente, a propósito: así el árbol de
 * la página contiene el elemento real de la tab —`<TabAtencion/>`, `<TabCanales/>`…— y no
 * un envoltorio opaco). Las de programa reciben el programa ya resuelto.
 */
function Seccion({
  seccion,
  programa,
  programas,
  userId,
  rol,
  busqueda,
}: {
  seccion: SeccionMiEspacio;
  programa: { id: string; slug: string } | null;
  programas: { id: string; slug: string; nombre: string }[];
  userId: string;
  rol: Rol;
  busqueda: Record<string, string | string[] | undefined>;
}): ReactElement | null {
  switch (seccion.id) {
    case "atencion":
      return programa ? <TabAtencion programId={programa.id} slug={programa.slug} userId={userId} rol={rol} /> : null;
    case "metricas": {
      // El closer se identifica por su `users.id` (ticket 167): asi un closer sin el
      // texto `closer_id` ve igual sus metricas. Ya no hay que exigir el texto.
      const seleccionado = programa
        ? { ...programa, nombre: programas.find((p) => p.id === programa.id)?.nombre ?? programa.slug }
        : null;
      return <TabMetricas programas={programas} programa={seleccionado} closerUserId={userId} hoy={hoyEnBogota()} busqueda={busqueda} />;
    }
    case "canales":
      return <TabCanales />;
    case "por-decidir":
      return programa ? <TabPorDecidir programId={programa.id} slug={programa.slug} /> : null;
  }
}

/** Lo que ve el dueño (acceso total), que no tiene un espacio propio. */
const MENSAJE_DEL_DUENO =
  "Mi espacio muestra el trabajo de una persona según su rol: lo que necesita atención y las métricas de un closer, lo que tiene por decidir un gerente, los canales de un paid trafficker. Como tienes acceso total, no tienes uno propio; cambia la vista a \"Como gerente\" o usa \"Ver como closer\" en el menú de tu usuario.";

/** El Calendly por programa (componente del 169), solo de los programas con membresía. */
async function bloqueCalendly(
  membresias: Awaited<ReturnType<typeof membresiasConCalendlyDe>>,
) {
  const programIds = membresias.map((m) => m.programId);
  const [programasDeCalendly, cuentas] = await Promise.all([
    programasActivos().then((ps) => ps.filter((p) => programIds.includes(p.id))),
    cuentasPorPrograma(db, programIds),
  ]);
  return (
    <CalendlyMembresias
      membresias={membresias}
      programas={programasDeCalendly}
      cuentas={cuentas}
      accion={asignarMiCalendlyAccion}
    />
  );
}

/** El selector de programa de Mi espacio: enlaces, conserva la tab actual. */
function SelectorDePrograma({
  programas,
  actual,
  tab,
  busqueda,
}: {
  programas: readonly { slug: string; nombre: string }[];
  actual: string;
  tab: string;
  busqueda: Record<string, string | string[] | undefined>;
}) {
  if (programas.length <= 1 && tab !== "metricas") return null;
  const href = (programa: string) => {
    const q = new URLSearchParams();
    for (const [clave, valor] of Object.entries(busqueda)) if (typeof valor === "string") q.set(clave, valor);
    q.set("programa", programa);
    q.set("tab", tab);
    return `/mi-espacio?${q}`;
  };
  const opciones = tab === "metricas"
    ? [...programas, { slug: "todos", nombre: "Todos" }]
    : programas;
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Programa">
      {opciones.map((p) => (
        <Link
          key={p.slug}
          href={href(p.slug)}
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
