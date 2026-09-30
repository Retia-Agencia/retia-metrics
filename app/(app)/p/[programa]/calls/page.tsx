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
  const [llamadas, opciones, opcionesFicha] = await Promise.all([
    llamadasDelPrograma(db, programa.id, filtro),
    opcionesDeLlamadas(db, programa.id),
    opcionesDeFicha(db, programa.id, null),
  ]);
  const sueltas = llamadas
    .filter((c) => c.porAsignar)
    .map((c) => ({
      callId: c.callId,
      dealId: null,
      leadNombre: c.leadNombre,
      leadEmail: c.leadEmail,
      fechaAgenda: c.fechaAgenda,
      linkCalendly: c.linkCalendly,
      ownerNombre: null,
    }));

  return (
    <PageShell titulo={programa.nombre} descripcion="Calls">
      <div className="space-y-4">
        <form className="grid gap-3 rounded-xl bg-card p-4 shadow-tarjeta sm:grid-cols-4" method="get">
          <label className="grid gap-1 text-sm">
            Closer
            <select name="closer" defaultValue={filtro.closerUserId ?? ""} className="h-9 rounded-lg border border-input bg-background px-2">
              <option value="">Todos</option>
              {opciones.closers.map((closer) => <option key={closer.id} value={closer.id}>{closer.nombre}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Resultado
            <select name="resultado" defaultValue={filtro.resultado ?? ""} className="h-9 rounded-lg border border-input bg-background px-2">
              <option value="">Todos</option>
              {RESULTADOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">Desde<input type="date" name="desde" defaultValue={filtro.desde ?? ""} className="h-9 rounded-lg border border-input bg-background px-2" /></label>
          <label className="grid gap-1 text-sm">Hasta<input type="date" name="hasta" defaultValue={filtro.hasta ?? ""} className="h-9 rounded-lg border border-input bg-background px-2" /></label>
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground sm:col-span-4 sm:w-fit" type="submit">Filtrar llamadas</button>
        </form>

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
          puedeAsignar={trabajaLeads(rol)}
        />
      </div>
    </PageShell>
  );
}
