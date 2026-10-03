import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { motivos } from "@/lib/db/schema";
import { duenosPosibles } from "@/lib/deals/duenos";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { plataformasDelPrograma } from "@/lib/catalogo/plataformas";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { seccionesSinDueno } from "@/lib/queries/inbox-sin-dueno";
import { inboxDelPrograma, perdidosEnCalendly, type AlcanceInbox } from "@/lib/queries/inbox";
import { PageShell } from "@/components/page-shell";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { InboxSinDueno } from "@/components/deals/inbox-sin-dueno";
import { InboxLlamadasDeHoy } from "@/components/deals/inbox-llamadas-de-hoy";
import { InboxLlamadasSueltas } from "@/components/deals/inbox-llamadas-sueltas";
import { InboxAtencion } from "@/components/deals/inbox-atencion";
import { InboxPerdidosEnCalendly } from "@/components/deals/inbox-perdidos-en-calendly";
import { HostsSinCuenta } from "@/components/mi-espacio/hosts-sin-cuenta";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ programa: string }> };

/**
 * El Inbox de un programa (ADR 0050, tickets 070 y 071): con lo que un closer abre el día y
 * ve, sin filtrar nada, qué tiene que hacer. Misma guarda y alcance que Deals:
 * `paginaConRol("gerente", "closer")`, `rolDeVista` y `programaVisiblePorSlug` → `notFound()`.
 * El developer pasa por `esAccesoTotal`; nunca se compara el rol a mano.
 *
 * ## Alcance de las listas (regla dura de AGENTS.md)
 * - Un closer ve LO SUYO (sus deals, sus llamadas que ya pasaron). Quien administra
 *   (`esAdministrador`: gerente o developer) ve todo el EQUIPO, con el dueño en cada fila.
 * - El programa es FRONTERA (ADR 0043): todo es del programa del selector, jamás cruza.
 *
 * ## Orden de las secciones (reunión con closers, 24-sep)
 *  1. Llamadas que ya pasaron sin resultado — el dolor número uno, va PRIMERA.
 *  2. Sin dueño (ticket 070): Agendados sin dueño y Por settear.
 *  3. Llamadas sueltas (decisión K2: se asignan aquí).
 *  4. Lo mío que necesita atención.
 *
 * Lo que se muestra como botón es proyección (`trabajaLeads`, `esAdministrador`); la reja
 * de verdad vive en las server actions y en `lib/`, que rechazan igual una petición forjada.
 */
export default async function InboxDelProgramaPage({ params }: Props) {
  const session = await paginaConRol("gerente", "closer");

  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  const administra = esAdministrador(rol);
  const puedeTrabajar = trabajaLeads(rol);
  // Un administrador ve el equipo entero; el closer (y el developer en vista closer) ve lo suyo.
  const alcance: AlcanceInbox = administra ? "equipo" : { ownerUserId: session.user.id };

  const [inbox, perdidos, secciones, duenos, plataformas, motivosFilas, areasFilas] = await Promise.all([
    inboxDelPrograma(db, programa.id, alcance, undefined, undefined, { userId: session.user.id, rol }),
    perdidosEnCalendly(db, programa.id),
    seccionesSinDueno(db, programa.id),
    duenosPosibles(db, programa.id),
    plataformasDelPrograma(db, programa.id),
    db.select().from(motivos).where(eq(motivos.activo, true)),
    catalogoAreas(db).listar({ soloActivos: true }),
  ]);

  const motivosDeReagenda = motivosFilas
    .map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const plataformasOpcion = plataformas.map((p) => ({ id: p.id, nombre: String(p.nombre) }));
  // El Inbox no tiene filtros en la URL: su origen es su ruta a secas (ticket 174).
  const origen = origenDeLaPagina(`/p/${programa.slug}/inbox`, {});

  return (
    <PageShell titulo={programa.nombre} descripcion="Inbox">
      <div className="space-y-4">
        <InboxPerdidosEnCalendly filas={perdidos} slug={programa.slug} origen={origen} />

        {/* 1 · Llamadas que ya pasaron sin resultado (el dolor número uno, va primera). */}
        <InboxLlamadasDeHoy
          llamadas={inbox.llamadasDeHoy}
          slug={programa.slug}
          puedeRegistrar={puedeTrabajar}
          motivosReagenda={motivosDeReagenda}
          origen={origen}
        />

        {/* 2 · Sin dueño (ticket 070): Agendados sin dueño y Por settear. */}
        <InboxSinDueno
          pendienteSetteo={secciones.pendienteSetteo}
          unclaimed={secciones.unclaimed}
          puedeReclamar={puedeTrabajar}
          administra={administra}
          duenos={duenos}
        />

        {/* 3 · Llamadas sueltas del programa (decisión K2: se asignan aquí). */}
        <InboxLlamadasSueltas
          llamadas={inbox.llamadasSueltas}
          programId={programa.id}
          origen={origen}
        />

        {inbox.llamadasSinCloser.length > 0 ? (
          <HostsSinCuenta filas={inbox.llamadasSinCloser} />
        ) : null}

        {/* 4 · Lo mío que necesita atención. */}
        <InboxAtencion
          filas={inbox.atencion}
          slug={programa.slug}
          nombreDeEtapa={NOMBRE_DE_ETAPA}
          tonoDeEtapa={TONO_DE_ETAPA}
          plataformas={plataformasOpcion}
          areas={areasFilas.map((a) => ({ id: a.id, nombre: String(a.nombre) }))}
          puedeRegistrar={puedeTrabajar}
          origen={origen}
        />
      </div>
    </PageShell>
  );
}
