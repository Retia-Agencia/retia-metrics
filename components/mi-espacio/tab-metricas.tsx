import { parsearPeriodoUrl } from "@/lib/periodo";
import { monto, num, pct } from "@/lib/format";
import {
  armarVistaDeMisMetricas,
  armarVistaDeMisMetricasTodos,
  type ProgramaDeMetricas,
  type VistaDeMisMetricas,
} from "@/lib/queries/mi-espacio-metricas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { CifraConLista } from "@/components/cifra-con-lista";
import { SelectorPeriodo } from "@/components/selector-periodo";
import { Variacion } from "@/components/variacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { textoDeVariacionDeTasa } from "@/lib/variacion";

type Busqueda = Record<string, string | string[] | undefined>;

function TarjetaNumero({ titulo, valor, anterior, detalle }: { titulo: string; valor: number; anterior?: number; detalle: DetalleDeCifra }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <CifraConLista titulo={titulo} detalle={detalle}><span className="cifra text-2xl font-semibold">{num(valor)}</span></CifraConLista>
        {anterior !== undefined ? <p className="text-xs text-muted-foreground"><Variacion actual={valor} anterior={anterior} /></p> : null}
      </CardContent>
    </Card>
  );
}

function TarjetaTasa({ vista }: { vista: VistaDeMisMetricas }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">% de cierre sobre atendidas</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <CifraConLista titulo="Cierres" detalle={vista.detalles.cierres}>
          <span className="cifra text-2xl font-semibold">{vista.a.pctCierre === null ? "—" : pct(vista.a.pctCierre)}</span>
        </CifraConLista>
        {vista.b ? <p className="cifra text-xs text-muted-foreground">{textoDeVariacionDeTasa(vista.a.pctCierre, vista.b.pctCierre)}</p> : null}
      </CardContent>
    </Card>
  );
}

function TarjetasDinero({ vista }: { vista: VistaDeMisMetricas }) {
  const anterior = new Map(vista.b?.caja.map((c) => [c.moneda, c.total]));
  const cajas = vista.a.caja.length > 0 ? vista.a.caja : [{ moneda: "USD", total: 0 }];
  return (
    <>
      {cajas.map((c) => (
        <Card key={c.moneda}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Caja cobrada</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <CifraConLista titulo={`Caja cobrada en ${c.moneda}`} detalle={vista.detalles.caja}>
              <span className="cifra text-2xl font-semibold">{monto(c.total, c.moneda)}</span>
            </CifraConLista>
            {vista.b ? <p className="text-xs text-muted-foreground"><Variacion actual={c.total} anterior={anterior.get(c.moneda) ?? 0} decimales={2} /></p> : null}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Comisión</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <CifraConLista titulo="Cierres que generan comisión" detalle={vista.detalles.cierres}>
            <span className="cifra text-2xl font-semibold">{monto(vista.a.comisionUsd, "USD")}</span>
          </CifraConLista>
          {vista.b ? <p className="text-xs text-muted-foreground"><Variacion actual={vista.a.comisionUsd} anterior={vista.b.comisionUsd} decimales={2} /></p> : null}
        </CardContent>
      </Card>
    </>
  );
}

function BloqueDePrograma({ vista, conSelector = true }: { vista: VistaDeMisMetricas; conSelector?: boolean }) {
  return (
    <div className="space-y-4">
      {conSelector ? <SelectorPeriodo periodo={vista.periodo} cohorteDisponible={vista.cohorteDisponible} anteriorDisponible={vista.anteriorDisponible} /> : null}
      {vista.periodo.aviso ? <p role="status" className="text-sm text-muted-foreground">{vista.periodo.aviso}</p> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Métricas de ${vista.programa.nombre}`}>
        <TarjetaNumero titulo="Agendas" valor={vista.a.agendas} anterior={vista.b?.agendas} detalle={vista.detalles.agendas} />
        <TarjetaNumero titulo="Llamadas atendidas" valor={vista.a.shows} anterior={vista.b?.shows} detalle={vista.detalles.shows} />
        <TarjetaNumero titulo="No show" valor={vista.a.noShows} anterior={vista.b?.noShows} detalle={vista.detalles.noShows} />
        <TarjetaNumero titulo="Cierres" valor={vista.a.cierres} anterior={vista.b?.cierres} detalle={vista.detalles.cierres} />
        <TarjetaTasa vista={vista} />
        <TarjetasDinero vista={vista} />
      </section>
    </div>
  );
}

function Total({ titulo, actual, anterior }: { titulo: string; actual: number; anterior?: number }) {
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{titulo}</CardTitle></CardHeader><CardContent className="space-y-2">
      <p className="cifra text-2xl font-semibold">{num(actual)}</p>
      {anterior !== undefined ? <p className="text-xs text-muted-foreground"><Variacion actual={actual} anterior={anterior} /></p> : null}
    </CardContent></Card>
  );
}

export async function TabMetricas({
  programas,
  programa,
  closerId,
  hoy,
  busqueda,
}: {
  programas: ProgramaDeMetricas[];
  programa: ProgramaDeMetricas | null;
  closerId: string;
  hoy: string;
  busqueda: Busqueda;
}) {
  const periodo = parsearPeriodoUrl(busqueda);
  if (programa) {
    const vista = await armarVistaDeMisMetricas({ programa, closerId, hoy, periodo });
    return <BloqueDePrograma vista={vista} />;
  }

  const todos = await armarVistaDeMisMetricasTodos({ programas, closerId, hoy, periodo });
  const cajasB = new Map(todos.b?.caja.map((c) => [c.moneda, c.valor]));
  return (
    <div className="space-y-6">
      <SelectorPeriodo
        periodo={todos.periodo}
        cohorteDisponible={todos.programas.every((p) => p.vista.cohorteDisponible)}
        anteriorDisponible={todos.programas.every((p) => p.vista.anteriorDisponible)}
      />
      {todos.periodo.preset.startsWith("cohorte") ? <p className="text-sm text-muted-foreground">Cada programa usa la ventana de su propia cohorte.</p> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Totales entre programas">
        <Total titulo="Agendas" actual={todos.a.agendas.valor} anterior={todos.b?.agendas.valor} />
        <Total titulo="Llamadas atendidas" actual={todos.a.shows.valor} anterior={todos.b?.shows.valor} />
        <Total titulo="No show" actual={todos.a.noShows.valor} anterior={todos.b?.noShows.valor} />
        <Total titulo="Cierres" actual={todos.a.cierres.valor} anterior={todos.b?.cierres.valor} />
        {(todos.a.caja.length > 0 ? todos.a.caja : [{ tipo: "dinero" as const, moneda: "USD", valor: 0 }]).map((c) => (
          <Card key={c.moneda}><CardHeader className="pb-2"><CardTitle className="text-sm">Caja cobrada</CardTitle></CardHeader><CardContent className="space-y-2">
            <p className="cifra text-2xl font-semibold">{monto(c.valor, c.moneda)}</p>
            {todos.b ? <p className="text-xs text-muted-foreground"><Variacion actual={c.valor} anterior={cajasB.get(c.moneda) ?? 0} decimales={2} /></p> : null}
          </CardContent></Card>
        ))}
      </section>
      <div className="space-y-6">
        {todos.programas.map(({ vista }) => (
          <section key={vista.programa.id} className="space-y-3">
            <h3 className="text-base font-semibold">{vista.programa.nombre}</h3>
            <BloqueDePrograma vista={vista} conSelector={false} />
          </section>
        ))}
      </div>
    </div>
  );
}
