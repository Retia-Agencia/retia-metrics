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
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, pestanaActiva, urlConSeccion, type GrupoDePestanas } from "@/components/layout/pestanas";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { InboxAgendadosSinDueno, InboxPorSettear } from "@/components/deals/inbox-sin-dueno";
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

const ID_ANTERIOR_DE_SECCION: Record<string, string> = {
  "sin-resultado": "por-registrar",
  sueltas: "sin-deal",
  "sin-dueno": "agendados-sin-dueno",
  perdidos: "no-agendaron",
  atencion: "necesitan-accion",
};

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
 * ## Orden de las pestañas (reunión con closers, 24-sep; tickets 185 y 193)
 *  1. Llamadas: Por registrar y Sin deal.
 *  2. Deals: Agendados sin dueño, Por settear, No agendaron y Necesitan acción.
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
  const base = `/p/${programa.slug}/inbox`;
  const grupos: GrupoDePestanas[] = [
    {
      titulo: "Llamadas",
      pestanas: [
        {
          id: "por-registrar",
          etiqueta: "Por registrar",
          total: inbox.llamadasDeHoy.length,
          descripcion: "Llamadas que ya pasaron y nadie registró qué pasó. Registra si hubo show, si se reagendó o si se cayó.",
          href: urlConSeccion(base, query, "por-registrar"),
        },
        {
          id: "sin-deal",
          etiqueta: "Sin deal",
          total: inbox.llamadasSueltas.length,
          descripcion: "Citas de Calendly que no se pudieron unir a un deal solas. Elige a qué deal pertenecen.",
          href: urlConSeccion(base, query, "sin-deal"),
        },
      ],
    },
    {
      titulo: "Deals",
      pestanas: [
        {
          id: "agendados-sin-dueno",
          etiqueta: "Agendados sin dueño",
          total: secciones.unclaimed.length,
          descripcion: "Deals con una cita ya agendada y sin closer. Lo más viejo primero.",
          href: urlConSeccion(base, query, "agendados-sin-dueno"),
        },
        {
          id: "por-settear",
          etiqueta: "Por settear",
          total: secciones.pendienteSetteo.length,
          descripcion: "Deals sin closer que todavía no agendan. Reclámalos, del puntaje más alto al más bajo.",
          href: urlConSeccion(base, query, "por-settear"),
        },
        {
          id: "no-agendaron",
          etiqueta: "No agendaron",
          total: perdidos.length,
          descripcion: "Leads calificados que abrieron Calendly y no terminaron de agendar hace más de 5 minutos.",
          href: urlConSeccion(base, query, "no-agendaron"),
        },
        {
          id: "necesitan-accion",
          etiqueta: "Necesitan acción",
          total: inbox.atencion.length,
          descripcion: "Deals con un pago o un compromiso vencido, sin actividad o con los intentos agotados.",
          href: urlConSeccion(base, query, "necesitan-accion"),
        },
      ],
    },
  ];
  const pestanas = grupos.flatMap((grupo) => grupo.pestanas);
  const seccionPedida = uno(query.seccion);
  const seccion = pestanaActiva(seccionPedida ? (ID_ANTERIOR_DE_SECCION[seccionPedida] ?? seccionPedida) : undefined, pestanas);
  const origen = origenDeLaPagina(`/p/${programa.slug}/inbox`, query);

  return (
    <PageShell titulo={programa.nombre} descripcion="Inbox" fija>
      <PantallaFija>
        {inbox.llamadasSinCloser.length > 0 ? (
          <div className="shrink-0 md:max-h-40 md:overflow-y-auto">
            <HostsSinCuenta filas={inbox.llamadasSinCloser} />
          </div>
        ) : null}

        <Pestanas grupos={grupos} activa={seccion} etiqueta="Sección del inbox" />

        <div className={clasesDeZonaConScroll()}>
          {seccion === "por-registrar" ? (
            <InboxLlamadasDeHoy
          llamadas={inbox.llamadasDeHoy}
          slug={programa.slug}
          puedeRegistrar={puedeTrabajar}
          motivosReagenda={motivosDeReagenda}
          origen={origen}
            />
          ) : null}
          {seccion === "sin-deal" ? (
            <InboxLlamadasSueltas
          llamadas={inbox.llamadasSueltas}
          programId={programa.id}
          origen={origen}
            />
          ) : null}
          {seccion === "agendados-sin-dueno" ? (
            <InboxAgendadosSinDueno
              filas={secciones.unclaimed}
              puedeReclamar={puedeTrabajar}
              administra={administra}
              duenos={duenos}
            />
          ) : null}
          {seccion === "por-settear" ? (
            <InboxPorSettear
              filas={secciones.pendienteSetteo}
              programId={programa.id}
              puedeReclamar={puedeTrabajar}
              administra={administra}
              duenos={duenos}
            />
          ) : null}
          {seccion === "no-agendaron" ? (
            <InboxPerdidosEnCalendly filas={perdidos} slug={programa.slug} origen={origen} />
          ) : null}
          {seccion === "necesitan-accion" ? (
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
