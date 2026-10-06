import Link from "next/link";
import { cloneElement, type ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Operacion } from "@/components/dashboard/operacion";
import { Tabla, Tarjeta, tasa } from "@/components/dashboard/piezas";
import { DealsContraAgendas } from "@/components/deals-contra-agendas";
import { Variacion } from "@/components/variacion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monto, num, usd } from "@/lib/format";
import { desglosesDelResumen } from "@/lib/queries/metricas-con-filas";
import { detallesDeOperacion, detallesDelDashboard, nombreDeEtapa, urlDeLista } from "@/lib/queries/vista-metrica";
import { vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { urlDeListaTodos, type FilaDePrograma, type VistaDeTodos } from "@/lib/queries/vista-todos";

type Seccion = "pulso" | "operacion" | "dinero";
const GRILLA = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

/** Sin periodo B no hay contra qué comparar: no se pinta nada. */
function ContraB({ actual, anterior, decimales }: { actual: number; anterior: number | null; decimales?: number }) {
  return anterior === null ? null : <p><Variacion actual={actual} anterior={anterior} decimales={decimales} /></p>;
}

function TablaPorPrograma({ titulo, cabeceras, vista, seccion, celdas }: {
  titulo: string;
  cabeceras: string[];
  vista: VistaDeTodos;
  seccion: Seccion;
  celdas: (fila: FilaDePrograma) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent>
        <Tabla cabeceras={["Programa", ...cabeceras]}>
          {vista.programas.map((fila) => (
            <tr key={fila.programa.id}>
              <td className="py-3">
                <Button variant="link" nativeButton={false} render={<Link href={`${fila.href}&seccion=${seccion}`} />}>{fila.programa.nombre}</Button>
              </td>
              {celdas(fila)}
            </tr>
          ))}
        </Tabla>
      </CardContent>
    </Card>
  );
}

function ContratadoYCaja({ vista }: { vista: VistaDeTodos }) {
  const monedas = [...new Set([...vista.a.caja, ...(vista.b?.caja ?? [])].map((c) => c.moneda))].sort();
  if (monedas.length === 0) monedas.push("USD");
  return <>
    <Tarjeta titulo="Contratado" valor={
      <CifraConLista titulo="Contratado" detalle={vista.detalles.contratado}>{usd(vista.a.contratado.valor)}</CifraConLista>
    } nota={<>
      <ContraB actual={vista.a.contratado.valor} anterior={vista.b?.contratado.valor ?? null} decimales={2} />
      {vista.sinValorVendido.valor > 0 ? <p>{num(vista.sinValorVendido.valor)} sin valor vendido</p> : null}
    </>} />
    {monedas.map((moneda) => {
      const actual = vista.a.caja.find((c) => c.moneda === moneda)?.valor ?? 0;
      const anterior = vista.b ? vista.b.caja.find((c) => c.moneda === moneda)?.valor ?? 0 : null;
      // El resumen y la lista usan exactamente la moneda que se está mostrando.
      const grupos = vista.detalles.caja.resumen.grupos.filter((g) => g.moneda === moneda);
      const detalle = {
        resumen: {
          ...vista.detalles.caja.resumen,
          grupos,
          subtotal: { cantidad: grupos.reduce((n, g) => n + g.cantidad, 0), caja: [{ moneda, total: actual }] },
        },
        desgloses: desglosesDelResumen(grupos, nombreDeEtapa),
        href: urlDeListaTodos("caja", vista.periodo, moneda),
      };
      return <Tarjeta key={moneda} titulo={`Caja recaudada · ${moneda}`} valor={
        <CifraConLista titulo={`Caja recaudada en ${moneda}`} detalle={detalle}>{monto(actual, moneda)}</CifraConLista>
      } nota={<ContraB actual={actual} anterior={anterior} decimales={2} />} />;
    })}
  </>;
}

function Conteos({ vista, pulso = false }: { vista: VistaDeTodos; pulso?: boolean }) {
  const campos = pulso ? [
    ["Shows sin Grain", "showsSinGrain", "shows_sin_grain"],
    ["Llamadas pasadas sin resultado", "sinResultado", "sin_resultado"],
  ] as const : [
    ["Leads", "leads", "leads"], ["Agendas", "agendas", "agendas"],
    ["Shows", "shows", "shows"], ["Cierres", "cierres", "cierres"],
  ] as const;
  return campos.map(([titulo, campo, metrica]) => (
    <Tarjeta key={campo} titulo={titulo} valor={
      <CifraConLista titulo={titulo} detalle={vista.detalles[metrica]}>{num(vista.a[campo].valor)}</CifraConLista>
    } nota={<ContraB actual={vista.a[campo].valor} anterior={vista.b?.[campo].valor ?? null} />} />
  ));
}

/** Las banderas del Pulso (ticket 191): foto de hoy, sin B; el % va por programa en su dashboard. */
function Banderas({ vista }: { vista: VistaDeTodos }) {
  const { banderas } = vista;
  const campos = [
    ["Atendidos sin valor vendido", "sinValor", "atendidos_sin_valor"],
    ["Atendidos sin Grain", "sinGrain", "atendidos_sin_grain"],
  ] as const;
  return campos.map(([titulo, campo, metrica]) => (
    <Tarjeta key={campo} titulo={titulo} valor={
      <span className={banderas[campo].valor > 0 ? "text-tono-peligro" : undefined}>
        <CifraConLista titulo={titulo} detalle={vista.detalles[metrica]}>{num(banderas[campo].valor)}</CifraConLista>
      </span>
    } nota={`de ${num(banderas.atendidos.valor)} atendidos · a hoy`} />
  ));
}

function MetasPorPrograma({ vista }: { vista: VistaDeTodos }) {
  return <>
    <TablaPorPrograma titulo="Cohorte activa por programa" vista={vista} seccion="pulso"
      cabeceras={["Cohorte", "Meta cupos", "Vendidos", "Faltan", "Meta dinámica", "Cumplimiento"]}
      celdas={(fila) => <>
        <td className="text-right">{fila.dashboard.cohorte?.codigo ?? "Sin cohorte activa"}</td>
        <td className="text-right">{fila.metaCupos ? num(fila.metaCupos.valor) : "—"}</td>
        <td className="text-right">{fila.vendidos ? num(fila.vendidos.valor) : "—"}</td>
        <td className="text-right">{fila.dashboard.cohorte ? num(fila.dashboard.cohorte.faltan) : "—"}</td>
        <td className="text-right">{fila.metaDinamica ? num(fila.metaDinamica.valor) : "—"}</td>
        <td className="text-right">{tasa(fila.dashboard.cohorte?.ventana?.cumplimiento ?? null)}</td>
      </>} />
    <TablaPorPrograma titulo="Meta del mes por programa" vista={vista} seccion="pulso"
      cabeceras={["Meta cupos", "Meta USD", "Vendidos", "Avance", "Deuda cupos"]}
      celdas={({ dashboard: { metasDelMes: meta } }) => <>
        <td className="text-right">{meta.mesSinVentana ? "—" : num(meta.metaCupos)}</td>
        <td className="text-right">{meta.mesSinVentana ? "—" : usd(meta.metaUsd)}</td>
        <td className="text-right">{num(meta.vendidos)}</td>
        <td className="text-right">{tasa(meta.avancePct)}</td>
        <td className="text-right">{meta.mesSinVentana ? "—" : num(meta.deuda)}</td>
      </>} />
  </>;
}

function Cartera({ vista }: { vista: VistaDeTodos }) {
  return <Card>
    <CardHeader><CardTitle>Cartera pendiente · foto de hoy</CardTitle></CardHeader>
    <CardContent className="space-y-2">
      <Button variant="link" className="cifra h-auto p-0 text-2xl" nativeButton={false}
        render={<Link href={vista.detalles.cartera.href} />}>{usd(vista.cartera.saldo.valor)}</Button>
      <p className="text-sm"><span className="cifra">{num(vista.cartera.deals.valor)}</span> deals · <span className="cifra">{num(vista.cartera.vencidos.valor)}</span> vencidos</p>
      <p className="text-sm text-muted-foreground">No depende del periodo A ni se compara con B.</p>
      <p className="text-sm text-muted-foreground"><span className="cifra">{num(vista.cartera.sinSaldoCalculable.valor)}</span> sin saldo calculable · <span className="cifra">{num(vista.cartera.sinFechaDeReferencia.valor)}</span> sin fecha de referencia.</p>
    </CardContent>
  </Card>;
}

function VentasPorCohorte({ vista }: { vista: VistaDeTodos }) {
  return <Card>
    <CardHeader><CardTitle>Ventas por programa y cohorte</CardTitle></CardHeader>
    <CardContent>
      {vista.programas.every((p) => p.dashboard.ventasPorCohorte.length === 0) ? <p>Sin ventas en el periodo.</p> : (
        <Tabla cabeceras={["Programa", "Cohorte", "Ventas", "Contratado"]}>
          {vista.programas.flatMap((fila) => fila.dashboard.ventasPorCohorte.map((cohorte) => {
            const href = cohorte.cohorteId ? urlDeLista(fila.programa.slug, "contratado", vista.periodo, null, undefined, cohorte.cohorteId) : null;
            return <tr key={`${fila.programa.id}:${cohorte.cohorteId}`}>
              <td className="py-2">{fila.programa.nombre}</td><td className="text-right">{cohorte.codigo ?? "Sin cohorte"}</td>
              <td className="text-right">{href ? <Button variant="link" nativeButton={false} render={<Link href={href} />}>{num(cohorte.ventas)}</Button> : num(cohorte.ventas)}</td>
              <td className="text-right">{href ? <Button variant="link" nativeButton={false} render={<Link href={href} />}>{usd(cohorte.contratadoUsd)}</Button> : usd(cohorte.contratadoUsd)}</td>
            </tr>;
          }))}
        </Tabla>
      )}
    </CardContent>
  </Card>;
}

/** Solo servidor: las piezas compartidas se importan, nunca se modifican. */
export async function SeccionDeTodos({ vista, seccion, hoy }: { vista: VistaDeTodos; seccion: Seccion; hoy: string }) {
  if (seccion === "pulso") return <section id="pulso" className="space-y-4">
    <h2 className="text-xl font-semibold">Pulso</h2>
    <div className={GRILLA}><ContratadoYCaja vista={vista} /><Conteos vista={vista} pulso /><Banderas vista={vista} /></div>
    <MetasPorPrograma vista={vista} />
  </section>;

  if (seccion === "dinero") return <section id="dinero" className="space-y-4">
    <h2 className="text-xl font-semibold">Dinero</h2>
    <div className={GRILLA}><ContratadoYCaja vista={vista} /></div>
    <Cartera vista={vista} />
    <TablaPorPrograma titulo="Comisión y descuento por programa" vista={vista} seccion="dinero"
      cabeceras={["Comisión USD", "Sin comisión calculable", "Descuento promedio", "Descuento USD", "Ventas con descuento calculable"]}
      celdas={(fila) => <>
        <td className="text-right"><Button variant="link" nativeButton={false} render={<Link href={urlDeLista(fila.programa.slug, "contratado", vista.periodo)} />}>{usd(fila.comision.valor)}</Button></td>
        <td className="text-right">{num(fila.dashboard.comision.ventasSinComision)}</td>
        <td className="text-right"><Button variant="link" nativeButton={false} render={<Link href={urlDeLista(fila.programa.slug, "contratado", vista.periodo)} />}>{tasa(fila.descuento.valor)}</Button></td>
        <td className="text-right">{fila.dashboard.descuento.promedioUsd === null ? "—" : usd(fila.dashboard.descuento.promedioUsd)}</td>
        <td className="text-right">{num(fila.dashboard.descuento.ventas)}</td>
      </>} />
    <VentasPorCohorte vista={vista} />
  </section>;

  return <section id="operacion" className="space-y-4">
    <h2 className="text-xl font-semibold">Operación comercial</h2>
    <div className={GRILLA}><Conteos vista={vista} /></div>
    <TablaPorPrograma titulo="Tasas por programa" vista={vista} seccion="operacion"
      cabeceras={["% show", "% cierre", "% shows sin Grain"]}
      celdas={(fila) => <>
        <td className="text-right">{tasa(fila.pctShow.valor)}</td>
        <td className="text-right">{tasa(fila.pctCierre.valor)}</td>
        <td className="text-right">{tasa(fila.pctSinGrain.valor)}</td>
      </>} />
    {await Promise.all(vista.programas.map(async (fila) => {
      const entrada = { programId: fila.programa.id, slug: fila.programa.slug, hoy, periodo: vista.periodo, claveCloser: null };
      const [detalles, dealsContraAgendas, detallesOperacion] = await Promise.all([
        detallesDelDashboard(entrada), vistaDealsContraAgendas(entrada),
        detallesDeOperacion(entrada, fila.dashboard.comparativo.map((c) => c.clave)),
      ]);
      // La sección compartida tiene un ancla fija; aquí hay una instancia por programa.
      const operacion = Operacion({ vista: fila.dashboard, detalles, detallesOperacion, dealsContraAgendas: <DealsContraAgendas vista={dealsContraAgendas} /> });
      return <div key={fila.programa.id} className="space-y-3">
        <h3 className="text-lg font-semibold">{fila.programa.nombre}</h3>
        {cloneElement(operacion, { id: `operacion-${fila.programa.id}` })}
      </div>;
    }))}
  </section>;
}
