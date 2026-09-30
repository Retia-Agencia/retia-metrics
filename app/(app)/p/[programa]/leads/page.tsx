import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import {
  ESTADOS_DE_LEAD,
  LEADS_POR_PAGINA,
  leadsDelPrograma,
  posiblesDuplicadosDelPrograma,
  type FiltroLeads,
} from "@/lib/queries/leads";
import { fecha, fechaDeInstanteEnBogota, num } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PosiblesDuplicados } from "@/components/leads/posibles-duplicados";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const NOMBRE_DE_ESTADO: Record<string, string> = {
  descartado: "Descartado",
  setteo_no_calificado: "Setteo no calificado",
  con_calendly: "Con Calendly",
  sin_estado: "Sin estado",
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La tab Leads (ticket 072, ADR 0050): la base del programa, sobre todo lo que existe y todavía no
 * es una oportunidad. Filtros por hecho (deal, estado, abandonó el formulario, posible duplicado,
 * fechas) y la lista de posibles duplicados con confirmar o separar.
 *
 * Los filtros viajan en la URL y ninguno es un dato personal (AGENTS.md): no hay búsqueda por
 * texto aquí; para buscar a alguien está Personas. El alcance es el de Deals (ADR 0048).
 */
export default async function LeadsDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  const q = await searchParams;
  const deal = uno(q.deal);
  const estado = uno(q.estado);
  const desde = uno(q.desde);
  const hasta = uno(q.hasta);
  const pagina = Math.max(0, Number.parseInt(uno(q.pagina) ?? "0", 10) || 0);
  const filtro: FiltroLeads = {
    deal: deal === "con" || deal === "sin" ? deal : null,
    estado: estado === "sin_estado" || (ESTADOS_DE_LEAD as readonly string[]).includes(estado ?? "") ? (estado as FiltroLeads["estado"]) : null,
    abandono: uno(q.abandono) === "1",
    duplicado: uno(q.duplicado) === "1",
    desde: desde && DIA.test(desde) ? desde : null,
    hasta: hasta && DIA.test(hasta) ? hasta : null,
    pagina,
  };
  const [{ total, filas }, duplicados] = await Promise.all([
    leadsDelPrograma(db, programa.id, filtro),
    posiblesDuplicadosDelPrograma(db, programa.id),
  ]);

  const paginas = Math.max(1, Math.ceil(total / LEADS_POR_PAGINA));
  const conPagina = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (k !== "pagina" && typeof v === "string" && v) u.set(k, v);
    if (p > 0) u.set("pagina", String(p));
    const s = u.toString();
    return `/p/${programa.slug}/leads${s ? `?${s}` : ""}`;
  };
  const control =
    "h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <PageShell titulo={programa.nombre} descripcion="Leads">
      <div className="space-y-4">
        <form className="grid gap-3 rounded-xl bg-card p-4 shadow-tarjeta sm:grid-cols-3 lg:grid-cols-6" method="get">
          <label className="grid gap-1 text-sm">
            Deal
            <select name="deal" defaultValue={filtro.deal ?? ""} className={control}>
              <option value="">Todos</option>
              <option value="sin">Sin deal</option>
              <option value="con">Con deal</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Estado
            <select name="estado" defaultValue={filtro.estado ?? ""} className={control}>
              <option value="">Todos</option>
              {[...ESTADOS_DE_LEAD, "sin_estado"].map((e) => (
                <option key={e} value={e}>
                  {NOMBRE_DE_ESTADO[e] ?? e}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Desde
            <input type="date" name="desde" defaultValue={filtro.desde ?? ""} className={control} />
          </label>
          <label className="grid gap-1 text-sm">
            Hasta
            <input type="date" name="hasta" defaultValue={filtro.hasta ?? ""} className={control} />
          </label>
          <div className="grid content-end gap-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="abandono" value="1" defaultChecked={filtro.abandono} className="size-4 accent-primary" />
              Abandonó el formulario
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="duplicado" value="1" defaultChecked={filtro.duplicado} className="size-4 accent-primary" />
              Posible duplicado
            </label>
          </div>
          <div className="flex items-end">
            <button
              className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-colors duration-150 hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
              type="submit"
            >
              Filtrar
            </button>
          </div>
        </form>
        {(filtro.desde && !filtro.hasta) || (!filtro.desde && filtro.hasta) ? (
          <p className="text-xs text-muted-foreground">El filtro de fechas necesita desde y hasta.</p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Leads · <span className="cifra">{num(total)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay leads con estos filtros.</p>
            ) : (
              <ul className="divide-y divide-border">
                {filas.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={`/personas/${f.id}`}
                        className="block truncate font-medium text-marca-texto underline-offset-2 outline-none hover:underline focus-visible:underline"
                      >
                        {f.nombre ?? f.email}
                      </Link>
                      {f.nombre ? <p className="truncate text-xs text-muted-foreground">{f.email}</p> : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={f.calificacion ? "neutro" : "alerta"}>{NOMBRE_DE_ESTADO[f.calificacion ?? "sin_estado"]}</Badge>
                        {f.tieneDeal ? <Badge variant="info">Con deal</Badge> : null}
                        {f.soloParciales ? <Badge variant="alerta">Abandonó el formulario</Badge> : null}
                        {f.correosSinConfirmar > 0 ? <Badge variant="alerta">Posible duplicado</Badge> : null}
                        {f.leadQuality ? <Badge variant="secondary">{f.leadQuality}</Badge> : null}
                        {f.leadValue ? <Badge variant="secondary">{f.leadValue}</Badge> : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {f.fechaUltimaAplicacion ? <p>{fecha(fechaDeInstanteEnBogota(f.fechaUltimaAplicacion))}</p> : null}
                      <p>
                        <span className="cifra">{num(f.numAplicaciones)}</span> {f.numAplicaciones === 1 ? "aplicación" : "aplicaciones"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {paginas > 1 ? (
              <nav className="flex items-center justify-between pt-3 text-sm" aria-label="Páginas">
                {pagina > 0 ? (
                  <Link href={conPagina(pagina - 1)} className="text-marca-texto underline-offset-2 hover:underline">
                    Anterior
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  Página <span className="cifra">{num(pagina + 1)}</span> de <span className="cifra">{num(paginas)}</span>
                </span>
                {pagina + 1 < paginas ? (
                  <Link href={conPagina(pagina + 1)} className="text-marca-texto underline-offset-2 hover:underline">
                    Siguiente
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </CardContent>
        </Card>

        <PosiblesDuplicados
          filas={duplicados.map((d) => ({
            contactoId: d.contactoId,
            leadId: d.leadId,
            nombreLead: d.nombreLead,
            correoPrincipal: d.correoPrincipal,
            correoSinConfirmar: d.correoSinConfirmar,
          }))}
          puedeGestionar={trabajaLeads(rol) || esAdministrador(rol)}
        />
      </div>
    </PageShell>
  );
}
