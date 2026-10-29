import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { nombreDeEtapa, vistaDeLista, urlDeLista } from "@/lib/queries/vista-metrica";
import { METRICAS_FOTO_DE_HOY, proyectarParaTablero, TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
import {
  BUCKETS_DE_ANTIGUEDAD,
  METRICAS_DE_EMBUDO_SIN_PERIODO,
  esMetricaDeEmbudo,
} from "@/lib/queries/embudo-con-filas";
import { PASOS_DE_CONVERSION } from "@/lib/queries/embudo-etapas";
import { ETAPAS_EN_ORDEN } from "@/lib/deals/etapas";
import { fecha, hoyEnBogota, monto, num } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { enlaceConVuelta, origenDeLaPagina } from "@/lib/navegacion/volver";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const esquema = z.object({
  metrica: z.enum([
    "caja",
    "agendas",
    "shows",
    "no_shows",
    "shows_sin_grain",
    "cierres",
    "cortesias",
    "leads",
    "deals_creados",
    "deals_que_agendaron",
    "agendas_creadas",
    "registros",
    "citas_debidas",
    "agendas_futuras",
    "contratado",
    "sin_resultado",
    "cartera",
    "atendidos_sin_valor",
    "atendidos_sin_grain",
    "grupo_citas",
    "grupo_shows",
    "grupo_vendidos",
    "grupo_sin_show",
    "grupo_pendientes",
    "etapa_entraron",
    "etapa_paso",
    "etapa_tiempo",
    "etapa_abiertos",
    "etapa_sin_dueno",
    "no_agendaron",
  ]),
  // Solo el embudo por etapas (ticket 188): el paso o la etapa, y el tramo de antigüedad.
  etapa: z.enum([...new Set([...ETAPAS_EN_ORDEN, ...PASOS_DE_CONVERSION])] as [string, ...string[]]).optional(),
  antiguedad: z.enum(BUCKETS_DE_ANTIGUEDAD as [string, ...string[]]).optional(),
  closer: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  moneda: z.string().regex(/^[A-Z]{3}$/).optional(),
  cohorte: z.string().uuid().optional().catch(undefined),
  pagina: z.string().regex(/^[1-9][0-9]{0,6}$/).transform(Number).pipe(z.number().max(1_000_000)).optional(),
  source: z.string().max(300).optional(),
  medium: z.string().max(300).optional(),
  categoria: z.enum(["con_utm", "sin_utm", "macro"]).optional(),
  area: z.enum(["paid", "organico", "referidos", "sin_utm"]).optional(),
  canal: z.string().max(300).optional(),
  orden: z.enum(["envio", "actividad"]).optional(),
});

const titulos = {
  caja: "Recaudado",
  agendas: "Agendas",
  shows: "Shows",
  no_shows: "No show",
  shows_sin_grain: "Shows sin Grain",
  cierres: "Cierres",
  cortesias: "Cortesías",
  leads: "Leads",
  deals_creados: "Deals creados",
  deals_que_agendaron: "Deals que agendaron",
  agendas_creadas: "Agendas creadas",
  registros: "Registros",
  citas_debidas: "Citas que ya debían ocurrir",
  agendas_futuras: "Agendas futuras",
  contratado: "Vendido",
  sin_resultado: "Llamadas pasadas sin resultado",
  cartera: "Por cobrar",
  atendidos_sin_valor: "Atendidos sin valor vendido",
  atendidos_sin_grain: "Atendidos sin Grain",
  grupo_citas: "Deals con cita ocurrida (grupo de las tasas)",
  grupo_shows: "Deals del grupo con show",
  grupo_vendidos: "Deals del grupo con show y vendidos hoy",
  grupo_sin_show: "Deals del grupo sin show",
  grupo_pendientes: "Citas pasadas sin resultado",
  etapa_entraron: "Entraron al embudo",
  etapa_paso: "Llegaron al paso",
  etapa_tiempo: "Salieron de la etapa",
  etapa_abiertos: "Abiertos en la etapa",
  etapa_sin_dueno: "Abiertos sin dueño",
  no_agendaron: "No agendaron",
};

/** Qué subconjunto exige cada métrica del embudo: sin él, la lista no existe. */
const SUBCONJUNTO_DEL_EMBUDO = {
  etapa_entraron: null,
  etapa_paso: "etapa",
  etapa_tiempo: "etapa",
  etapa_abiertos: "etapa",
  etapa_sin_dueno: "antiguedad",
} as const;

/** El tono de la antigüedad (GC-35): de lo más nuevo a lo más viejo, con los tonos de Tinta. */
const TONO_DE_ANTIGUEDAD = {
  "0-7": "neutro",
  "8-30": "info",
  "31-90": "alerta",
  ">90": "peligro",
} as const;

function tonoDeAntiguedad(bucket: string) {
  return TONO_DE_ANTIGUEDAD[bucket as keyof typeof TONO_DE_ANTIGUEDAD] ?? "neutro";
}

export default async function ListaDeCifraPage({ params, searchParams }: Props) {
  // Las listas comerciales siguen reservadas a quien administra. Las dos cifras de Origen
  // abren con la capacidad del tablero para que Pauta las audite; abajo se proyectan fuera
  // persona, closer y deal antes de renderizar. Por capacidad, nunca `rol === "..."`.
  const busqueda = await searchParams;
  const validado = esquema.safeParse(busqueda);
  if (!validado.success) notFound();
  const esListaDeOrigen = validado.data.metrica === "registros" || validado.data.metrica === "agendas_creadas";
  const capacidad = esListaDeOrigen
    ? veTableroDelPrograma
    : validado.data.metrica === "no_agendaron"
      ? veEquipoComercial
      : esAdministrador;
  const session = await paginaConCapacidad(capacidad);
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const esAdmin = esAdministrador(rol);
  const veEquipo = veEquipoComercial(rol);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();
  const { metrica, closer, moneda, cohorte, etapa, antiguedad, pagina = 1, source, medium, categoria, area, canal, orden } = validado.data;
  const sourceNormalizado = source === "__null__" ? null : source;
  const mediumNormalizado = medium === "__null__" ? null : medium;
  const canalNormalizado = canal === "__null__" ? null : canal;
  if (!esListaDeOrigen && (source !== undefined || medium !== undefined || categoria !== undefined || area !== undefined || canal !== undefined)) notFound();
  if (esListaDeOrigen && !esAdmin && closer !== undefined) notFound();
  if (metrica !== "no_agendaron" && orden !== undefined) notFound();
  if (moneda && metrica !== "caja") notFound();
  // El subconjunto es del embudo por etapas y solo el que su métrica pide: un paso en otra lista,
  // o una lista del embudo sin su paso, no existe (nunca cae al embudo entero).
  const pide = esMetricaDeEmbudo(metrica) ? SUBCONJUNTO_DEL_EMBUDO[metrica] : null;
  if ((pide === "etapa") !== (etapa !== undefined) || (pide === "antiguedad") !== (antiguedad !== undefined)) notFound();
  const vista = await vistaDeLista({
    programId: programa.id,
    metrica,
    busqueda,
    hoy: hoyEnBogota(),
    codigoCloser: closer,
    moneda,
    cohorteId: cohorte,
    etapa,
    antiguedad,
    source: sourceNormalizado,
    medium: mediumNormalizado,
    categoria,
    orden,
    area,
    canal: canalNormalizado,
    pagina,
  });
  if (!vista) notFound();
  const { periodo, claveCloser } = vista;
  const lista = proyectarParaTablero(vista.lista, metrica === "no_agendaron" ? veEquipo : esAdmin);
  const desde = typeof busqueda.desde === "string" ? busqueda.desde : undefined;
  const enlace = urlDeLista({
    slug,
    metrica,
    periodo,
    origen: desde ?? `/p/${slug}/hub`,
    claveCloser,
    moneda,
    cohorteId: cohorte,
    subconjunto: { etapa, antiguedad },
    filtrosDeOrigen: { source: sourceNormalizado, medium: mediumNormalizado, categoria, area, canal: canalNormalizado },
  });
  // La cartera, las banderas del Pulso (191) y los abiertos del embudo son una foto de hoy:
  // el periodo no los acota.
  const sinPeriodo = (METRICAS_FOTO_DE_HOY as readonly string[]).includes(metrica)
    || (METRICAS_DE_EMBUDO_SIN_PERIODO as readonly string[]).includes(metrica);
  const subtitulo = etapa ? (etapa === "vendido" ? "Vendido" : nombreDeEtapa(etapa)) : antiguedad ? `${antiguedad} días` : null;
  // El `desde` de donde se abrió esta lista (ticket 174, 197): va al "Volver" de la
  // cabecera y se conserva en los enlaces de paginación, siempre por `enlaceConVuelta`.
  const enlaceDePagina = orden ? `${enlace}&orden=${orden}` : enlace;
  const enlaceOrdenado = (campo: "envio" | "actividad") => `${enlace}&orden=${campo}`;
  // La etiqueta visible del closer filtrado sale de los grupos (nunca la clave
  // interna, que puede ser un uuid o `historico:...`): todas las filas del filtro
  // comparten closer. Sin filtro, "Todos los closers".
  const etiquetaCloser = claveCloser
    ? (lista.grupos.find((g) => g.closer)?.closer ?? "Sin closer")
    : "Todos los closers";
  // El origen de ESTA lista para "Ver deal" (ticket 174).
  const origen = origenDeLaPagina(`/p/${slug}/hub/lista`, busqueda);
  return (
    <PageShell
      titulo={titulos[metrica]}
      descripcion={programa.nombre}
      volver={{ desde, porDefecto: { href: `/p/${slug}/hub`, etiqueta: "Hub" } }}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{programa.nombre}</Badge>
          <Badge variant="secondary">{titulos[metrica]}</Badge>
          {subtitulo ? <Badge variant="secondary">{subtitulo}</Badge> : null}
          {sinPeriodo ? (
            <Badge variant="secondary">Foto de hoy, sin periodo</Badge>
          ) : (
            <>
              <Badge variant="secondary">Periodo: {fecha(periodo.a.desde)} a {fecha(periodo.a.hasta)}</Badge>
              {periodo.b ? <Badge variant="secondary">Comparación: {fecha(periodo.b.desde)} a {fecha(periodo.b.hasta)}</Badge> : null}
            </>
          )}
          <Badge variant="secondary">{etiquetaCloser}</Badge>
          {moneda ? <Badge variant="secondary">{moneda}</Badge> : null}
          {cohorte ? <Badge variant="secondary">Cohorte filtrada</Badge> : null}
        </div>
        {periodo.aviso ? <p role="status" className="text-sm text-muted-foreground">{periodo.aviso}</p> : null}
        <p className="cifra">{lista.disponible ? num(lista.subtotal.cantidad) : "—"} {metrica === "no_agendaron" ? "personas" : "registros"}</p>
        {lista.subtotal.caja.map((c) => <p className="cifra" key={c.moneda}>{monto(c.total, c.moneda)}</p>)}
        <p className="text-sm text-muted-foreground">
          Más antiguos primero. Antigüedad en días calendario de Bogotá; fechas futuras: 0 días.
          {esMetricaDeEmbudo(metrica) ? " En el embudo por etapas, la fecha es la entrada del deal al embudo." : null}
        </p>
        <Card>
          <CardContent className="overflow-x-auto pt-4">
            {lista.filas.length === 0 ? <p>No hay filas en esta página para los filtros elegidos.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left">{veEquipo ? <th>Persona</th> : null}{veEquipo ? <th>Closer</th> : null}<th>Etapa</th><th>{metrica === "no_agendaron" ? <Link className="underline underline-offset-2" href={enlaceOrdenado("envio")}>Fecha de envío</Link> : "Fecha"}</th><th>Días</th>{metrica === "no_agendaron" ? <th><Link className="underline underline-offset-2" href={enlaceOrdenado("actividad")}>Última actividad</Link></th> : <th>Monto</th>}{veEquipo ? <th>Deal</th> : null}</tr></thead>
                <tbody className="divide-y">
                  {lista.filas.map((fila) => (
                    <tr key={fila.id}>
                      {veEquipo ? <td className="py-3">{fila.persona ? <Link className="underline underline-offset-2" href={enlaceConVuelta(fila.dealId ? `/p/${encodeURIComponent(slug)}/deals/${fila.dealId}` : `/p/${encodeURIComponent(slug)}/leads/${fila.persona.leadId}`, origen)}>{fila.persona.nombre ?? "Sin nombre"}</Link> : "Sin nombre"}</td> : null}
                      {/* Sin acceso al equipo (`registros` para Pauta), closer y deal llegan proyectados a nulo: no se pintan. */}
                      {veEquipo ? <td>{fila.closer || "Sin closer"}</td> : null}
                      <td>{fila.etapa ? nombreDeEtapa(fila.etapa) : "Sin deal"}</td>
                      <td className="py-3">{fecha(fila.fecha)}</td>
                      <td><Badge variant={tonoDeAntiguedad(fila.bucket)} className="cifra">{num(fila.antiguedad)}</Badge></td>
                      <td>
                        <span className="cifra">{metrica === "no_agendaron" ? (fila.ultimaActividad ? fecha(fila.ultimaActividad) : "—") : fila.moneda && fila.monto !== null ? monto(fila.monto, fila.moneda) : "—"}</span>
                        {fila.concepto === "adicional" ? <span className="block text-xs">Adicional{fila.nota ? `: ${fila.nota}` : ""}</span> : null}
                      </td>
                      {veEquipo ? <td>{fila.dealId ? <Button variant="link" nativeButton={false} render={<Link href={enlaceConVuelta(`/p/${encodeURIComponent(slug)}/deals/${fila.dealId}`, origen)} />}>Ver deal</Button> : "Sin deal"}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <nav aria-label="Paginación" className="flex items-center gap-3">
          {pagina > 1 ? <Button variant="outline" nativeButton={false} render={<Link href={`${enlaceDePagina}&pagina=${pagina - 1}`} />}>Anterior</Button> : <Button variant="outline" disabled>Anterior</Button>}
          <span className="cifra">Página {num(pagina)}</span>
          {pagina * TAMANO_PAGINA < lista.subtotal.cantidad ? <Button variant="outline" nativeButton={false} render={<Link href={`${enlaceDePagina}&pagina=${pagina + 1}`} />}>Siguiente</Button> : <Button variant="outline" disabled>Siguiente</Button>}
        </nav>
      </div>
    </PageShell>
  );
}
