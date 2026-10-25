import type { ReactNode } from "react";
import Link from "next/link";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Alertas } from "@/components/dashboard/alertas";
import { Comparativo } from "@/components/dashboard/operacion";
import { Proyeccion, type EnlaceDeVentana } from "@/components/dashboard/proyeccion";
import { Caja, Tabla, Tarjeta, tasa } from "@/components/dashboard/piezas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monto, num } from "@/lib/format";
import { enlaceConVueltaAFragmento } from "@/lib/navegacion/volver";
import type { ConfigurarMetas } from "@/components/metas/metas-del-mes";
import type { Alerta } from "@/lib/queries/alertas";
import { nombreDelMes } from "@/lib/queries/metas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { CajaDelDiaPorOrigen, ClaveDeHorizonte, ContextoDelDia, Horizonte } from "@/lib/queries/vista-hoy";
import type { DetalleDeCifra, DetallesDeOperacion, DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import type { ShowPorCita } from "@/lib/queries/tasa-show-por-cita";
import type { ProyeccionDeCohorte } from "@/lib/queries/proyeccion";

/**
 * Hub › Hoy (ticket 252, ADR 0086 punto 3): el reporte diario armado con lo que el CRM ya calcula,
 * en el orden del reporte del 15-sep. Todo es de HOY, sin importar el periodo elegido: la vista llega
 * ya armada con el día de hoy y este componente no calcula ninguna cifra.
 */

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** 1. La línea de contexto: en qué día hábil vamos de la semana, del mes y de la cohorte. */
function LineaDeContexto({ contexto }: { contexto: ContextoDelDia }) {
  const partes = [
    `Semana: día ${num(contexto.semana.dia)} de ${num(contexto.semana.total)}`,
    `${mayuscula(nombreDelMes(contexto.mes.mes).split(" ")[0])}: día ${num(contexto.mes.dia)} de ${num(contexto.mes.total)} hábiles`,
    contexto.cohorte
      ? `Cohorte ${contexto.cohorte.codigo}: día ${num(contexto.cohorte.dia)} de ${num(contexto.cohorte.total)}`
      : "Sin cohorte con ventana de ventas",
  ];
  return <p className="text-sm text-muted-foreground">{partes.join(" · ")}</p>;
}

const NOMBRE_DEL_HORIZONTE: Record<ClaveDeHorizonte, { titulo: string; meta: string }> = {
  dia: { titulo: "Hoy", meta: "meta dinámica" },
  semana: { titulo: "Semana", meta: "meta de la semana" },
  cohorte: { titulo: "Cohorte", meta: "meta de la cohorte" },
  mes: { titulo: "Mes", meta: "meta del mes" },
};

/** 2. Los cupos del día, la semana, la cohorte y el mes: meta, real y cumplimiento. */
function Cupos({ horizontes, detalles, configurar }: { horizontes: Horizonte[]; detalles?: DetallesDelDashboard; configurar: ConfigurarMetas }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Cupos vendidos</CardTitle>
        {configurar ? (
          <Button
            size="sm"
            variant="link"
            nativeButton={false}
            render={<Link href={enlaceConVueltaAFragmento(configurar.hrefBase, configurar.origen, "cohortes")} />}
          >
            Configurar
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {horizontes.map((h) => {
          const nombre = NOMBRE_DEL_HORIZONTE[h.clave];
          const real = num(h.real);
          return (
            <div key={h.clave} className="space-y-1">
              <p className="text-xs text-muted-foreground">{nombre.titulo}</p>
              <p className="cifra text-2xl font-semibold">
                {/* Las ventas de hoy abren su lista; las demás viven en las metas de abajo. */}
                {h.clave === "dia" ? <CifraConLista titulo="Ventas de hoy" detalle={detalles?.cierres}>{real}</CifraConLista> : real}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}/ {h.meta === null ? "—" : num(h.meta, h.clave === "dia" ? 1 : 0)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {h.meta === null ? `sin ${nombre.meta}` : `${nombre.meta} · cumplimiento ${tasa(h.cumplimiento)}`}
              </p>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">
          La meta de hoy es lo que falta de la cohorte repartido en sus días hábiles que quedan. El cumplimiento de la
          cohorte y del mes es contra lo esperado a hoy.
        </p>
      </CardContent>
    </Card>
  );
}

/** 3. La operación del día: el embudo de hoy y, si la sesión ve al equipo, cada closer. */
function OperacionDelDia({ vista, registros, detalleRegistros, agendasCreadas, detalleAgendasCreadas, showPorCita, detalleCitasDebidas, detalles, detallesOperacion, veEquipo }: {
  vista: VistaDelDashboard;
  registros: number;
  detalleRegistros?: DetalleDeCifra;
  agendasCreadas: number;
  detalleAgendasCreadas?: DetalleDeCifra;
  showPorCita: ShowPorCita;
  detalleCitasDebidas?: DetalleDeCifra;
  detalles?: DetallesDelDashboard;
  detallesOperacion?: DetallesDeOperacion;
  veEquipo: boolean;
}) {
  const { embudo } = vista;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tarjeta titulo="Leads de hoy" valor={
          <CifraConLista titulo="Leads de hoy" detalle={detalleRegistros}>{num(registros)}</CifraConLista>
        } nota="Registros del día · los que hacen falta por día están en Proyección" />
        <Tarjeta titulo="Agendas creadas hoy" valor={
          <CifraConLista titulo="Agendas creadas hoy" detalle={detalleAgendasCreadas}>{num(agendasCreadas)}</CifraConLista>
        } nota="Llamadas agendadas hoy, para la cita que sea" />
        <Tarjeta titulo="Citas de hoy" valor={
          <CifraConLista titulo="Citas de hoy" detalle={detalles?.agendas}>{num(embudo.agendas)}</CifraConLista>
        } nota="Por la fecha de la cita" />
        <Tarjeta titulo="Realizadas (show)" valor={
          <CifraConLista titulo="Llamadas realizadas hoy" detalle={detalles?.shows}>{num(embudo.llamadasConShow)}</CifraConLista>
        } nota={<>
          <span className="block">{`% de show ${tasa(embudo.pctShow)} por deal: ${num(embudo.grupo.conShow)} de ${num(embudo.grupo.deals)} deals con cita ocurrida${embudo.reagendadas > 0 ? ` · ${num(embudo.reagendadas)} reagendadas (no cuentan)` : ""}`}</span>
          <span className="block">
            {`% de show ${tasa(showPorCita.porcentaje)} por cita: ${num(showPorCita.realizadas)} de `}
            <CifraConLista titulo="Citas de hoy que ya debían ocurrir" detalle={detalleCitasDebidas}>{num(showPorCita.citasQueYaDebianOcurrir)}</CifraConLista>
            {" citas que ya debían ocurrir"}
          </span>
        </>} />
        <Tarjeta titulo="Ventas de hoy" valor={
          <CifraConLista titulo="Ventas de hoy" detalle={detalles?.cierres}>{num(embudo.cierres)}</CifraConLista>
        } nota={`% de cierre ${tasa(embudo.pctCierre)}`} />
      </div>
      {embudo.madurando ? (
        <p className="text-xs text-muted-foreground">
          El % de show y el % de cierre van sobre las citas de hoy: todavía pueden subir en los próximos días.
        </p>
      ) : null}
      {veEquipo ? <Comparativo vista={vista} detalles={detallesOperacion?.comparativo} titulo="Hoy por closer" /> : null}
    </div>
  );
}

/** 4. La caja de hoy, por moneda, y de dónde viene cada abono. */
function CajaDelDia({ caja, detalles }: { caja: CajaDelDiaPorOrigen[]; detalles?: DetallesDelDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recaudado hoy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="cifra text-2xl font-semibold">
          <CifraConLista titulo="Recaudado hoy" detalle={detalles?.caja}>
            <Caja caja={caja.length === 0 ? [{ moneda: "USD", total: 0 }] : caja} />
          </CifraConLista>
        </div>
        {caja.length > 0 ? (
          <Tabla cabeceras={["Moneda", "De ventas de hoy", "Completan ventas anteriores"]}>
            {caja.map((fila) => (
              <tr key={fila.moneda}>
                <td className="py-2">{fila.moneda}</td>
                <td className="cifra py-2 text-right">{monto(fila.deVentasDeHoy, fila.moneda)}</td>
                <td className="cifra py-2 text-right">{monto(fila.deVentasAnteriores, fila.moneda)}</td>
              </tr>
            ))}
          </Tabla>
        ) : (
          <p className="text-muted-foreground">Hoy no se ha registrado ningún abono.</p>
        )}
        <p className="text-xs text-muted-foreground">Suma de abonos por su fecha, por moneda. Nunca se convierte.</p>
      </CardContent>
    </Card>
  );
}

/** 5. Las banderas rojas (lo que era el Pulso) y las alertas por persistencia. */
function Banderas({ vista, detalles }: { vista: VistaDelDashboard; detalles?: DetallesDelDashboard }) {
  const bandera = (titulo: string, cantidad: number, detalle: DetallesDelDashboard[keyof DetallesDelDashboard] | undefined, nota?: string) => (
    <Tarjeta titulo={titulo} nota={nota} valor={
      <span className={cantidad > 0 ? "text-tono-peligro" : undefined}>
        <CifraConLista titulo={titulo} detalle={detalle}>{num(cantidad)}</CifraConLista>
      </span>
    } />
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {bandera("Shows sin Grain", vista.sinGrain.sinGrain, detalles?.shows_sin_grain,
        `${tasa(vista.sinGrain.pct)} de ${num(vista.sinGrain.shows)} shows de hoy`)}
      {bandera("Llamadas pasadas sin resultado", vista.sinResultado, detalles?.sin_resultado)}
      {bandera("Atendidos sin valor vendido", vista.banderas.sinValor.cantidad, detalles?.atendidos_sin_valor,
        `${tasa(vista.banderas.sinValor.pct)} de ${num(vista.banderas.atendidos)} atendidos · a hoy`)}
      {bandera("Atendidos sin Grain", vista.banderas.sinGrain.cantidad, detalles?.atendidos_sin_grain,
        `${tasa(vista.banderas.sinGrain.pct)} de ${num(vista.banderas.atendidos)} atendidos · a hoy`)}
    </div>
  );
}

/** 6. Lo que el reporte diario pide y el CRM todavía no calcula: se dice, no se muestra un cero. */
function LoQueViene() {
  const piezas = [
    ["Cómo nació cada venta", "Si salió de la agenda del día, de un seguimiento o sin llamada."],
    ["Acciones abiertas", "Los planes de acción con su dueño y su estado."],
  ];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Lo que viene</CardTitle>
        <Badge variant="neutro">Se está construyendo</Badge>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          {piezas.map(([titulo, texto]) => (
            <li key={titulo}>
              <p className="font-medium">{titulo}</p>
              <p className="text-muted-foreground">{texto}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function Hoy({
  vista,
  contexto,
  horizontes,
  proyeccion,
  ventanasRitmo,
  caja,
  registros,
  detalleRegistros,
  agendasCreadas,
  detalleAgendasCreadas,
  showPorCita,
  detalleCitasDebidas,
  detalles,
  detallesOperacion,
  alertas,
  slug,
  veEquipo,
  configurar,
  metas,
}: {
  /** La vista armada con el periodo de HOY (no con el que venga en la URL). */
  vista: VistaDelDashboard;
  contexto: ContextoDelDia;
  horizontes: Horizonte[];
  proyeccion: ProyeccionDeCohorte;
  /** Los enlaces para cambiar la ventana del ritmo (`?ritmo=`); los arma la página. */
  ventanasRitmo?: EnlaceDeVentana[];
  caja: CajaDelDiaPorOrigen[];
  registros: number;
  detalleRegistros?: DetalleDeCifra;
  agendasCreadas: number;
  detalleAgendasCreadas?: DetalleDeCifra;
  showPorCita: ShowPorCita;
  detalleCitasDebidas?: DetalleDeCifra;
  detalles?: DetallesDelDashboard;
  detallesOperacion?: DetallesDeOperacion;
  alertas: Alerta[];
  slug: string;
  /** Sin equipo comercial (paid trafficker): sin el comparativo por closer ni la configuración de alertas. */
  veEquipo: boolean;
  configurar: ConfigurarMetas;
  /** Las metas del mes con sus flechas (lo que era la página Metas); las arma la página. */
  metas: ReactNode;
}) {
  return (
    <section id="hoy" className="scroll-mt-4 space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Hoy</h2>
        <LineaDeContexto contexto={contexto} />
      </div>
      <Cupos horizontes={horizontes} detalles={detalles} configurar={configurar} />
      <Proyeccion datos={proyeccion} ventanas={ventanasRitmo} />
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">La operación de hoy</h3>
        <OperacionDelDia
          vista={vista}
          registros={registros}
          detalleRegistros={detalleRegistros}
          agendasCreadas={agendasCreadas}
          detalleAgendasCreadas={detalleAgendasCreadas}
          showPorCita={showPorCita}
          detalleCitasDebidas={detalleCitasDebidas}
          detalles={detalles}
          detallesOperacion={detallesOperacion}
          veEquipo={veEquipo}
        />
      </section>
      <CajaDelDia caja={caja} detalles={detalles} />
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Lo que pide atención</h3>
        <Banderas vista={vista} detalles={detalles} />
        <Alertas alertas={alertas} slug={slug} configurable={veEquipo} />
      </section>
      <LoQueViene />
      {metas}
    </section>
  );
}
