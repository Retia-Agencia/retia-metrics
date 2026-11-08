import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, veEquipoComercial, veLeadsDePauta } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { nombreDeEtapa, vistaDeLista, urlDeLista } from "@/lib/queries/vista-metrica";
import { capacidadParaMetrica, esListaDeVentas, METRICAS_FOTO_DE_HOY, proyectarListaSegunRol, TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
import { esMetricaDeEmbudo, METRICAS_DE_EMBUDO_SIN_PERIODO } from "@/lib/queries/embudo-con-filas";
import { NOMBRE_DE_ESCALON } from "@/lib/queries/escalera";
import { camposDeFiltrosDeLista, combinacionDeFiltrosValida, METRICAS_DE_LISTA, normalizarFiltrosDeOrigen, tipoDeLista } from "@/lib/queries/filtros-de-lista";
import { fecha, hoyEnBogota, monto, num } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { enlaceConVuelta, origenDeLaPagina } from "@/lib/navegacion/volver";
import { rotuloDeImporte, TITULOS_DE_LISTA } from "@/lib/vocabulario-metricas";
import { CabecerasDeVentas, CeldasDeVentas, PieDeVentas } from "@/components/dashboard/dinero-de-ventas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const esquema = z.object({
  metrica: z.enum(METRICAS_DE_LISTA),
  ...camposDeFiltrosDeLista,
  cohorte: z.string().uuid().optional().catch(undefined),
  pagina: z.string().regex(/^[1-9][0-9]{0,6}$/).transform(Number).pipe(z.number().max(1_000_000)).optional(),
});

const titulos = TITULOS_DE_LISTA;

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
  // Las listas comerciales siguen reservadas a quien administra. Las cifras de Pauta y Origen
  // abren con la capacidad del tablero; su proyección conserva lead y etapa, pero no el contexto
  // comercial para quien no ve el equipo. Por capacidad, nunca `rol === "..."`.
  const busqueda = await searchParams;
  const validado = esquema.safeParse(busqueda);
  if (!validado.success) notFound();
  const { tieneOrigen, esListaDePauta, esListaDeOrigen } = tipoDeLista(validado.data);
  const capacidad = capacidadParaMetrica({ metrica: validado.data.metrica, tieneOrigen });
  const session = await paginaConCapacidad(capacidad);
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const esAdmin = esAdministrador(rol);
  const veEquipo = veEquipoComercial(rol);
  const veLeads = veLeadsDePauta(rol);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();
  const { metrica, closer, moneda, cohorte, origen: origenDeal, etapa, antiguedad, pagina = 1, source, medium, campaign, resultado, categoria, area, canal, orden, escalon, grupo, calidad, pago, nivel, id, paso } = validado.data;
  const { source: sourceNormalizado, medium: mediumNormalizado, canal: canalNormalizado, campaign: campaignNormalizado } = normalizarFiltrosDeOrigen(validado.data);
  if (!combinacionDeFiltrosValida(validado.data, { esAdmin })) notFound();
  const vista = await vistaDeLista({
    programId: programa.id,
    metrica,
    busqueda,
    hoy: hoyEnBogota(),
    codigoCloser: closer,
    moneda,
    cohorteId: cohorte,
    origenDeal,
    etapa,
    antiguedad,
    source: sourceNormalizado,
    medium: mediumNormalizado,
    campaign: campaignNormalizado,
    resultado,
    categoria,
    orden,
    area,
    canal: canalNormalizado,
    escalon,
    grupo,
    calidad,
    pago,
    nivel,
    idMeta: id,
    paso,
    pagina,
  });
  if (!vista) notFound();
  const { periodo, claveCloser } = vista;
  const conVentas = esListaDeVentas(metrica, { escalon, grupo, pago });
  const lista = proyectarListaSegunRol(vista.lista, {
    rol, metrica, esListaDePauta, esListaDeOrigen,
  });
  const desde = typeof busqueda.desde === "string" ? busqueda.desde : undefined;
  const enlace = urlDeLista({
    slug,
    metrica,
    periodo,
    origen: desde ?? `/p/${slug}/hub`,
    claveCloser,
    moneda,
    cohorteId: cohorte,
    origenDeal,
    subconjunto: { etapa, antiguedad },
    filtrosDeOrigen: { source: sourceNormalizado, medium: mediumNormalizado, campaign: campaignNormalizado, resultado, categoria, area, canal: canalNormalizado },
    escalera: { escalon, grupo, calidad, pago },
    pauta: nivel && paso ? { nivel, id, paso } : undefined,
  });
  // Las banderas del Pulso (191) y los abiertos del embudo son una foto de hoy:
  // el periodo no los acota.
  const sinPeriodo = (METRICAS_FOTO_DE_HOY as readonly string[]).includes(metrica)
    || (METRICAS_DE_EMBUDO_SIN_PERIODO as readonly string[]).includes(metrica);
  const subtitulo = etapa ? (etapa === "vendido" ? "Vendido" : nombreDeEtapa(etapa)) : antiguedad ? `${antiguedad} días` : escalon ? (escalon === "ventas" ? "Ventas" : escalon === "despues" ? "Pagaron después" : escalon === "cita_sin_resultado" ? "Con la cita pasada sin resultado" : NOMBRE_DE_ESCALON[escalon]) : null;
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
          {calidad ? <Badge variant="secondary">Calidad: {calidad}</Badge> : null}
          {resultado ? <Badge variant="secondary">{resultado === "no_show" ? "Solo no shows" : "Solo shows"}</Badge> : null}
          {pago ? <Badge variant="secondary">{pago === "completo" ? "Pago completo" : "Pago parcial"}</Badge> : null}
          {sourceNormalizado !== undefined || mediumNormalizado !== undefined ? (
            <Badge variant="secondary">Origen: {sourceNormalizado ?? "—"} / {mediumNormalizado ?? "—"}</Badge>
          ) : null}
          {campaignNormalizado !== undefined ? <Badge variant="secondary">Campaña: {campaignNormalizado ?? "—"}</Badge> : null}
          {categoria ? <Badge variant="secondary">{categoria === "sin_utm" ? "Sin UTM" : categoria === "macro" ? "Plantilla sin completar" : categoria === "con_utm" ? "Con UTM" : "Pieza desconocida"}</Badge> : null}
        </div>
        {periodo.aviso ? <p role="status" className="text-sm text-muted-foreground">{periodo.aviso}</p> : null}
        <p className="cifra">{lista.disponible ? num(lista.subtotal.cantidad) : "—"} {metrica === "no_agendaron" ? "personas" : "registros"}</p>
        {conVentas ? null : lista.subtotal.caja.map((c) => <p className="cifra" key={c.moneda}>{monto(c.total, c.moneda)}</p>)}
        {conVentas ? <p className="text-sm text-muted-foreground">Vendido, Recaudado y Por cobrar de estas ventas. Lo recaudado es a hoy, sin importar cuándo se abonó.</p> : null}
        <p className="text-sm text-muted-foreground">
          Más antiguos primero. Antigüedad en días calendario de Bogotá; fechas futuras: 0 días.
          {esMetricaDeEmbudo(metrica) ? " En el embudo por etapas, la fecha es la entrada del deal al embudo." : null}
          {metrica === "escalera" ? " En la escalera, la fecha es la de la venta (escalones 1 a 4) o la de creación del deal (5 a 7)." : null}
        </p>
        <Card>
          <CardContent className="overflow-x-auto pt-4">
            {lista.filas.length === 0 ? <p>No hay filas en esta página para los filtros elegidos.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left">{(veEquipo || (veLeads && (esListaDePauta || esListaDeOrigen))) ? <th>Persona</th> : null}{veEquipo ? <th>Closer</th> : null}<th>Etapa</th><th>{metrica === "no_agendaron" ? <Link className="underline underline-offset-2" href={enlaceOrdenado("envio")}>Fecha de envío</Link> : "Fecha"}</th><th>Días</th>{metrica === "no_agendaron" ? <th><Link className="underline underline-offset-2" href={enlaceOrdenado("actividad")}>Última actividad</Link></th> : conVentas ? <CabecerasDeVentas /> : <th>{rotuloDeImporte(metrica)}</th>}{veEquipo ? <th>Deal</th> : null}</tr></thead>
                <tbody className="divide-y">
                  {lista.filas.map((fila) => (
                    <tr key={fila.id}>
                      {(veEquipo || (veLeads && (esListaDePauta || esListaDeOrigen))) ? <td className="py-3">{fila.persona ? (veEquipo ? <Link className="underline underline-offset-2" href={enlaceConVuelta(fila.dealId ? `/p/${encodeURIComponent(slug)}/deals/${fila.dealId}` : `/p/${encodeURIComponent(slug)}/leads/${fila.persona.leadId}`, origen)}>{fila.persona.nombre ?? "Sin nombre"}</Link> : fila.persona.nombre ?? "Sin nombre") : "Sin nombre"}</td> : null}
                      {/* Sin acceso al equipo (`registros` para Pauta), closer y deal llegan proyectados a nulo: no se pintan. */}
                      {veEquipo ? <td>{fila.closer || "Sin closer"}</td> : null}
                      <td>{fila.etapa ? nombreDeEtapa(fila.etapa) : "Sin deal"}</td>
                      <td className="py-3">{fecha(fila.fecha)}</td>
                      <td><Badge variant={tonoDeAntiguedad(fila.bucket)} className="cifra">{num(fila.antiguedad)}</Badge></td>
                      {conVentas ? <CeldasDeVentas fila={fila} /> : <td>
                        <span className="cifra">{metrica === "no_agendaron" ? (fila.ultimaActividad ? fecha(fila.ultimaActividad) : "—") : fila.moneda && fila.monto !== null ? monto(fila.monto, fila.moneda) : "—"}</span>
                        {fila.concepto === "adicional" ? <span className="block text-xs">Adicional{fila.nota ? `: ${fila.nota}` : ""}</span> : null}
                      </td>}
                      {veEquipo ? <td>{fila.dealId ? <Button variant="link" nativeButton={false} render={<Link href={enlaceConVuelta(`/p/${encodeURIComponent(slug)}/deals/${fila.dealId}`, origen)} />}>Ver deal</Button> : "Sin deal"}</td> : null}
                    </tr>
                  ))}
                </tbody>
                {conVentas ? <PieDeVentas dinero={lista.dinero} columnasAntes={[veEquipo || (veLeads && (esListaDePauta || esListaDeOrigen)), veEquipo, true, true, true].filter(Boolean).length} columnasDespues={veEquipo ? 1 : 0} /> : null}
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
