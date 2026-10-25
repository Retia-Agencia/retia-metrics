import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/format";
import type { ProyeccionDeCohorte, ValorDeProyeccion } from "@/lib/queries/proyeccion";

function Valor({ dato, sufijo = "" }: { dato: ValorDeProyeccion; sufijo?: string }) {
  return dato.valor === null ? (
    <><span className="cifra text-2xl font-semibold">—</span><p className="text-xs text-muted-foreground">{dato.razon}</p></>
  ) : (
    <span className="cifra text-2xl font-semibold">{num(dato.valor, 1)}{sufijo}</span>
  );
}

const fechaCorta = (fecha: string) => fecha.split("-").reverse().slice(0, 2).join("/");

export function Proyeccion({ datos }: { datos: ProyeccionDeCohorte }) {
  const origen = datos.supuestos.origenConversion === "objetivo_cohorte"
    ? "objetivo declarado de la cohorte"
    : datos.supuestos.origenConversion === "cohorte_anterior"
      ? `cohorte anterior completa (${datos.supuestos.cohorteAnteriorCodigo})`
      : "sin objetivo ni cohorte anterior con conversión";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proyección y requeridos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div><p className="text-xs text-muted-foreground">Ritmo</p><Valor dato={datos.ritmo} sufijo=" ventas/día" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Proyección de cierre</p>
            <Valor dato={datos.proyeccion} sufijo=" cupos" />
            {datos.cohorte ? <p className="text-xs text-muted-foreground">de {num(datos.cohorte.metaCupos)} cupos de meta</p> : null}
          </div>
          <div><p className="text-xs text-muted-foreground">Ventas requeridas/día</p><Valor dato={datos.ventasRequeridasDia} /></div>
          <div><p className="text-xs text-muted-foreground">Agendas requeridas/día</p><Valor dato={datos.agendasRequeridasDia} /></div>
          <div>
            <p className="text-xs text-muted-foreground">Leads contra su meta</p>
            <Valor dato={datos.leadsRequeridosDia} />
            {datos.cohorte?.metaLeadsDia != null ? <p className="text-xs text-muted-foreground">Meta declarada: {num(datos.cohorte.metaLeadsDia)} leads/día</p> : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ventana: últimos {num(datos.supuestos.ventanaDiasHabiles)} días hábiles ({fechaCorta(datos.supuestos.ventanaDesde)}–{fechaCorta(datos.supuestos.ventanaHasta)}). Conversión agenda → venta: {datos.supuestos.conversionAgendaVenta === null ? "—" : `${num(datos.supuestos.conversionAgendaVenta * 100, 1)} %`} ({origen}).
        </p>
        {datos.repartoSemanal.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">Lo que falta, desde mañana</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {datos.repartoSemanal.map((tramo) => (
                <div className="rounded-lg border p-3" key={tramo.desde}>
                  <p className="text-xs text-muted-foreground">{tramo.tipo === "resto_semana" ? "Resto de esta semana" : tramo.tipo === "final" ? "Días sueltos del final" : `Semana del ${fechaCorta(tramo.desde)}`}</p>
                  <p className="cifra text-lg font-semibold">{num(tramo.ventas, 1)} ventas</p>
                  <p className="text-xs text-muted-foreground">{num(tramo.diasHabiles)} {tramo.diasHabiles === 1 ? "día hábil" : "días hábiles"} · {fechaCorta(tramo.desde)}–{fechaCorta(tramo.hasta)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
