import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { programasVisibles } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { parsearPeriodoUrl } from "@/lib/periodo";
import { hoyEnBogota, monto, num, pct } from "@/lib/format";
import { armarVistaDeTodos } from "@/lib/queries/vista-todos";
import { dinero, type Conteo, type Dinero } from "@/lib/queries/agregado-programas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { PageShell } from "@/components/page-shell";
import { SelectorPeriodo } from "@/components/selector-periodo";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Variacion } from "@/components/variacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function TarjetaConteo({
  titulo,
  actual,
  anterior,
  detalle,
}: {
  titulo: string;
  actual: Conteo;
  anterior?: Conteo;
  detalle: DetalleDeCifra;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <CifraConLista titulo={titulo} detalle={detalle}>
          <span className="cifra text-3xl">{num(actual.valor)}</span>
        </CifraConLista>
        {anterior ? <p className="text-sm text-muted-foreground"><Variacion actual={actual.valor} anterior={anterior.valor} /></p> : null}
      </CardContent>
    </Card>
  );
}

function TarjetaDinero({ actual, anterior, detalle }: { actual: Dinero; anterior?: Dinero; detalle: DetalleDeCifra }) {
  return (
    <Card>
      <CardHeader><CardTitle>Caja recaudada</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <CifraConLista titulo={`Caja recaudada en ${actual.moneda}`} detalle={detalle}>
          <span className="cifra text-3xl">{monto(actual.valor, actual.moneda)}</span>
        </CifraConLista>
        {anterior ? <p className="text-sm text-muted-foreground"><Variacion actual={actual.valor} anterior={anterior.valor} decimales={2} /></p> : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardDeTodosPage({ searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const rol = await rolDeVista(session);
  const programas = await programasVisibles(session.user.id, rol);
  if (programas.length === 0) notFound();
  const busqueda = await searchParams;
  const vista = await armarVistaDeTodos({ programas, hoy: hoyEnBogota(), periodo: parsearPeriodoUrl(busqueda) });
  const anteriorPorMoneda = new Map(vista.b?.caja.map((c) => [c.moneda, c]));

  return (
    <PageShell titulo="Todos los programas" descripcion="Magnitudes sumables y comparación por programa">
      <div className="space-y-6">
        <SelectorPeriodo periodo={vista.periodo} cohorteDisponible={false} anteriorDisponible={false} mostrarCohortes={false} />
        {vista.periodo.aviso ? <p role="status" className="text-sm text-muted-foreground">{vista.periodo.aviso}</p> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Totales entre programas">
          <TarjetaConteo titulo="Leads" actual={vista.a.leads} anterior={vista.b?.leads} detalle={vista.detalles.leads} />
          <TarjetaConteo titulo="Agendas" actual={vista.a.agendas} anterior={vista.b?.agendas} detalle={vista.detalles.agendas} />
          <TarjetaConteo titulo="Shows" actual={vista.a.shows} anterior={vista.b?.shows} detalle={vista.detalles.shows} />
          <TarjetaConteo titulo="Shows sin Grain" actual={vista.a.showsSinGrain} anterior={vista.b?.showsSinGrain} detalle={vista.detalles.shows_sin_grain} />
          <TarjetaConteo titulo="Cierres" actual={vista.a.cierres} anterior={vista.b?.cierres} detalle={vista.detalles.cierres} />
          {(vista.a.caja.length > 0 ? vista.a.caja : [dinero("USD", 0)]).map((c) => <TarjetaDinero key={c.moneda} actual={c} anterior={vista.b ? (anteriorPorMoneda.get(c.moneda) ?? dinero(c.moneda, 0)) : undefined} detalle={vista.detalles.caja} />)}
        </section>

        <Card>
          <CardHeader><CardTitle>Tasas, metas y comisión por programa</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th>Programa</th><th>% show</th><th>% cierre</th><th>% sin Grain</th><th>Meta cupos</th><th>Meta dinámica</th><th>Vendidos</th><th>Comisión</th></tr></thead>
              <tbody className="divide-y">
                {vista.programas.map((fila) => (
                  <tr key={fila.programa.id}>
                    <td className="py-3"><Link className="font-medium underline-offset-4 hover:underline" href={fila.href}>{fila.programa.nombre}</Link></td>
                    <td className="cifra">{fila.pctShow.valor === null ? "—" : pct(fila.pctShow.valor)}</td>
                    <td className="cifra">{fila.pctCierre.valor === null ? "—" : pct(fila.pctCierre.valor)}</td>
                    <td className="cifra">{fila.pctSinGrain.valor === null ? "—" : pct(fila.pctSinGrain.valor)}</td>
                    <td className="cifra">{fila.metaCupos ? num(fila.metaCupos.valor) : "—"}</td>
                    <td className="cifra">{fila.metaDinamica ? num(fila.metaDinamica.valor) : "—"}</td>
                    <td className="cifra">{fila.vendidos ? num(fila.vendidos.valor) : "—"}</td>
                    <td className="cifra">{monto(fila.comision.valor, fila.comision.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
