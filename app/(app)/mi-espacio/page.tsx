import type { ReactElement } from "react";
import { notFound, redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { requireSesionReal } from "@/lib/auth/guards";
import { rolDeVista, rolRealDeSesion } from "@/lib/auth/vista";
import { esAccesoTotal, esAdministrador, esRolValido, manejaPauta, marcaOnboarding, puedeConectarIa, puedeCrearTokenPersonal, trabajaLeads } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { fecha, fechaDeInstanteEnBogota, fechaHoraEnBogota, hoyEnBogota } from "@/lib/format";
import { seccionPedida, seccionesDeRol, type SeccionMiEspacio } from "@/lib/mi-espacio/secciones";
import { PageShell } from "@/components/page-shell";
import { PerfilDeMiEspacio } from "@/components/mi-espacio/perfil-de-mi-espacio";
import { TabsDeMiEspacio } from "@/components/mi-espacio/tabs-de-mi-espacio";
import { CalendlyMembresias } from "@/components/calendly-membresias";
import { EnlacesDeCaptacion, type EnlaceVista } from "@/components/mi-espacio/enlaces-de-captacion";
import { asignarMiCalendlyAccion } from "./acciones";
import { TabMetricas } from "@/components/mi-espacio/tab-metricas";
import { TabCanales } from "@/components/mi-espacio/tab-canales";
import { TabPorDecidir } from "@/components/mi-espacio/tab-por-decidir";
import { TabMiDia } from "@/components/mi-espacio/tab-mi-dia";
import { programaPreferidoDeCookie } from "@/lib/programa-preferido-servidor";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { ETIQUETA_MCP_SCOPE, MCP_SCOPES } from "@/lib/mcp/token";
import { urlDelRecurso } from "@/lib/oauth/origen";
import { ConexionesDeIa } from "@/components/mi-espacio/conexiones-de-ia";
import { cargarDatosDeMiEspacio, type DatosDeMiEspacio } from "@/lib/mi-espacio/cargar-datos";
import { tipoDePendientePedido } from "@/lib/mi-espacio/pendientes";

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
 *  - `trabajaLeads` (closer, setter): Mi día y Métricas, siguiendo el
 *    programa del sidebar y, sin membresías, el mensaje A-04. El Calendly y ese mensaje
 *    SOLO aplican a quien trabaja leads.
 *  - `manejaPauta` sin administrar ni trabajar leads (paid trafficker): Canales. Sin
 *    selector de programa ni mensaje de membresías.
 *  - `esAdministrador` sin trabajar leads (gerente): Por decidir, por programa.
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
  const session = await paginaConRol("gerente", "closer", "paid_trafficker", "customer_success", "media");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) notFound();

  const userId = session.user.id;
  const sujeto = { rol, operaComoCloser: session.user.operaComoCloser };
  const query = await searchParams;
  const rolReal = rolRealDeSesion(session);

  // Las dos URLs retiradas aterrizan en Mi día; un chip que siga siendo pendiente conserva
  // su intención bajo el nombre actual del filtro.
  if (uno(query.tab) === "atencion" || uno(query.tab) === "notificaciones") {
    const q = new URLSearchParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (clave !== "tab" && clave !== "chip" && typeof valor === "string") q.set(clave, valor);
    }
    q.set("tab", "mi-dia");
    const tipo = tipoDePendientePedido(uno(query.chip));
    if (tipo) q.set("tipo", tipo);
    redirect(`/mi-espacio?${q}`);
  }

  const esCustomerSinTrabajo = marcaOnboarding(rol) && !trabajaLeads(sujeto) && !esAdministrador(rol) && !manejaPauta(rol);
  const puedeTrabajar = trabajaLeads(sujeto);
  const secciones = seccionesDeRol(sujeto);
  const seccion = seccionPedida(sujeto, uno(query.tab));
  const programaPedido = uno(query.programa);
  const preferido = seccion?.porPrograma ? await programaPreferidoDeCookie() : null;
  // El developer en vista `todo` recibe el mensaje del dueño ANTES de leer membresías y tabs
  // (más abajo): el cargador no lee nada de eso para él, igual que la página antes del 447.
  const esDuenoEnTodo = esAccesoTotal(rol);
  const datos = await cargarDatosDeMiEspacio(db, {
    userId,
    rol,
    puedeTrabajar: puedeTrabajar && !esDuenoEnTodo,
    puedeConectarIa: puedeConectarIa(rolReal),
    puedeCrearToken: puedeCrearTokenPersonal(rolReal),
    cargarProgramasVisibles: esCustomerSinTrabajo,
    seccion: esDuenoEnTodo ? null : seccion,
    programaPedido,
    programaPreferido: preferido,
    busqueda: query,
    hoy: hoyEnBogota(),
    origen: origenDeLaPagina("/mi-espacio", query),
  });
  const conexionesIa = bloqueConexionesIa(datos, rolReal);

  // El customer success: su pantalla es Students. Si ve algún programa, se le lleva al primero
  // (nunca se queda en Mi espacio con contenido ajeno); si no ve ninguno, el estado vacío que
  // le dice que gerencia debe asignarle un programa. Se decide por CAPACIDAD —`marcaOnboarding`
  // sin administrar, trabajar leads ni manejar pauta—, nunca por el literal del rol (ADR 0025).
  if (esCustomerSinTrabajo) {
    const visibles = datos.visibles;
    return (
      <PageShell titulo="Mi espacio" descripcion="Tu perfil y tu trabajo por programa.">
        <div className="space-y-6">
          <PerfilDeMiEspacio
            nombre={session.user.name ?? session.user.email ?? "Usuario"}
            imagen={session.user.image ?? null}
            rol={rol}
          />
          <p className="max-w-prose text-sm text-muted-foreground">
            {visibles.length === 0
              ? "Aún no tienes un programa asignado. Pídele a gerencia que te agregue a uno."
              : "Tu trabajo por programa está en Students."}
          </p>
          {conexionesIa}
        </div>
      </PageShell>
    );
  }

  // El developer en vista `todo` (acceso total) no tiene secciones propias: Mi espacio es
  // de la persona, y en `todo` no se suplanta a nadie. Se muestra el mensaje del dueño con
  // "Ver como closer". Se decide con el rol de vista (bajo suplantación la sesión efectiva
  // ya no es acceso total y cae por el camino del closer). Va ANTES de cargar membresías:
  // el dueño no tiene espacio propio por programa.
  if (esDuenoEnTodo) {
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
          {conexionesIa}
        </div>
      </PageShell>
    );
  }

  // Perfil: nombre, foto y rol vienen de Google / la sesión. Para quien trabaja leads el
  // nombre sale de la membresía (local login no mete `users.nombre` en la sesión); el
  // gerente y el paid trafficker no cargan membresías, así que usan el de la sesión.
  const membresias = datos.membresias;
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
          {conexionesIa}
        </div>
      </PageShell>
    );
  }

  // Las secciones del rol de vista (dirigidas por el registro). La pedida, si el rol la
  // cumple; si no (sin `?tab=` o una `?tab=` de otra sección forjada a mano), la primera.
  if (!seccion) {
    return (
      <PageShell titulo="Mi espacio" descripcion="Tu perfil y tus conexiones.">
        <div className="space-y-6">{perfil}{conexionesIa}</div>
      </PageShell>
    );
  }

  // El Calendly solo para quien trabaja leads, y solo de los programas con membresía (169).
  const calendly = puedeTrabajar ? bloqueCalendly(membresias, datos) : null;
  // Sus enlaces de captacion (086), de los mismos programas: calculados, nunca guardados.
  const enlaces = datos.enlaces;

  // Programa del sidebar para las secciones por programa. El programa es frontera: un
  // slug ajeno es 404 (igual que las tabs de programa); sin `?programa` se toma el ultimo
  // visible recordado o el primero.
  let programa: { id: string; slug: string; nombre: string } | null = null;
  if (seccion.porPrograma) {
    programa = datos.programa;
    if (!programa) notFound();
  }

  return (
    <PageShell titulo="Mi espacio" descripcion="Tu perfil y tu trabajo por programa.">
      <div className="space-y-6">
        <div className="space-y-4">
          <TabsDeMiEspacio secciones={secciones} actual={seccion.id} slug={programa?.slug ?? programaPedido ?? null} />

          {Seccion({ seccion, programa, perfil, calendly, enlaces, deSeccion: datos.deSeccion, conexionesIa })}
        </div>
      </div>
    </PageShell>
  );
}

function bloqueConexionesIa(datos: DatosDeMiEspacio, rolReal: unknown) {
  if (!esRolValido(rolReal) || !puedeConectarIa(rolReal)) return null;
  const puedeCrear = puedeCrearTokenPersonal(rolReal);
  const [conexiones, tokens] = datos.conexionesIa;
  const fechaDeVencimiento = (instante: Date | null) => instante
    ? `Vence el ${fecha(fechaDeInstanteEnBogota(instante))}`
    : "Sin vencimiento";
  return <ConexionesDeIa
    direccion={urlDelRecurso()}
    conexiones={conexiones.map((conexion) => ({
      id: conexion.id,
      clienteNombre: conexion.clienteNombre,
      scopeEtiqueta: ETIQUETA_MCP_SCOPE[conexion.scope],
      creado: fechaHoraEnBogota(conexion.creadoEn),
      ultimoUso: conexion.ultimoUsoEn ? fechaHoraEnBogota(conexion.ultimoUsoEn) : "—",
      vence: fechaDeVencimiento(conexion.refreshVenceEn),
    }))}
    scopes={puedeCrear ? MCP_SCOPES : undefined}
    tokens={puedeCrear ? tokens.filter((token) => token.revocadoEn === null).map((token) => ({
      id: token.id,
      nombre: token.nombre,
      clienteNombre: token.nombre,
      scope: token.scope,
      scopeEtiqueta: ETIQUETA_MCP_SCOPE[token.scope],
      creado: fechaHoraEnBogota(token.creadoEn),
      ultimoUso: token.ultimoUsoEn ? fechaHoraEnBogota(token.ultimoUsoEn) : "—",
      vence: fechaDeVencimiento(token.venceEn),
    })) : undefined}
  />;
}

/**
 * El elemento de la sección elegida (función, no componente, a propósito: así el árbol de
 * la página contiene el elemento real de la tab —`<TabMiDia/>`, `<TabCanales/>`…— y no
 * un envoltorio opaco). Las de programa reciben el programa ya resuelto. Info recibe el
 * perfil, el Calendly por programa y los enlaces de captación ya armados por la página.
 */
function Seccion({
  seccion,
  programa,
  perfil,
  calendly,
  enlaces,
  deSeccion,
  conexionesIa,
}: {
  seccion: SeccionMiEspacio;
  programa: { id: string; slug: string } | null;
  perfil: ReactElement;
  calendly: ReactElement | null;
  enlaces: EnlaceVista[];
  deSeccion: DatosDeMiEspacio["deSeccion"];
  conexionesIa: ReactElement | null;
}): ReactElement | null {
  switch (seccion.id) {
    case "info":
      // El perfil, la cuenta de Calendly por programa (169) y los enlaces de captación (086).
      // El Calendly y los enlaces sólo para quien trabaja leads (la página los deja en `null`
      // / vacío para los demás).
      return (
        <div className="space-y-6">
          {perfil}
          {calendly}
          <EnlacesDeCaptacion enlaces={enlaces} />
          {conexionesIa}
        </div>
      );
    case "mi-dia":
      return programa && deSeccion?.id === "mi-dia"
        ? <TabMiDia slug={programa.slug} datos={deSeccion.datos} />
        : null;
    case "metricas":
      // El closer se identifica por su `users.id` (ticket 167); los datos los lee el cargador.
      return deSeccion?.id === "metricas" ? <TabMetricas datos={deSeccion.datos} /> : null;
    case "canales":
      return deSeccion?.id === "canales" ? <TabCanales resumen={deSeccion.datos} /> : null;
    case "por-decidir":
      return programa && deSeccion?.id === "por-decidir"
        ? <TabPorDecidir programId={programa.id} slug={programa.slug} datos={deSeccion.datos} />
        : null;
  }
}

/** Lo que ve el dueño (acceso total), que no tiene un espacio propio. */
const MENSAJE_DEL_DUENO =
  "Mi espacio muestra el trabajo de una persona según su rol: lo que necesita atención y las métricas de un closer, lo que tiene por decidir un gerente, los canales de un paid trafficker. Como tienes acceso total, no tienes uno propio; cambia la vista a \"Como gerente\" o usa \"Ver como closer\" en el menú de tu usuario.";

/** El Calendly por programa (componente del 169), solo de los programas con membresía. */
function bloqueCalendly(membresias: DatosDeMiEspacio["membresias"], datos: DatosDeMiEspacio) {
  const programasDeCalendly = datos.calendly?.programas ?? [];
  const cuentas = datos.calendly?.cuentas ?? {};
  return (
    <CalendlyMembresias
      membresias={membresias}
      programas={programasDeCalendly}
      cuentas={cuentas}
      accion={asignarMiCalendlyAccion}
    />
  );
}
