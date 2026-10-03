import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { aceptaAbono, ETAPAS_EN_ORDEN, NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import { puedeTrabajarDeal } from "@/lib/deals/permiso";
import { nombreDelDeal } from "@/lib/deals/nombre";
import { alertasDelDeal, fichaDeDeal, opcionesDeFicha } from "@/lib/queries/ficha-deal";
import { PageShell } from "@/components/page-shell";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { FichaAcciones } from "@/components/deals/ficha/ficha-acciones";
import { FichaTransicion } from "@/components/deals/ficha/ficha-transicion";
import { FichaActividades } from "@/components/deals/ficha/ficha-actividades";
import { FichaCabecera } from "@/components/deals/ficha/ficha-cabecera";
import { FichaHistorial } from "@/components/deals/ficha/ficha-historial";
import { FichaLlamadas } from "@/components/deals/ficha/ficha-llamadas";
import { FichaPago } from "@/components/deals/ficha/ficha-pago";
import { FichaOrigen } from "@/components/deals/ficha/ficha-origen";
import { FichaPerfil } from "@/components/deals/ficha/ficha-perfil";
import { FichaLead } from "@/components/deals/ficha/ficha-lead";
import { FichaAlertas } from "@/components/deals/ficha/ficha-alertas";
import { alcanceDeDeals, dealVisiblePara } from "@/lib/auth/alcance-deals";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ programa: string; id: string }> };

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La ficha de un deal (ticket 074): todo lo de una oportunidad en una pantalla, para que el
 * closer la trabaje sin navegar. Misma guarda y mismo alcance que el Kanban: `paginaConRol`,
 * `rolDeVista` y `programaVisiblePorSlug`.
 *
 * Un deal inexistente, de OTRO programa o de un programa que la sesion no ve responde 404,
 * igual que un slug inexistente: no se filtra que el deal existe (ADR 0048).
 *
 * Lo que se muestra como boton es proyeccion (dueño o administrador); la reja de verdad esta
 * en las funciones de `lib/deals/`, que rechazan igual una peticion forjada.
 */
export default async function FichaDelDealPage({ params }: Props) {
  const session = await paginaConRol("gerente", "closer");

  const { programa: slug, id } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !ES_UUID.test(id) || !esRolValido(rol)) notFound();

  const ficha = await fichaDeDeal(db, programa.id, id);
  if (!ficha) notFound();
  const alcanceDeals = await alcanceDeDeals(session);
  if (!dealVisiblePara(alcanceDeals, ficha.owner?.id ?? null)) notFound();
  const [opciones, alertas] = await Promise.all([
    opcionesDeFicha(db, programa.id, ficha.owner?.id ?? null, ficha.cohorte?.id ?? null),
    alertasDelDeal(db, programa.id, ficha.dealId),
  ]);

  const actor = { userId: session.user.id, rol };
  // Sobre un deal anulado nadie escribe: se ve, marcado, y ya.
  const puedeTrabajar = !ficha.anulado && puedeTrabajarDeal(actor, { ownerUserId: ficha.owner?.id ?? null });
  // Registrar llamadas y plata es trabajar el lead: el gerente administra pero no registra (ADR 0003).
  const puedeRegistrar = puedeTrabajar && trabajaLeads(rol);
  const cerrado = ficha.etapa === "ganado_completo" || ficha.etapa === "cierre_perdido";
  const nombre = nombreDelDeal({
    leadNombre: ficha.lead.nombre,
    leadEmail: ficha.lead.email,
    programaNombre: programa.nombre,
    cohorteCodigo: ficha.cohorte?.codigo ?? null,
  });

  return (
    <PageShell
      titulo={nombre}
      descripcion={`${programa.nombre} · Deal`}
      acciones={
        <FichaAcciones ficha={ficha} opciones={opciones} puedeTrabajar={puedeTrabajar} administra={esAdministrador(rol)} />
      }
    >
      <div className="space-y-4">
        <Link
          href={`/p/${programa.slug}/deals`}
          className="inline-block text-sm text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Volver a los deals
        </Link>

        <FichaCabecera
          ficha={ficha}
          nombre={nombre}
          programaSlug={programa.slug}
          nombreDeEtapa={NOMBRE_DE_ETAPA}
          tonoDeEtapa={TONO_DE_ETAPA}
        />
        <div className="space-y-4">
          <FichaAlertas alertas={alertas} />
          <FichaTransicion
            ficha={ficha}
            opciones={opciones}
            mapa={mapaDeTransiciones()}
            ordenDeEtapas={ETAPAS_EN_ORDEN}
            nombreDeEtapa={NOMBRE_DE_ETAPA}
            nombreDePendiente={NOMBRE_DE_PENDIENTE}
            tonoDeEtapa={TONO_DE_ETAPA}
            rutaDeLaFicha={`/p/${programa.slug}/deals/${ficha.dealId}`}
            puedeTrabajar={puedeTrabajar}
            alertas={alertas}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <FichaLead ficha={ficha} rutaDelLead={`/p/${programa.slug}/leads/${ficha.lead.id}`} />
            <FichaOrigen ficha={ficha} />
            <FichaPerfil perfil={ficha.perfil} />
            <FichaHistorial log={ficha.log} nombreDeEtapa={NOMBRE_DE_ETAPA} tonoDeEtapa={TONO_DE_ETAPA} />
          </div>
          <div className="space-y-4">
            <FichaLlamadas
              llamadas={ficha.llamadas}
              dealId={ficha.dealId}
              etapa={ficha.etapa}
              opciones={opciones}
              puedeRegistrar={puedeRegistrar && !cerrado}
            />
            <FichaActividades actividades={ficha.actividades} puedeRegistrar={puedeTrabajar} />
            <FichaPago
              ficha={ficha}
              opciones={opciones}
              puedeTrabajar={puedeTrabajar}
              puedeRegistrar={puedeRegistrar}
              aceptaAbono={aceptaAbono(ficha.etapa)}
              nombreDeEtapa={NOMBRE_DE_ETAPA}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
