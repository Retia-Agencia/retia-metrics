import Link from "next/link";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Variacion } from "@/components/variacion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct, usd } from "@/lib/format";
import type { Alerta } from "@/lib/queries/alertas";
import { Alertas } from "@/components/dashboard/alertas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { CajaConVariacion, Tarjeta, tasa } from "@/components/dashboard/piezas";

function Cohorte({ vista }: { vista: VistaDelDashboard }) {
  const { cohorte, claveCloser, closers } = vista;
  const etiquetaCloser = claveCloser === null
    ? null
    : (closers.find((closer) => closer.id === claveCloser)?.label ?? "este closer");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">
          {cohorte ? `Cohorte ${cohorte.codigo}` : "Cohorte"}
        </CardTitle>
        {cohorte?.ventana ? (
          <Badge variant="secondary">
            día {num(cohorte.ventana.dia)} de {num(cohorte.ventana.total)} hábiles
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!cohorte ? (
          <p className="text-muted-foreground">
            Este programa no tiene ninguna cohorte activa. Se activa desde Programa.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Vendidos / meta</p>
                <p className="cifra text-lg font-semibold">
                  {num(cohorte.vendidos)} / {num(cohorte.meta)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faltan</p>
                <p className="cifra text-lg font-semibold">{num(cohorte.faltan)}</p>
              </div>
              {cohorte.ventana ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Meta dinámica</p>
                    <p className="cifra text-lg font-semibold">
                      {num(cohorte.ventana.metaDinamica, 1)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      por día hábil, quedan {num(cohorte.ventana.habilesRestantes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Esperado a hoy</p>
                    <p className="cifra text-lg font-semibold">
                      {num(cohorte.ventana.esperado, 1)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ritmo lineal {num(cohorte.ventana.metaLineal, 1)}/día
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cumplimiento</p>
                    <p className="cifra text-lg font-semibold">
                      {tasa(cohorte.ventana.cumplimiento)}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
            {cohorte.ventana ? (
              <p className="text-xs text-muted-foreground">
                Vende del {fecha(cohorte.ventana.inicio)} al {fecha(cohorte.ventana.cierre)},
                inclusive.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Esta cohorte no tiene declarado su inicio de ventas; no se inventan días
                hábiles ni meta dinámica.
              </p>
            )}
            {claveCloser !== null ? (
              <p>
                Contribución de <span className="font-medium">{etiquetaCloser}</span>:{" "}
                <span className="cifra">{num(cohorte.vendidosDelCloser ?? 0)}</span> de los{" "}
                <span className="cifra">{num(cohorte.vendidos)}</span> cupos vendidos. La meta
                es de la cohorte, no individual.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetaDelMes({ vista, slug, veEquipo }: { vista: VistaDelDashboard; slug: string; veEquipo: boolean }) {
  const meta = vista.metasDelMes;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta del mes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Vendidos / meta</p>
            <p className="cifra text-lg font-semibold">
              {num(meta.vendidos)} / {num(meta.metaCupos)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avance</p>
            <p className="cifra text-lg font-semibold">
              {meta.avancePct === null ? "—" : pct(meta.avancePct)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deuda</p>
            <p className="cifra text-lg font-semibold">
              {num(meta.deuda)} · {meta.deudaPct === null ? "—" : pct(meta.deudaPct)}
            </p>
          </div>
        </div>
        {vista.claveCloser !== null ? (
          <p className="text-xs text-muted-foreground">
            La meta es del programa, no individual.
          </p>
        ) : null}
        {veEquipo ? (
          <Button
            variant="link"
            className="h-auto p-0"
            nativeButton={false}
            render={<Link href={`/p/${encodeURIComponent(slug)}/metas`} />}
          >
            Ver Metas
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Responde: ¿vamos bien hoy? */
export function Pulso({
  vista,
  detalles,
  slug,
  alertas,
  veEquipo = true,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  slug: string;
  /** Sin equipo comercial (paid trafficker, ticket 102): sin enlaces a Metas ni a Programa. */
  veEquipo?: boolean;
  /** Las alertas por persistencia del programa (147); sin ellas no se pinta la tarjeta. */
  alertas?: Alerta[];
}) {
  const notaContratado = (
    <>
      {vista.anterior ? (
        <Variacion
          actual={vista.contratadoUsd}
          anterior={vista.anterior.contratadoUsd}
          decimales={2}
        />
      ) : (
        "—"
      )}
      {vista.sinValorVendido > 0 ? (
        <span className="block">{num(vista.sinValorVendido)} sin valor vendido</span>
      ) : null}
    </>
  );

  return (
    <section id="pulso" className="scroll-mt-4 space-y-4">
      <h2 className="text-xl font-semibold">Pulso</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tarjeta
          titulo="Contratado"
          valor={
            <CifraConLista titulo="Contratado" detalle={detalles?.contratado}>
              {usd(vista.contratadoUsd)}
            </CifraConLista>
          }
          nota={notaContratado}
        />
        <CajaConVariacion vista={vista} detalles={detalles} />
        <Tarjeta
          titulo="Shows sin Grain"
          valor={
            <span className={vista.sinGrain.sinGrain > 0 ? "text-tono-peligro" : undefined}>
              <CifraConLista titulo="Shows sin Grain" detalle={detalles?.shows_sin_grain}>
                {num(vista.sinGrain.sinGrain)}
              </CifraConLista>
            </span>
          }
          nota={`${tasa(vista.sinGrain.pct)} de ${num(vista.sinGrain.shows)} shows`}
        />
        <Tarjeta
          titulo="Llamadas pasadas sin resultado"
          valor={
            <span className={vista.sinResultado > 0 ? "text-tono-peligro" : undefined}>
              <CifraConLista
                titulo="Llamadas pasadas sin resultado"
                detalle={detalles?.sin_resultado}
              >
                {num(vista.sinResultado)}
              </CifraConLista>
            </span>
          }
        />
        <Tarjeta
          titulo="Atendidos sin valor vendido"
          valor={
            <span className={vista.banderas.sinValor.cantidad > 0 ? "text-tono-peligro" : undefined}>
              <CifraConLista titulo="Atendidos sin valor vendido" detalle={detalles?.atendidos_sin_valor}>
                {num(vista.banderas.sinValor.cantidad)}
              </CifraConLista>
            </span>
          }
          nota={`${tasa(vista.banderas.sinValor.pct)} de ${num(vista.banderas.atendidos)} atendidos · a hoy`}
        />
        <Tarjeta
          titulo="Atendidos sin Grain"
          valor={
            <span className={vista.banderas.sinGrain.cantidad > 0 ? "text-tono-peligro" : undefined}>
              <CifraConLista titulo="Atendidos sin Grain" detalle={detalles?.atendidos_sin_grain}>
                {num(vista.banderas.sinGrain.cantidad)}
              </CifraConLista>
            </span>
          }
          nota={`${tasa(vista.banderas.sinGrain.pct)} de ${num(vista.banderas.atendidos)} atendidos · a hoy`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Cohorte vista={vista} />
        <MetaDelMes vista={vista} slug={slug} veEquipo={veEquipo} />
      </div>
      {alertas ? <Alertas alertas={alertas} slug={slug} configurable={veEquipo} /> : null}
    </section>
  );
}
