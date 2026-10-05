import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { nombreDeEtapa, vistaDeLista, urlDeLista } from "@/lib/queries/vista-metrica";
import { TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
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
    "agendas_creadas",
    "agendas_futuras",
    "contratado",
    "sin_resultado",
    "cartera",
    "grupo_citas",
    "grupo_shows",
    "grupo_vendidos",
    "grupo_sin_show",
    "etapa_entraron",
    "etapa_paso",
    "etapa_tiempo",
    "etapa_abiertos",
    "etapa_sin_dueno",
  ]),
  // Solo el embudo por etapas (ticket 188): el paso o la etapa, y el tramo de antigüedad.
  etapa: z.enum([...new Set([...ETAPAS_EN_ORDEN, ...PASOS_DE_CONVERSION])] as [string, ...string[]]).optional(),
  antiguedad: z.enum(BUCKETS_DE_ANTIGUEDAD as [string, ...string[]]).optional(),
  closer: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  moneda: z.string().regex(/^[A-Z]{3}$/).optional(),
  cohorte: z.string().uuid().optional().catch(undefined),
  pagina: z.string().regex(/^[1-9][0-9]{0,6}$/).transform(Number).pipe(z.number().max(1_000_000)).optional(),
});

const titulos = {
  caja: "Caja recaudada",
  agendas: "Agendas",
  shows: "Shows",
  no_shows: "No show",
  shows_sin_grain: "Shows sin Grain",
  cierres: "Cierres",
  cortesias: "Cortesías",
  leads: "Leads",
  deals_creados: "Deals creados",
  agendas_creadas: "Agendas creadas",
  agendas_futuras: "Agendas futuras",
  contratado: "Contratado",
  sin_resultado: "Llamadas pasadas sin resultado",
  cartera: "Cartera",
  grupo_citas: "Deals con cita ocurrida (grupo de las tasas)",
  grupo_shows: "Deals del grupo con show",
  grupo_vendidos: "Deals del grupo con show y vendidos hoy",
  grupo_sin_show: "Deals del grupo sin show",
  etapa_entraron: "Entraron al embudo",
  etapa_paso: "Llegaron al paso",
  etapa_tiempo: "Salieron de la etapa",
  etapa_abiertos: "Abiertos en la etapa",
  etapa_sin_dueno: "Abiertos sin dueño",
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
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();
  const busqueda = await searchParams;
  const validado = esquema.safeParse(busqueda);
  if (!validado.success) notFound();
  const { metrica, closer, moneda, cohorte, etapa, antiguedad, pagina = 1 } = validado.data;
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
    pagina,
  });
  if (!vista) notFound();
  const { lista, periodo, claveCloser } = vista;
  const enlace = urlDeLista(slug, metrica, periodo, claveCloser, moneda, cohorte, { etapa, antiguedad });
  // La cartera y los abiertos del embudo son una foto de hoy: el periodo no los acota.
  const sinPeriodo = metrica === "cartera" || (METRICAS_DE_EMBUDO_SIN_PERIODO as readonly string[]).includes(metrica);
  const subtitulo = etapa ? (etapa === "vendido" ? "Vendido" : nombreDeEtapa(etapa)) : antiguedad ? `${antiguedad} días` : null;
  // El `desde` de donde se abrió esta lista (ticket 174, 197): va al "Volver" de la
  // cabecera y se conserva en los enlaces de paginación, siempre por `enlaceConVuelta`.
  const desde = typeof busqueda.desde === "string" ? busqueda.desde : undefined;
  const conVuelta = (href: string) => (desde ? enlaceConVuelta(href, desde) : href);
  // La etiqueta visible del closer filtrado sale de los grupos (nunca la clave
  // interna, que puede ser un uuid o `historico:...`): todas las filas del filtro
  // comparten closer. Sin filtro, "Todos los closers".
  const etiquetaCloser = claveCloser
    ? (lista.grupos.find((g) => g.closer)?.closer ?? "Sin closer")
    : "Todos los closers";
  // El origen de ESTA lista para "Ver deal" (ticket 174).
  const origen = origenDeLaPagina(`/p/${slug}/dashboard/lista`, busqueda);
  return (
    <PageShell
      titulo={titulos[metrica]}
      descripcion={programa.nombre}
      volver={{ desde, porDefecto: { href: `/p/${slug}/dashboard`, etiqueta: "Dashboard" } }}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{programa.nombre}</Badge>
          <Badge variant="secondary">{titulos[metrica]}</Badge>
          {subtitulo ? <Badge variant="secondary">{subtitulo}</Badge> : null}
          {sinPeriodo ? (
            <Badge variant="secondary">A hoy, sin periodo</Badge>
          ) : (
            <>
              <Badge variant="secondary">A: {fecha(periodo.a.desde)} a {fecha(periodo.a.hasta)}</Badge>
              {periodo.b ? <Badge variant="secondary">B: {fecha(periodo.b.desde)} a {fecha(periodo.b.hasta)}</Badge> : null}
            </>
          )}
          <Badge variant="secondary">{etiquetaCloser}</Badge>
          {moneda ? <Badge variant="secondary">{moneda}</Badge> : null}
          {cohorte ? <Badge variant="secondary">Cohorte filtrada</Badge> : null}
        </div>
        {periodo.aviso ? <p role="status" className="text-sm text-muted-foreground">{periodo.aviso}</p> : null}
        <p className="cifra">{lista.disponible ? num(lista.subtotal.cantidad) : "—"} registros</p>
        {lista.subtotal.caja.map((c) => <p className="cifra" key={c.moneda}>{monto(c.total, c.moneda)}</p>)}
        <p className="text-sm text-muted-foreground">
          Más antiguos primero. Antigüedad en días calendario de Bogotá; fechas futuras: 0 días.
          {esMetricaDeEmbudo(metrica) ? " En el embudo por etapas, la fecha es la entrada del deal al embudo." : null}
        </p>
        <Card>
          <CardContent className="overflow-x-auto pt-4">
            {lista.filas.length === 0 ? <p>No hay filas en esta página para los filtros elegidos.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left"><th>Closer</th><th>Etapa</th><th>Fecha</th><th>Días</th><th>Monto</th><th>Deal</th></tr></thead>
                <tbody className="divide-y">
                  {lista.filas.map((fila) => (
                    <tr key={fila.id}>
                      <td className="py-3">{fila.closer || "Sin closer"}</td>
                      <td>{fila.etapa ? nombreDeEtapa(fila.etapa) : "Sin deal"}</td>
                      <td>{fecha(fila.fecha)}</td>
                      <td><Badge variant={tonoDeAntiguedad(fila.bucket)} className="cifra">{num(fila.antiguedad)}</Badge></td>
                      <td className="cifra">{fila.moneda && fila.monto !== null ? monto(fila.monto, fila.moneda) : "—"}</td>
                      <td>{fila.dealId ? <Button variant="link" nativeButton={false} render={<Link href={enlaceConVuelta(`/p/${encodeURIComponent(slug)}/deals/${fila.dealId}`, origen)} />}>Ver deal</Button> : "Sin deal"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <nav aria-label="Paginación" className="flex items-center gap-3">
          {pagina > 1 ? <Button variant="outline" nativeButton={false} render={<Link href={conVuelta(`${enlace}&pagina=${pagina - 1}`)} />}>Anterior</Button> : <Button variant="outline" disabled>Anterior</Button>}
          <span className="cifra">Página {num(pagina)}</span>
          {pagina * TAMANO_PAGINA < lista.subtotal.cantidad ? <Button variant="outline" nativeButton={false} render={<Link href={conVuelta(`${enlace}&pagina=${pagina + 1}`)} />}>Siguiente</Button> : <Button variant="outline" disabled>Siguiente</Button>}
        </nav>
      </div>
    </PageShell>
  );
}
