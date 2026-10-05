import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutList, Table2 } from "lucide-react";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import {
  CALIDADES_DE_LEAD,
  CAMPOS_DE_FECHA_DE_LEAD,
  DUPLICADOS_POR_PAGINA,
  LEADS_POR_PAGINA,
  leadsDelPrograma,
  posiblesDuplicadosDelPrograma,
  type FiltroLeads,
} from "@/lib/queries/leads";
import { fecha, fechaDeInstanteEnBogota, hoyEnBogota, num } from "@/lib/format";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { filtroDeFechaDeLaUrl } from "@/lib/periodo";
import { FiltroFechaLista } from "@/components/filtro-fecha-lista";
import { BarraDeFiltros } from "@/components/filtros/barra-de-filtros";
import { FiltroSelect } from "@/components/filtros/filtro-select";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas } from "@/components/layout/pestanas";
import { enlaceConVuelta, origenDeLaPagina } from "@/lib/navegacion/volver";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PosiblesDuplicados } from "@/components/leads/posibles-duplicados";
import { BuscadorDeLeads } from "@/components/leads/buscador-de-leads";

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
 * Los filtros y la vista viajan en la URL; el texto de búsqueda no, porque puede contener datos
 * personales (AGENTS.md). El alcance es el de Deals (ADR 0048).
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
  const paginaDup = Math.max(0, Number.parseInt(uno(q.pdup) ?? "0", 10) || 0);
  const vista = uno(q.vista) === "tabla" ? "tabla" : "tarjetas";
  const seccion = uno(q.seccion) === "duplicados" ? "duplicados" : "leads";
  const filtro: FiltroLeads = {
    deal: deal === "con" || deal === "sin" ? deal : null,
    calidad,
    abandono: uno(q.abandono) === "1",
    duplicado: uno(q.duplicado) === "1",
    fecha: filtroDeFecha ? { campo: filtroDeFecha.campo, rango: filtroDeFecha.periodo.a } : null,
    pagina,
  };
  // El closer ve solo los duplicados de SUS deals (186); quien administra, los del programa.
  const administra = esAdministrador(rol);
  const [{ total, filas }, duplicados] = await Promise.all([
    leadsDelPrograma(db, programa.id, filtro),
    posiblesDuplicadosDelPrograma(db, programa.id, {
      duenoUserId: administra ? undefined : session.user.id,
      pagina: paginaDup,
    }),
  ]);

  const paginas = Math.max(1, Math.ceil(total / LEADS_POR_PAGINA));
  const paginasDup = Math.max(1, Math.ceil(duplicados.total / DUPLICADOS_POR_PAGINA));
  // El origen de ESTA lista (con sus filtros y pagina): lo heredan los enlaces al detalle,
  // para que "Volver" devuelva a la lista tal como estaba (ticket 174).
  const origen = origenDeLaPagina(`/p/${programa.slug}/leads`, q);
  const urlCon = (cambios: Record<string, string | null>) => {
    const u = new URLSearchParams();
    for (const [k, valor] of Object.entries(q)) {
      if (k in cambios) continue;
      if (Array.isArray(valor)) valor.forEach((v) => u.append(k, v));
      else if (valor) u.set(k, valor);
    }
    for (const [k, valor] of Object.entries(cambios)) if (valor) u.set(k, valor);
    const s = u.toString();
    return `/p/${programa.slug}/leads${s ? `?${s}` : ""}`;
  };
  const conPagina = (p: number) => {
    return urlCon({ pagina: p > 0 ? String(p) : null });
  };
  return (
    <PageShell titulo={programa.nombre} descripcion="Leads" fija>
      <PantallaFija>
        <div className="shrink-0 space-y-4">
          <BuscadorDeLeads programaSlug={programa.slug} origen={origen} />
          <FiltroFechaLista campos={CAMPOS} filtro={filtroDeFecha} />
          <BarraDeFiltros nombres={["deal", "calidad", "abandono", "duplicado"]}>
            <FiltroSelect nombre="deal" etiqueta="Deal" opciones={[{ value: "sin", label: "Sin deal" }, { value: "con", label: "Con deal" }]} />
            <FiltroSelect nombre="calidad" etiqueta="Calidad" todos="Todas" opciones={CALIDADES.map((c) => ({ value: c.valor, label: c.etiqueta }))} />
            <FiltroSelect nombre="abandono" etiqueta="Abandonó el formulario" todos="No" opciones={[{ value: "1", label: "Sí" }]} />
            <FiltroSelect nombre="duplicado" etiqueta="Posible duplicado" todos="No" opciones={[{ value: "1", label: "Sí" }]} />
          </BarraDeFiltros>
        </div>

        <Pestanas
          activa={seccion}
          etiqueta="Sección de leads"
          grupos={[{
            pestanas: [
              {
                id: "leads",
                etiqueta: "Leads",
                total,
                descripcion: "Todas las personas que llegaron por el formulario o se crearon a mano.",
                href: urlCon({ seccion: null, pagina: null, pdup: null }),
              },
              {
                id: "duplicados",
                etiqueta: "Posibles duplicados",
                total: duplicados.total,
                descripcion: "Personas que podrían ser la misma. Confirma si lo son o sepáralas.",
                href: urlCon({ seccion: "duplicados", pagina: null, pdup: null }),
              },
            ],
          }]}
        />

        {seccion === "leads" ? (
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="shrink-0">
            <CardTitle className="text-base">
              Leads · <span className="cifra">{num(total)}</span>
            </CardTitle>
            <CardAction className="inline-flex rounded-full border bg-muted p-0.5 text-xs" role="group" aria-label="Vista de leads">
              <Link
                href={urlCon({ vista: null, pagina: null })}
                aria-current={vista === "tarjetas" ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${vista === "tarjetas" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <LayoutList aria-hidden className="size-3.5" /> Tarjetas
              </Link>
              <Link
                href={urlCon({ vista: "tabla", pagina: null })}
                aria-current={vista === "tabla" ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${vista === "tabla" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <Table2 aria-hidden className="size-3.5" /> Tabla
              </Link>
            </CardAction>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              <div className={clasesDeZonaConScroll("overflow-x-auto")}>
                {filas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay leads con estos filtros.</p>
                ) : vista === "tarjetas" ? (
                  <ul className="divide-y divide-border">
                {filas.map((f) => (
                  <li key={f.id} className="relative flex flex-wrap items-start justify-between gap-2 rounded-md px-2 py-3 text-sm hover:bg-muted/50">
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={enlaceConVuelta(`/p/${programa.slug}/leads/${f.id}`, origen)}
                        className="block truncate font-medium text-marca-texto underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {f.nombre ?? f.email}
                      </Link>
                      {f.nombre ? <p className="truncate text-xs text-muted-foreground">{f.email}</p> : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {f.leadQuality ? (
                          <Badge variant="neutro">{f.leadQuality}</Badge>
                        ) : (
                          <Badge variant="alerta" className="relative z-10" title="El formulario no mandó lead_quality: su deal entró en Registrado o Potencial.">
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
                ) : (
                  <table className="min-w-[56rem] w-full border-collapse whitespace-nowrap text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-2 py-1.5 font-medium">Nombre</th>
                      <th className="px-2 py-1.5 font-medium">Correo</th>
                      <th className="px-2 py-1.5 font-medium">Teléfono</th>
                      <th className="px-2 py-1.5 font-medium">Calidad</th>
                      <th className="px-2 py-1.5 font-medium">Etapa del deal</th>
                      <th className="px-2 py-1.5 font-medium">Canal</th>
                      <th className="px-2 py-1.5 font-medium">Último envío</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const href = enlaceConVuelta(`/p/${programa.slug}/leads/${f.id}`, origen);
                      const clase = "block px-2 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
                      return (
                        <tr key={f.id} className="cursor-pointer border-b hover:bg-muted/50">
                          <td><Link href={href} className={`${clase} font-medium text-marca-texto`}>{f.nombre ?? f.email}</Link></td>
                          <td><Link href={href} tabIndex={-1} className={clase}>{f.email}</Link></td>
                          <td><Link href={href} tabIndex={-1} className={`${clase} cifra`}>{f.telefono ?? "—"}</Link></td>
                          <td><Link href={href} tabIndex={-1} className={clase}>{f.leadQuality ?? "Sin calidad"}</Link></td>
                          <td><Link href={href} tabIndex={-1} className={clase}>{f.etapa ? NOMBRE_DE_ETAPA[f.etapa] : "Sin deal"}</Link></td>
                          <td><Link href={href} tabIndex={-1} className={clase}>{f.canal ?? "Sin UTM"}</Link></td>
                          <td>
                            <Link href={href} tabIndex={-1} className={`${clase} cifra`}>
                              {f.fechaUltimaAplicacion ? fecha(fechaDeInstanteEnBogota(f.fechaUltimaAplicacion)) : "—"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                )}
              </div>
              {paginas > 1 ? (
                <nav className="flex shrink-0 items-center justify-between pt-3 text-sm" aria-label="Páginas">
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
        ) : (
          <div className={clasesDeZonaConScroll()}>
            <PosiblesDuplicados
          filas={duplicados.filas.map((d) => ({
            contactoId: d.contactoId,
            leadId: d.leadId,
            nombreLead: d.nombreLead,
            correoPrincipal: d.correoPrincipal,
            correoSinConfirmar: d.correoSinConfirmar,
            puedeGestionar: administra || d.duenoUserId === session.user.id,
          }))}
          total={duplicados.total}
          slug={programa.slug}
          origen={origen}
          paginacion={{
            pagina: paginaDup,
            paginas: paginasDup,
            anteriorHref: paginaDup > 0 ? urlCon({ pdup: paginaDup > 1 ? String(paginaDup - 1) : null }) : null,
            siguienteHref: paginaDup + 1 < paginasDup ? urlCon({ pdup: String(paginaDup + 1) }) : null,
          }}
            />
          </div>
        )}
      </PantallaFija>
    </PageShell>
  );
}
