import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { nombreDeEtapa, vistaDeLista, urlDeLista } from "@/lib/queries/vista-metrica";
import { TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
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
    "contratado",
    "sin_resultado",
    "cartera",
    "grupo_citas",
    "grupo_shows",
    "grupo_vendidos",
  ]),
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
  contratado: "Contratado",
  sin_resultado: "Llamadas pasadas sin resultado",
  cartera: "Cartera",
  grupo_citas: "Deals con cita ocurrida (grupo de las tasas)",
  grupo_shows: "Deals del grupo con show",
  grupo_vendidos: "Deals del grupo con show y vendidos hoy",
};

export default async function ListaDeCifraPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();
  const busqueda = await searchParams;
  const validado = esquema.safeParse(busqueda);
  if (!validado.success) notFound();
  const { metrica, closer, moneda, cohorte, pagina = 1 } = validado.data;
  if (moneda && metrica !== "caja") notFound();
  const vista = await vistaDeLista({
    programId: programa.id,
    metrica,
    busqueda,
    hoy: hoyEnBogota(),
    codigoCloser: closer,
    moneda,
    cohorteId: cohorte,
    pagina,
  });
  if (!vista) notFound();
  const { lista, periodo, claveCloser } = vista;
  const enlace = urlDeLista(slug, metrica, periodo, claveCloser, moneda, cohorte);
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
          {/* La cartera es una foto de hoy: el periodo no la acota, así que no se muestra. */}
          {metrica === "cartera" ? (
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
        <p className="text-sm text-muted-foreground">Más antiguos primero. Antigüedad en días calendario de Bogotá; fechas futuras: 0 días.</p>
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
                      <td className="cifra">{num(fila.antiguedad)}</td>
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
