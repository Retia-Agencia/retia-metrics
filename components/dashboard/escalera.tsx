import Link from "next/link";
import { useId } from "react";
import {
  BarraApilada100,
  LeyendaDeBarras,
  type TonoDeBarra,
} from "@/components/graficas/barras";
import { ContextoDeCifra } from "@/components/dashboard/contexto-de-cifra";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CifraConLista } from "@/components/cifra-con-lista";
import { ComoSeCalcula } from "@/components/como-se-calcula";
import { Variacion } from "@/components/variacion";
import { num, pct } from "@/lib/format";
import type { PeriodoResuelto } from "@/lib/periodo";
import { ESCALONES, NOMBRE_DE_ESCALON, type Escalon, type GrupoDeCierre } from "@/lib/queries/escalera";
import type { CeldaDeEscalera, FilaDeEscalera, VistaDeEscalera } from "@/lib/queries/vista-escalera";

const PRINCIPALES = [
  ["cerro_en_la_llamada", "Cerró en la llamada", "exito"],
  ["cerro_con_seguimiento", "Cerró con seguimiento", "info"],
  ["no_cerro", "No cerró", "peligro"],
] as const satisfies readonly (readonly [GrupoDeCierre, string, TonoDeBarra])[];

const LEYENDA_PRINCIPAL = PRINCIPALES.map(([, etiqueta, tono]) => ({ etiqueta, tono }));

function Cifra({ celda, titulo }: { celda: CeldaDeEscalera; titulo: string }) {
  return (
    <CifraConLista titulo={titulo} detalle={celda.detalle ?? undefined}>
      <span className="cifra">{num(celda.deals)}</span>
    </CifraConLista>
  );
}

function TablaPorCalidad({ filas, visibles }: { filas: FilaDeEscalera[]; visibles: readonly Escalon[] }) {
  if (filas.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="pb-2 text-left font-medium">Por calidad</caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th>Calidad</th>
            {visibles.map((e) => (
              <th key={e} className="text-right">
                {NOMBRE_DE_ESCALON[e]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((fila) => (
            <tr key={fila.clave}>
              <td className="py-2">{fila.etiqueta}</td>
              {visibles.map((e) => (
                <td key={e} className="text-right">
                  <Cifra celda={fila.celdas[e]} titulo={`${NOMBRE_DE_ESCALON[e]} · ${fila.etiqueta}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SieteEscalones({
  vista,
  periodo,
  visibles,
}: {
  vista: VistaDeEscalera;
  periodo: PeriodoResuelto;
  visibles: readonly Escalon[];
}) {
  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th>Escalón</th>
            <th className="text-right">Deals</th>
            <th className="text-right">%</th>
            <th className="text-right">Días hábiles medianos</th>
            {vista.hayComparacion ? <th className="text-right">Cambio</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y">
          {visibles.map((escalon) => {
            const celda = vista.principal.celdas[escalon];
            return (
              <tr key={escalon}>
                <td className="py-2">{NOMBRE_DE_ESCALON[escalon]}</td>
                <td className="text-right">
                  <Cifra celda={celda} titulo={NOMBRE_DE_ESCALON[escalon]} />
                </td>
                <td className="cifra text-right">
                  {celda.porcentaje.valor === null ? "—" : pct(celda.porcentaje.valor / 100)}
                </td>
                <td className="cifra text-right">
                  {celda.diasMedianos === null ? "—" : num(celda.diasMedianos, celda.diasMedianos % 1 === 0 ? 0 : 1)}
                </td>
                {vista.hayComparacion ? (
                  <td className="text-right">
                    {celda.anterior === null ? null : (
                      <Variacion actual={celda.deals} anterior={celda.anterior} periodo={periodo} />
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <TablaPorCalidad filas={vista.porCalidad} visibles={visibles} />
    </div>
  );
}

export function Escalera({
  vista,
  periodo,
  programa,
  contexto,
}: {
  vista: VistaDeEscalera;
  periodo: PeriodoResuelto;
  programa?: string;
  contexto?: string;
}) {
  const idDelTitulo = useId();
  const visibles = vista.sinCorte ? ESCALONES.filter((escalon) => escalon !== "pago_rapido") : ESCALONES;
  const atendidas = PRINCIPALES.reduce((total, [grupo]) => total + vista.principal.grupos[grupo].deals, 0);
  const segmentos = PRINCIPALES.map(([clave, etiqueta, tono]) => ({
    clave,
    etiqueta,
    tono,
    cantidad: vista.principal.grupos[clave].deals,
    detalle: vista.principal.grupos[clave].detalle ?? undefined,
  }));
  const filasPorCloser = [...vista.porCloser]
    .filter((fila) => {
      const total = PRINCIPALES.reduce((suma, [grupo]) => suma + fila.grupos[grupo].deals, 0);
      return fila.etiqueta !== "Sin closer" || total > 0;
    })
    .sort((a, b) => {
      const baseA = PRINCIPALES.reduce((suma, [grupo]) => suma + a.grupos[grupo].deals, 0);
      const baseB = PRINCIPALES.reduce((suma, [grupo]) => suma + b.grupos[grupo].deals, 0);
      return (
        (baseB ? b.grupos.cerro_en_la_llamada.deals / baseB : 0) -
        (baseA ? a.grupos.cerro_en_la_llamada.deals / baseA : 0)
      );
    });
  return (
    <Card aria-labelledby={idDelTitulo}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle id={idDelTitulo} className="text-base">
            ¿Cómo cierra cada llamada?{programa ? ` · ${programa}` : ""}
          </CardTitle>
          {vista.sinCorte ? <Badge variant="alerta">Sin corte de pago rápido</Badge> : null}
        </div>
        {contexto ? <ContextoDeCifra texto={contexto} /> : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <LeyendaDeBarras items={LEYENDA_PRINCIPAL} />
        <BarraApilada100 segmentos={segmentos} />
        <div className="grid gap-3 sm:grid-cols-3">
          {PRINCIPALES.map(([grupo, etiqueta]) => {
            const celda = vista.principal.grupos[grupo];
            return (
              <div key={grupo} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{etiqueta}</p>
                <p className="text-2xl font-semibold">
                  <Cifra celda={celda} titulo={etiqueta} />
                </p>
                <p className="cifra text-xs text-muted-foreground">
                  {atendidas === 0 ? "—" : pct(celda.deals / atendidas, 0)}
                  {grupo === "cerro_con_seguimiento" && celda.diasMedianos !== null
                    ? ` · mediana ${num(celda.diasMedianos, 1)} días hábiles`
                    : ""}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Ventas sin llamada registrada:{" "}
          <Cifra celda={vista.principal.grupos.ventas_sin_llamada} titulo="Ventas sin llamada registrada" /> · No
          llegaron a la llamada:{" "}
          <Cifra celda={vista.principal.grupos.no_llegaron_a_la_llamada} titulo="No llegaron a la llamada" />
        </p>
        {filasPorCloser.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Por closer</h3>
            <LeyendaDeBarras items={LEYENDA_PRINCIPAL} />
            {filasPorCloser.map((fila) => (
              <div key={fila.clave} className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                <span className="text-sm">{fila.etiqueta}</span>
                <BarraApilada100
                  segmentos={PRINCIPALES.map(([clave, etiqueta, tono]) => ({
                    clave,
                    etiqueta,
                    tono,
                    cantidad: fila.grupos[clave].deals,
                    detalle: fila.grupos[clave].detalle ?? undefined,
                  }))}
                />
              </div>
            ))}
          </section>
        ) : null}
        <ComoSeCalcula>
          <p>
            El universo reúne las ventas del periodo y los deals creados en él que no vendieron. Las ventas usan la
            fecha de venta; los demás, la fecha de creación.
          </p>
          <p>
            “Mismo día” usa el día de Bogotá. El corte de pago rápido del programa es{" "}
            {vista.corteDias === null ? "no configurado" : `${num(vista.corteDias)} días hábiles`} y se edita en
            Programa.
          </p>
          <ul className="space-y-1">
            {PRINCIPALES.map(([grupo, etiqueta]) => {
              const href = vista.principal.grupos[grupo].detalle?.href;
              return (
                <li key={grupo}>
                  {href ? (
                    <Link className="underline underline-offset-2" href={href}>
                      Ver {etiqueta.toLocaleLowerCase("es")}
                    </Link>
                  ) : (
                    etiqueta
                  )}
                </li>
              );
            })}
          </ul>
        </ComoSeCalcula>
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Ver los siete escalones</summary>
          <div className="p-3">
            <SieteEscalones vista={vista} periodo={periodo} visibles={visibles} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
