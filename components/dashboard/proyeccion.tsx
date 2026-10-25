import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct } from "@/lib/format";
import type {
  ConversionElegida,
  ProyeccionDeCohorte,
  TramoSemanal,
  ValorDeProyeccion,
  VentanaRitmo,
} from "@/lib/queries/proyeccion";

/** Un enlace por ventana de ritmo; los arma la página con la URL actual (`?ritmo=`). */
export interface EnlaceDeVentana {
  dias: VentanaRitmo;
  href: string;
}

/** "27 oct", sin año: la tarjeta siempre habla de la cohorte en curso. */
const dia = (iso: string) => fecha(iso).replace(/ \d{4}$/, "");

/** "27 al 31 oct", "30 oct al 4 nov" o "4 nov". */
export function rangoLegible(desde: string, hasta: string): string {
  if (desde === hasta) return dia(desde);
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  return `${mismoMes ? String(Number(desde.slice(8))) : dia(desde)} al ${dia(hasta)}`;
}

const plural = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;

function nombreDelTramo(tramo: TramoSemanal): string {
  if (tramo.tipo === "resto_semana") return `Lo que queda de esta semana · ${rangoLegible(tramo.desde, tramo.hasta)}`;
  if (tramo.tipo === "final") return `Última semana, hasta el cierre · ${rangoLegible(tramo.desde, tramo.hasta)}`;
  return `Semana del ${rangoLegible(tramo.desde, tramo.hasta)}`;
}

const notaPendientes = (conversion: ConversionElegida) => conversion.muestra?.pendientes
  ? `; ${plural(conversion.muestra.pendientes, "cita sin resultado no cuenta", "citas sin resultado no cuentan")}`
  : "";

function origenDelCierre(conversion: ConversionElegida): string {
  const m = conversion.muestra!;
  return `medido en ${conversion.cohorteCodigo}: ${num(m.vendidos)} de ${plural(m.shows, "show compró", "shows compraron")}${conversion.madurando ? "; puede subir" : ""}`;
}

function origenDelShow(conversion: ConversionElegida): string {
  const m = conversion.muestra!;
  return `${num(m.shows)} de ${plural(m.personas, "persona con cita con resultado", "personas con cita con resultado")}${notaPendientes(conversion)}`;
}

function Paso({ dato, unidad, explicacion }: { dato: ValorDeProyeccion; unidad: string; explicacion: string | null }) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <p>
        <span className="cifra text-2xl font-semibold">{dato.valor === null ? "—" : num(dato.valor, 1)}</span>{" "}
        <span className="text-sm text-muted-foreground">{unidad}</span>
      </p>
      <p className="text-xs text-muted-foreground">{dato.valor === null ? dato.razon : explicacion}</p>
    </div>
  );
}

const Flecha = () => (
  <span aria-hidden className="hidden pt-1 text-xl text-muted-foreground sm:block">→</span>
);

export function Proyeccion({ datos, ventanas = [] }: { datos: ProyeccionDeCohorte; ventanas?: EnlaceDeVentana[] }) {
  const { supuestos, cohorte } = datos;
  if (!cohorte) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Proyección</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{datos.ritmo.razon}</p></CardContent>
      </Card>
    );
  }
  const conversion = supuestos.conversion;
  const rangoVentana = rangoLegible(supuestos.ventanaDesde, supuestos.ventanaHasta);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Proyección</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {datos.ritmo.valor === null ? (
            <p className="text-sm">
              <span className="cifra font-semibold">—</span> {datos.ritmo.razon}
            </p>
          ) : (
            <p className="text-base">
              Llevamos <span className="cifra font-semibold">{num(datos.ritmo.valor, 1)} ventas por día</span>
              {" → "}a este ritmo cerramos {cohorte.codigo} en{" "}
              <span className="cifra font-semibold">{num(datos.proyeccion.valor!)}</span> de {plural(cohorte.metaCupos, "cupo", "cupos")}.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              Ritmo: {plural(supuestos.ventasVentana, "venta", "ventas")} en {plural(supuestos.diasHabilesVentana, "día hábil", "días hábiles")} ({rangoVentana}
              {supuestos.ventanaRecortada ? ", desde que empezó la venta" : ""}). Contar los últimos
            </span>
            {ventanas.map((v) => (
              <Button
                key={v.dias}
                size="xs"
                variant={v.dias === supuestos.ventanaDiasHabiles ? "secondary" : "ghost"}
                nativeButton={false}
                aria-current={v.dias === supuestos.ventanaDiasHabiles ? "true" : undefined}
                render={<Link href={v.href} scroll={false} />}
              >
                {v.dias}
              </Button>
            ))}
            <span>días hábiles.</span>
          </div>
        </div>

        {datos.faltan === 0 ? (
          <p className="text-sm">Ya se vendieron los {num(cohorte.metaCupos)} cupos de {cohorte.codigo}.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Para llegar a {num(cohorte.metaCupos)} faltan {plural(datos.faltan, "venta", "ventas")}, y hacen falta por día hábil:
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
              <Paso
                dato={datos.ventasRequeridasDia}
                unidad="ventas"
                explicacion={`${plural(datos.faltan, "venta", "ventas")} ÷ ${plural(datos.diasHabilesRestantes, "día hábil", "días hábiles")} hasta el cierre (${dia(cohorte.fechaCierreVentas)})`}
              />
              <Flecha />
              <Paso
                dato={datos.showsRequeridosDia}
                unidad="shows"
                explicacion={conversion.pctCierre !== null
                  ? `${pct(conversion.pctCierre)} de los shows termina en venta (${origenDelCierre(conversion)})`
                  : conversion.objetivoAgendaAVenta !== null && conversion.pctShow !== null
                    ? `${pct(conversion.pctShow)} de las agendas llega al show (${origenDelShow(conversion)})`
                    : null}
              />
              <Flecha />
              <Paso
                dato={datos.agendasRequeridasDia}
                unidad="agendas"
                explicacion={conversion.objetivoAgendaAVenta !== null
                  ? `${pct(conversion.objetivoAgendaAVenta)} de las agendas termina en venta (según el objetivo de la cohorte)`
                  : conversion.pctShow === null ? null : `${pct(conversion.pctShow)} de las agendas llega al show (${origenDelShow(conversion)})`}
              />
              <Flecha />
              <Paso
                dato={datos.leadsRequeridosDia}
                unidad="leads"
                explicacion={supuestos.agendasPorRegistro === null ? null : `${pct(supuestos.agendasPorRegistro)} de los leads agenda (${plural(supuestos.agendasVentana, "agenda", "agendas")} de ${plural(supuestos.registrosVentana, "lead", "leads")}, ${rangoVentana})${cohorte.metaLeadsDia != null ? ` · meta declarada: ${num(cohorte.metaLeadsDia)} leads por día` : ""}`}
              />
            </div>
          </div>
        )}

        {datos.repartoSemanal.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Cómo repartir las {plural(datos.faltan, "venta", "ventas")} que faltan</p>
            <ul className="divide-y rounded-lg border">
              {datos.repartoSemanal.map((tramo) => (
                <li className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm" key={tramo.desde}>
                  <span className="min-w-0">
                    {nombreDelTramo(tramo)}
                    <span className="block text-xs text-muted-foreground">{plural(tramo.diasHabiles, "día hábil", "días hábiles")}</span>
                  </span>
                  <span className="cifra shrink-0 font-semibold">{num(tramo.ventas, 1)} ventas</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
