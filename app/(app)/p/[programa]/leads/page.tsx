import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import {
  CALIDADES_DE_LEAD,
  CAMPOS_DE_FECHA_DE_LEAD,
  LEADS_POR_PAGINA,
  leadsDelPrograma,
  posiblesDuplicadosDelPrograma,
  type FiltroLeads,
} from "@/lib/queries/leads";
import { fecha, fechaDeInstanteEnBogota, hoyEnBogota, num } from "@/lib/format";
import { filtroDeFechaDeLaUrl } from "@/lib/periodo";
import { FiltroFechaLista } from "@/components/filtro-fecha-lista";
import { BarraDeFiltros } from "@/components/filtros/barra-de-filtros";
import { FiltroSelect } from "@/components/filtros/filtro-select";
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

/** Las opciones del filtro de calidad (ADR 0069): lo que manda el formulario y la cubeta vacía. */
const CALIDADES = [
  { valor: "high", etiqueta: "High" },
  { valor: "mid", etiqueta: "Mid" },
  { valor: "low", etiqueta: "Low" },
  { valor: "sin_calidad", etiqueta: "Sin calidad" },
] as const satisfies readonly { valor: (typeof CALIDADES_DE_LEAD)[number]; etiqueta: string }[];

/** Las fechas que filtra la base de leads (ticket 141). */
const CAMPOS = [
  { valor: "creado", etiqueta: "Creado" },
  { valor: "ultimo_envio", etiqueta: "Último envío" },
] as const satisfies readonly { valor: (typeof CAMPOS_DE_FECHA_DE_LEAD)[number]; etiqueta: string }[];


/**
 * La tab Leads (ticket 072, ADR 0050): la base del programa, sobre todo lo que existe y todavía no
 * es una oportunidad. Filtros por hecho (deal, calidad, abandonó el formulario, posible duplicado,
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
  const calidad = CALIDADES_DE_LEAD.find((c) => c === uno(q.calidad)) ?? null;
  const filtroDeFecha = filtroDeFechaDeLaUrl(q, CAMPOS_DE_FECHA_DE_LEAD, hoyEnBogota());
  const pagina = Math.max(0, Number.parseInt(uno(q.pagina) ?? "0", 10) || 0);
  const filtro: FiltroLeads = {
    deal: deal === "con" || deal === "sin" ? deal : null,
    calidad,
    abandono: uno(q.abandono) === "1",
    duplicado: uno(q.duplicado) === "1",
    fecha: filtroDeFecha ? { campo: filtroDeFecha.campo, rango: filtroDeFecha.periodo.a } : null,
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
  return (
    <PageShell titulo={programa.nombre} descripcion="Leads">
      <div className="space-y-4">
        <FiltroFechaLista campos={CAMPOS} filtro={filtroDeFecha} />
        <BarraDeFiltros nombres={["deal", "calidad", "abandono", "duplicado"]}>
          <FiltroSelect nombre="deal" etiqueta="Deal" opciones={[{ value: "sin", label: "Sin deal" }, { value: "con", label: "Con deal" }]} />
          <FiltroSelect nombre="calidad" etiqueta="Calidad" todos="Todas" opciones={CALIDADES.map((c) => ({ value: c.valor, label: c.etiqueta }))} />
          <FiltroSelect nombre="abandono" etiqueta="Abandonó el formulario" todos="No" opciones={[{ value: "1", label: "Sí" }]} />
          <FiltroSelect nombre="duplicado" etiqueta="Posible duplicado" todos="No" opciones={[{ value: "1", label: "Sí" }]} />
        </BarraDeFiltros>

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
                        href={`/p/${programa.slug}/leads/${f.id}`}
                        className="block truncate font-medium text-marca-texto underline-offset-2 outline-none hover:underline focus-visible:underline"
                      >
                        {f.nombre ?? f.email}
                      </Link>
                      {f.nombre ? <p className="truncate text-xs text-muted-foreground">{f.email}</p> : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {f.leadQuality ? (
                          <Badge variant="neutro">{f.leadQuality}</Badge>
                        ) : (
                          <Badge variant="alerta" title="El formulario no mandó lead_quality: su deal entró en Registrado o Potencial.">
                            Sin calidad
                          </Badge>
                        )}
                        {f.tieneDeal ? <Badge variant="info">Con deal</Badge> : null}
                        {f.soloParciales ? <Badge variant="alerta">Abandonó el formulario</Badge> : null}
                        {f.correosSinConfirmar > 0 ? <Badge variant="alerta">Posible duplicado</Badge> : null}
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
          slug={programa.slug}
        />
      </div>
    </PageShell>
  );
}
