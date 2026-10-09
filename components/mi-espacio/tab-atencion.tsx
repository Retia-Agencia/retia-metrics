import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { motivos } from "@/lib/db/schema";
import type { Rol } from "@/lib/auth/roles";
import { esAdministrador, trabajaLeads } from "@/lib/auth/roles";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { plataformasDelPrograma } from "@/lib/catalogo/plataformas";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { inboxDelPrograma, type AlcanceInbox } from "@/lib/queries/inbox";
import { posiblesDuplicadosDelPrograma } from "@/lib/queries/leads";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { InboxLlamadasDeHoy } from "@/components/deals/inbox-llamadas-de-hoy";
import { InboxAtencion } from "@/components/deals/inbox-atencion";
import { PosiblesDuplicados } from "@/components/leads/posibles-duplicados";
import { novedadesCalendlyDeUsuario } from "@/lib/notificaciones-calendly/notificaciones";
import { NovedadesCalendly } from "./novedades-calendly";

/** Lo personal que necesita atención; importa las mismas preguntas del Inbox y Leads. */
export async function TabAtencion({
  programId,
  slug,
  userId,
  rol,
}: {
  programId: string;
  slug: string;
  userId: string;
  rol: Rol;
}) {
  const puedeRegistrar = trabajaLeads(rol);
  const administra = esAdministrador(rol);
  const alcance: AlcanceInbox = { ownerUserId: userId };

  const [novedades, inbox, plataformas, motivosFilas, areasFilas, duplicados] = await Promise.all([
    novedadesCalendlyDeUsuario(db, { userId, programId }),
    inboxDelPrograma(db, programId, alcance, undefined, undefined, { userId, rol }),
    plataformasDelPrograma(db, programId),
    db.select().from(motivos).where(eq(motivos.activo, true)),
    catalogoAreas(db).listar({ soloActivos: true }),
    // El closer ve solo los duplicados de SUS deals (186); administra, los del programa. Las 5 más
    // recientes, con "Ver todos" a la lista completa de Leads.
    posiblesDuplicadosDelPrograma(db, programId, { duenoUserId: administra ? undefined : userId, porPagina: 5 }),
  ]);

  const motivosDeReagenda = motivosFilas
    .map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const plataformasOpcion = plataformas.map((p) => ({ id: p.id, nombre: String(p.nombre) }));
  const origen = origenDeLaPagina("/mi-espacio", { programa: slug, tab: "notificaciones" });

  return (
    <div className="space-y-4">
      <NovedadesCalendly {...novedades} programId={programId} />
      <InboxLlamadasDeHoy llamadas={inbox.llamadasDeHoy} slug={slug} puedeRegistrar={puedeRegistrar} motivosReagenda={motivosDeReagenda} origen={origen} />
      <InboxAtencion
        filas={inbox.atencion}
        slug={slug}
        nombreDeEtapa={NOMBRE_DE_ETAPA}
        tonoDeEtapa={TONO_DE_ETAPA}
        plataformas={plataformasOpcion}
        areas={areasFilas.map((a) => ({ id: a.id, nombre: String(a.nombre) }))}
        puedeRegistrar={puedeRegistrar}
        origen={origen}
      />
      <PosiblesDuplicados
        filas={duplicados.filas.map((d) => ({
          contactoId: d.contactoId,
          leadId: d.leadId,
          nombreLead: d.nombreLead,
          correoPrincipal: d.correoPrincipal,
          correoSinConfirmar: d.correoSinConfirmar,
          puedeGestionar: administra || d.duenoUserId === userId,
        }))}
        total={duplicados.total}
        slug={slug}
        origen={origen}
        verTodosHref={`/p/${slug}/leads?duplicado=1`}
      />
    </div>
  );
}
