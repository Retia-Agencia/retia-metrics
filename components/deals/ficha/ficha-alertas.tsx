import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertasDelDeal } from "@/lib/queries/ficha-deal";
import type { RequisitoFaltante } from "@/lib/deals/requisitos";

const ANCLA_DE_REQUISITO: Record<RequisitoFaltante["codigo"], string> = {
  transicion_no_permitida: "campos",
  cohorte: "campos",
  dueno: "campos",
  actividad: "actividades",
  contacto: "actividades",
  llamada_con_fecha: "llamadas",
  llamada_sucedio: "llamadas",
  llamada_fallida: "llamadas",
  valor_vendido: "pago",
  area_declarada: "campos",
  fecha_limite_pago: "pago",
  cohorte_destino: "pago",
  fecha_seguimiento: "campos",
  abono: "pago",
  saldo_pendiente: "pago",
  saldo_en_cero: "pago",
  sin_abonos: "pago",
  motivo: "campos",
};

function Requisitos({ faltan }: { faltan: RequisitoFaltante[] }) {
  if (faltan.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {faltan.map((falta) => (
        <li key={falta.codigo}>
          <a
            href={`#${ANCLA_DE_REQUISITO[falta.codigo]}`}
            className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {falta.mensaje}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Destino({ destino }: { destino: AlertasDelDeal["paraAvanzar"][number] }) {
  return (
    <div>
      <p className="text-sm font-medium">
        {destino.faltan.length === 0
          ? `Listo para pasar a ${destino.nombreDestino}`
          : `Para pasar a ${destino.nombreDestino}`}
      </p>
      <Requisitos faltan={destino.faltan} />
    </div>
  );
}

export function FichaAlertas({ alertas }: { alertas: AlertasDelDeal | null }) {
  const feliz = alertas?.paraAvanzar.find((destino) => destino.caminoFeliz);
  // Se esconde solo cuando no queda nada: ni urgentes, ni aviso, ni una ruta con faltantes.
  const quedaAlgo = alertas != null && (alertas.propiedades.length > 0 || alertas.urgentes.length > 0 || alertas.aviso != null
    || alertas.paraAvanzar.some((destino) => destino.faltan.length > 0));
  const alternos = alertas?.paraAvanzar.filter((destino) => !destino.caminoFeliz) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!quedaAlgo ? <p className="text-sm text-muted-foreground">Nada pendiente</p> : null}
        {alertas && alertas.urgentes.length > 0 ? (
          <section className="rounded-lg bg-tono-peligro-suave p-3 text-tono-peligro">
            <Badge variant="peligro">Urgente</Badge>
            <ul className="mt-2 space-y-1 text-sm">
              {alertas.urgentes.map((alerta) => <li key={alerta.motivo}>{alerta.mensaje}</li>)}
            </ul>
          </section>
        ) : null}

        {alertas && alertas.propiedades.length > 0 ? (
          <section className="rounded-lg bg-tono-peligro-suave p-3 text-tono-peligro">
            <Badge variant="peligro">Le falta a su etapa</Badge>
            <Requisitos faltan={alertas.propiedades} />
          </section>
        ) : null}

        {alertas && quedaAlgo && (alertas.aviso || feliz || alternos.length > 0) ? (
          <section className="rounded-lg bg-tono-alerta-suave p-3 text-tono-alerta">
            <Badge variant="alerta">Para avanzar</Badge>
            {alertas.aviso ? <p className="mt-2 text-sm">{alertas.aviso}</p> : null}
            {feliz ? <div className="mt-3"><Destino destino={feliz} /></div> : null}
            {alternos.map((destino) => (
              <details key={destino.destino} className="mt-3">
                <summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Otra ruta: {destino.nombreDestino}
                </summary>
                <div className="mt-2"><Destino destino={destino} /></div>
              </details>
            ))}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
