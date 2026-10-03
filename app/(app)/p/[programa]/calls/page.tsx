import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import { opcionesDeFicha } from "@/lib/queries/ficha-deal";
import { llamadasDelPrograma, opcionesDeLlamadas, type FiltroLlamadas } from "@/lib/queries/llamadas";
import { PageShell } from "@/components/page-shell";
import { LlamadasPrograma } from "@/components/deals/llamadas-programa";
import { InboxLlamadasSueltas } from "@/components/deals/inbox-llamadas-sueltas";
import { llamadasSueltasDelPrograma } from "@/lib/queries/inbox";
import { BarraDeFiltros } from "@/components/filtros/barra-de-filtros";
import { FiltroFecha } from "@/components/filtros/filtro-fecha";
import { FiltroSelect } from "@/components/filtros/filtro-select";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const RESULTADOS = [
  ["agendada", "Agendada"],
  ["show", "Show"],
  ["no_show", "No show"],
  ["cancelada", "Cancelada"],
  ["reagendada", "Reagendada"],
  ["compromiso_pago", "Compromiso de pago"],
  ["cerrada", "Cerrada"],
  ["perdida", "Perdida"],
] as const;

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CallsDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  const query = await searchParams;
  const resultado = uno(query.resultado);
  const filtro: FiltroLlamadas = {
    closerUserId: uno(query.closer) || null,
    resultado: RESULTADOS.some(([value]) => value === resultado)
      ? (resultado as FiltroLlamadas["resultado"])
      : null,
    desde: uno(query.desde) || null,
    hasta: uno(query.hasta) || null,
  };
  const [llamadas, opciones, opcionesFicha, sueltas] = await Promise.all([
    llamadasDelPrograma(db, programa.id, filtro),
    opcionesDeLlamadas(db, programa.id),
    opcionesDeFicha(db, programa.id, null, null),
    llamadasSueltasDelPrograma(db, programa.id, { userId: session.user.id, rol }),
  ]);

  return (
    <PageShell titulo={programa.nombre} descripcion="Calls">
      <div className="space-y-4">
        <BarraDeFiltros nombres={["closer", "resultado", "desde", "hasta"]}>
          <FiltroSelect nombre="closer" etiqueta="Closer" opciones={opciones.closers.map((closer) => ({ value: closer.id, label: closer.nombre }))} />
          <FiltroSelect nombre="resultado" etiqueta="Resultado" opciones={RESULTADOS.map(([value, label]) => ({ value, label }))} />
          <FiltroFecha nombre="desde" etiqueta="Desde" />
          <FiltroFecha nombre="hasta" etiqueta="Hasta" />
        </BarraDeFiltros>

        <LlamadasPrograma
          llamadas={llamadas.filter((llamada) => llamada.dealId != null)}
          programaSlug={programa.slug}
          opciones={opcionesFicha}
          mapa={mapaDeTransiciones()}
          nombreDeEtapa={NOMBRE_DE_ETAPA}
          puedeTrabajar={trabajaLeads(rol) || esAdministrador(rol)}
        />
        <InboxLlamadasSueltas
          llamadas={sueltas}
          programId={programa.id}
        />
      </div>
    </PageShell>
  );
}
