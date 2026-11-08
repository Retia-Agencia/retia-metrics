import { CifraConLista } from "@/components/cifra-con-lista";
import { Alertas } from "@/components/dashboard/alertas";
import { tasa } from "@/components/dashboard/piezas";
import { Card, CardContent } from "@/components/ui/card";
import { num } from "@/lib/format";
import type { Alerta } from "@/lib/queries/alertas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { DetalleDeCifra, DetallesDelDashboard } from "@/lib/queries/vista-metrica";

function Pendiente({ titulo, cantidad, detalle, nota, alerta }: { titulo: string; cantidad: number; detalle?: DetalleDeCifra; nota?: string; alerta?: boolean }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className={`cifra text-xl font-semibold ${alerta && cantidad > 0 ? "text-tono-peligro" : ""}`}>
        <CifraConLista titulo={titulo} detalle={detalle}>{num(cantidad)}</CifraConLista>
      </div>
      {nota ? <div className="text-xs text-muted-foreground">{nota}</div> : null}
    </div>
  );
}

/**
 * Alertas y pendientes (378): lo que pide atención hoy, las citas de mañana y las alertas por persistencia,
 * en UNA tarjeta. Solo los pendientes con casos se dibujan; los que están en cero se dicen en una línea.
 */
export function Pendientes({ vista, detalles, citasDeManana, detalleManana, alertas, slug, veEquipo }: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  citasDeManana: number;
  detalleManana?: DetalleDeCifra;
  alertas: Alerta[];
  slug: string;
  veEquipo: boolean;
}) {
  const banderas = [
    { titulo: "Realizadas sin Grain", cantidad: vista.sinGrain.sinGrain, detalle: detalles?.shows_sin_grain, nota: `${tasa(vista.sinGrain.pct)} de ${num(vista.sinGrain.shows)} realizadas hoy` },
    { titulo: "Llamadas pasadas sin resultado", cantidad: vista.sinResultado, detalle: detalles?.sin_resultado },
    { titulo: "Atendidos sin valor vendido", cantidad: vista.banderas.sinValor.cantidad, detalle: detalles?.atendidos_sin_valor, nota: `${tasa(vista.banderas.sinValor.pct)} de ${num(vista.banderas.atendidos)} atendidos` },
    { titulo: "Atendidos sin Grain", cantidad: vista.banderas.sinGrain.cantidad, detalle: detalles?.atendidos_sin_grain, nota: `${tasa(vista.banderas.sinGrain.pct)} de ${num(vista.banderas.atendidos)} atendidos` },
    { titulo: "Cierre perdido con pagos registrados", cantidad: vista.banderas.perdidosConPagos.cantidad, detalle: detalles?.perdidos_con_pagos, nota: "Plata cobrada sobre una venta perdida" },
  ];
  const conCasos = banderas.filter((b) => b.cantidad > 0);
  const enCero = banderas.filter((b) => b.cantidad === 0);
  return (
    <Card className="no-partir print:hidden">
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Pendiente titulo="Citas de mañana" cantidad={citasDeManana} detalle={detalleManana} nota="Por la fecha de la cita" />
          {conCasos.map((b) => <Pendiente key={b.titulo} {...b} alerta />)}
        </div>
        {enCero.length > 0 ? <p className="text-xs text-muted-foreground">Sin pendientes: {enCero.map((b) => b.titulo.toLocaleLowerCase("es")).join(", ")}.</p> : null}
        <Alertas alertas={alertas} slug={slug} configurable={veEquipo} sinTarjeta />
      </CardContent>
    </Card>
  );
}
