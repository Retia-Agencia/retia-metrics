import { eq } from "drizzle-orm";
import Link from "next/link";
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
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { num } from "@/lib/format";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { InboxSinDueno } from "@/components/deals/inbox-sin-dueno";
import { InboxLlamadasDeHoy } from "@/components/deals/inbox-llamadas-de-hoy";
import { InboxLlamadasSueltas } from "@/components/deals/inbox-llamadas-sueltas";
import { InboxAtencion } from "@/components/deals/inbox-atencion";
import { InboxPerdidosEnCalendly } from "@/components/deals/inbox-perdidos-en-calendly";
import { HostsSinCuenta } from "@/components/mi-espacio/hosts-sin-cuenta";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
 * ## Orden de las pestañas (reunión con closers, 24-sep; ticket 185)
 *  1. Llamadas que ya pasaron sin resultado — el dolor número uno, va PRIMERA.
 *  2. Sin dueño (ticket 070): Agendados sin dueño y Por settear.
 *  3. Perdidos en Calendly.
 *  4. Llamadas sueltas (decisión K2: se asignan aquí).
 *  5. Lo mío que necesita atención.
 *
 * Lo que se muestra como botón es proyección (`trabajaLeads`, `esAdministrador`); la reja
 * de verdad vive en las server actions y en `lib/`, que rechazan igual una petición forjada.
 */
export default async function InboxDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");

  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  const administra = esAdministrador(rol);
  const puedeTrabajar = trabajaLeads(rol);
  const query = await searchParams;
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
  const tabs = [
    { id: "sin-resultado", etiqueta: "Sin resultado", total: inbox.llamadasDeHoy.length },
    { id: "sin-dueno", etiqueta: "Sin dueño", total: secciones.pendienteSetteo.length + secciones.unclaimed.length },
    { id: "perdidos", etiqueta: "Perdidos en Calendly", total: perdidos.length },
    { id: "sueltas", etiqueta: "Sueltas", total: inbox.llamadasSueltas.length },
    { id: "atencion", etiqueta: "Atención", total: inbox.atencion.length },
  ] as const;
  const seccionPedida = uno(query.seccion);
  const seccion = tabs.some((tab) => tab.id === seccionPedida)
    ? seccionPedida
    : (tabs.find((tab) => tab.total > 0)?.id ?? "sin-resultado");
  const origen = origenDeLaPagina(`/p/${programa.slug}/inbox`, query);
  const urlDeSeccion = (id: (typeof tabs)[number]["id"]) => {
    const u = new URLSearchParams();
    for (const [k, valor] of Object.entries(query)) {
      if (k === "seccion") continue;
      if (Array.isArray(valor)) valor.forEach((v) => u.append(k, v));
      else if (valor) u.set(k, valor);
    }
    u.set("seccion", id);
    return `/p/${programa.slug}/inbox?${u.toString()}`;
  };

  return (
    <PageShell titulo={programa.nombre} descripcion="Inbox" fija>
      <PantallaFija>
        {inbox.llamadasSinCloser.length > 0 ? (
          <div className="shrink-0">
            <HostsSinCuenta filas={inbox.llamadasSinCloser} />
          </div>
        ) : null}

        <div className="inline-flex max-w-full shrink-0 self-start overflow-x-auto rounded-full border bg-muted p-0.5 text-xs" role="group" aria-label="Sección del inbox">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={urlDeSeccion(tab.id)}
              aria-current={seccion === tab.id ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${seccion === tab.id ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {tab.etiqueta} · <span className="cifra">{num(tab.total)}</span>
            </Link>
          ))}
        </div>

        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
          {seccion === "sin-resultado" ? (
            <InboxLlamadasDeHoy
          llamadas={inbox.llamadasDeHoy}
          slug={programa.slug}
          puedeRegistrar={puedeTrabajar}
          motivosReagenda={motivosDeReagenda}
          origen={origen}
            />
          ) : null}
          {seccion === "sin-dueno" ? (
            <InboxSinDueno
          pendienteSetteo={secciones.pendienteSetteo}
          unclaimed={secciones.unclaimed}
          puedeReclamar={puedeTrabajar}
          administra={administra}
          duenos={duenos}
            />
          ) : null}
          {seccion === "perdidos" ? (
            <InboxPerdidosEnCalendly filas={perdidos} slug={programa.slug} origen={origen} />
          ) : null}
          {seccion === "sueltas" ? (
            <InboxLlamadasSueltas
          llamadas={inbox.llamadasSueltas}
          programId={programa.id}
          origen={origen}
            />
          ) : null}
          {seccion === "atencion" ? (
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
          ) : null}
        </div>
      </PantallaFija>
    </PageShell>
  );
}
