import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { motivos } from "@/lib/db/schema";
import type { Rol } from "@/lib/auth/roles";
import { trabajaLeads } from "@/lib/auth/roles";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { plataformasDelPrograma } from "@/lib/catalogo/plataformas";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { inboxDelPrograma, type AlcanceInbox } from "@/lib/queries/inbox";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { InboxLlamadasDeHoy } from "@/components/deals/inbox-llamadas-de-hoy";
import { InboxAtencion } from "@/components/deals/inbox-atencion";

/**
 * Tab "Pendientes" de Mi espacio (ticket 172): lo MÍO que necesita atención en este
 * programa. Reusa el read model del Inbox (`inboxDelPrograma`) con el alcance del usuario
 * —solo sus deals, nunca el equipo (ADR 0075)— y los mismos componentes del Inbox
 * (`InboxLlamadasDeHoy`, `InboxAtencion`). Las secciones "sin dueño" NO son "lo mío", así
 * que no entran aquí; viven en el Inbox del programa.
 */
export async function TabPendientes({
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
  // Siempre "lo mío": Mi espacio es personal, nunca el equipo.
  const alcance: AlcanceInbox = { ownerUserId: userId };

  const [inbox, plataformas, motivosFilas, areasFilas] = await Promise.all([
    inboxDelPrograma(db, programId, alcance, undefined, undefined, { userId, rol }),
    plataformasDelPrograma(db, programId),
    db.select().from(motivos).where(eq(motivos.activo, true)),
    catalogoAreas(db).listar({ soloActivos: true }),
  ]);

  const motivosDeReagenda = motivosFilas
    .map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const plataformasOpcion = plataformas.map((p) => ({ id: p.id, nombre: String(p.nombre) }));
  // Mi espacio → Pendientes: la ficha vuelve a esta tab (ticket 174).
  const origen = origenDeLaPagina("/mi-espacio", { programa: slug, tab: "pendientes" });

  return (
    <div className="space-y-4">
      <InboxLlamadasDeHoy
        llamadas={inbox.llamadasDeHoy}
        slug={slug}
        puedeRegistrar={puedeRegistrar}
        motivosReagenda={motivosDeReagenda}
        origen={origen}
      />
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
    </div>
  );
}
