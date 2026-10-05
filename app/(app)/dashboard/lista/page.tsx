import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConRol } from "@/lib/auth/page-guards";
import { programasVisibles } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { fecha, hoyEnBogota, monto, num } from "@/lib/format";
import { parsearPeriodoUrl, resolverPeriodo } from "@/lib/periodo";
import { listaDeMetrica, TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
import { nombreDeEtapa } from "@/lib/queries/vista-metrica";
import { queryDePeriodo } from "@/lib/queries/vista-todos";
import { PageShell } from "@/components/page-shell";
import { enlaceConVuelta, origenDeLaPagina } from "@/lib/navegacion/volver";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const esquema = z.object({
  metrica: z.enum(["caja", "agendas", "shows", "shows_sin_grain", "sin_resultado", "cierres", "leads", "contratado", "cartera"]),
  moneda: z.string().regex(/^[A-Z]{3}$/).optional(),
  pagina: z.string().regex(/^[1-9][0-9]{0,6}$/).transform(Number).pipe(z.number().max(1_000_000)).optional(),
});

const titulos = { caja: "Caja recaudada", agendas: "Agendas", shows: "Shows", shows_sin_grain: "Shows sin Grain", sin_resultado: "Llamadas pasadas sin resultado", cierres: "Cierres", leads: "Leads", contratado: "Contratado", cartera: "Cartera pendiente" };

export default async function ListaDeTodosPage({ searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const rol = await rolDeVista(session);
  const programas = await programasVisibles(session.user.id, rol);
  if (programas.length === 0) notFound();
  const busqueda = await searchParams;
  const validado = esquema.safeParse(busqueda);
  if (!validado.success) notFound();
  const { metrica, moneda, pagina = 1 } = validado.data;
  if (moneda && metrica !== "caja") notFound();
  const hoy = hoyEnBogota();
  const periodo = resolverPeriodo(parsearPeriodoUrl(busqueda), { hoy, actual: null });
  const secciones = await listaDeMetrica(
    metrica,
    { programId: programas.map((p) => p.id), rango: periodo.a, hoy, moneda },
    pagina,
  );
  const programasPorId = new Map(programas.map((p) => [p.id, p]));
  const q = new URLSearchParams(queryDePeriodo(periodo));
  q.set("metrica", metrica);
  if (moneda) q.set("moneda", moneda);
  const hrefPagina = (n: number) => {
    const copia = new URLSearchParams(q);
    copia.set("pagina", String(n));
    return `/dashboard/lista?${copia}`;
  };
  const haySiguiente = secciones.some((s) => pagina * TAMANO_PAGINA < s.subtotal.cantidad);
  // El origen de ESTA lista para "Ver deal" (ticket 174).
  const origen = origenDeLaPagina("/dashboard/lista", busqueda);

  return (
    <PageShell titulo={titulos[metrica]} descripcion="Todos los programas visibles">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Todos los programas</Badge>
          <Badge variant="secondary">{metrica === "cartera" ? `Foto de hoy: ${fecha(hoy)}` : `A: ${fecha(periodo.a.desde)} a ${fecha(periodo.a.hasta)}`}</Badge>
          {moneda ? <Badge variant="secondary">{moneda}</Badge> : null}
        </div>
        {metrica === "cartera" ? <p className="text-sm text-muted-foreground">Deals en pago parcial vigentes. La cartera no depende del periodo A; abre un deal para ver su saldo y próxima fecha de pago.</p> : null}
        {periodo.aviso ? <p role="status" className="text-sm text-muted-foreground">{periodo.aviso}</p> : null}
        {secciones.map((seccion) => {
          const programa = programasPorId.get(seccion.programId);
          if (!programa) return null;
          return (
            <Card key={seccion.programId}>
              <CardHeader>
                <CardTitle>{programa.nombre}</CardTitle>
                <p className="cifra">{num(seccion.subtotal.cantidad)} registros</p>
                {seccion.subtotal.caja.map((c) => <p className="cifra" key={c.moneda}>{monto(c.total, c.moneda)}</p>)}
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {seccion.filas.length === 0 ? <p>No hay filas en esta página para este programa.</p> : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left"><th>Closer</th><th>Etapa</th><th>Fecha</th><th>Días</th><th>Monto</th><th>Deal</th></tr></thead>
                    <tbody className="divide-y">
                      {seccion.filas.map((fila) => (
                        <tr key={fila.id}>
                          <td className="py-3">{fila.closer || "Sin closer"}</td>
                          <td>{fila.etapa ? nombreDeEtapa(fila.etapa) : "Sin deal"}</td>
                          <td>{fecha(fila.fecha)}</td>
                          <td className="cifra">{num(fila.antiguedad)}</td>
                          <td className="cifra">{fila.moneda && fila.monto !== null ? monto(fila.monto, fila.moneda) : "—"}</td>
                          <td>{fila.dealId ? <Button variant="link" nativeButton={false} render={<Link href={enlaceConVuelta(`/p/${encodeURIComponent(programa.slug)}/deals/${fila.dealId}`, origen)} />}>Ver deal</Button> : "Sin deal"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          );
        })}
        <nav aria-label="Paginación" className="flex items-center gap-3">
          {pagina > 1 ? <Button variant="outline" nativeButton={false} render={<Link href={hrefPagina(pagina - 1)} />}>Anterior</Button> : <Button variant="outline" disabled>Anterior</Button>}
          <span className="cifra">Página {num(pagina)}</span>
          {haySiguiente ? <Button variant="outline" nativeButton={false} render={<Link href={hrefPagina(pagina + 1)} />}>Siguiente</Button> : <Button variant="outline" disabled>Siguiente</Button>}
        </nav>
        <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard?${queryDePeriodo(periodo)}&seccion=${metrica === "cartera" || metrica === "contratado" || metrica === "caja" ? "dinero" : metrica === "sin_resultado" || metrica === "shows_sin_grain" ? "pulso" : "operacion"}`} />}>Volver al dashboard</Button>
      </div>
    </PageShell>
  );
}
