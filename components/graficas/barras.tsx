import type { ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { num, pct } from "@/lib/format";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";

const CLASE_POR_TONO = {
  primario: "bg-primary",
  info: "bg-tono-info",
  alerta: "bg-tono-alerta",
  peligro: "bg-tono-peligro",
  exito: "bg-tono-exito",
} as const;

const TONOS_DEL_EMBUDO = [
  CLASE_POR_TONO.primario,
  CLASE_POR_TONO.info,
  CLASE_POR_TONO.alerta,
  CLASE_POR_TONO.peligro,
  CLASE_POR_TONO.exito,
] as const;

export type TonoDeBarra = keyof typeof CLASE_POR_TONO;

export function LeyendaDeBarras({
  items,
}: {
  items: readonly { etiqueta: string; tono: TonoDeBarra }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={`${item.etiqueta}:${item.tono}`} className="inline-flex items-center gap-1.5">
          <span className={`size-2.5 rounded-sm ${CLASE_POR_TONO[item.tono]}`} aria-hidden="true" />
          {item.etiqueta}
        </span>
      ))}
    </div>
  );
}

function Abrible({ titulo, detalle, children }: { titulo: string; detalle?: DetalleDeCifra; children: ReactNode }) {
  return (
    <CifraConLista titulo={titulo} detalle={detalle}>
      {children}
    </CifraConLista>
  );
}

export interface PasoDeBarra {
  clave: string;
  etiqueta: string;
  cantidad: number;
  detalle?: DetalleDeCifra;
  pctDelPaso?: number | null;
  etiquetaDelPct?: string;
  perdidos?: { cantidad: number; detalle?: DetalleDeCifra };
}

export function EmbudoDeBarras({ pasos }: { pasos: PasoDeBarra[] }) {
  const maximo = Math.max(1, ...pasos.map((paso) => paso.cantidad));
  return (
    <div className="space-y-3">
      {pasos.map((paso, indice) => (
        <div key={paso.clave} className="space-y-1">
          {paso.pctDelPaso === undefined ? null : (
            <p className="text-center text-xs text-muted-foreground">
              {paso.pctDelPaso === null ? "—" : pct(paso.pctDelPaso)} {paso.etiquetaDelPct ?? "del paso anterior"}
            </p>
          )}
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm">{paso.etiqueta}</span>
            {paso.cantidad === 0 ? (
              <span className="cifra flex-1 text-sm text-muted-foreground">0</span>
            ) : <div className="h-8 flex-1 rounded-md bg-muted">
              <span
                className={
                  "flex h-8 items-center justify-end rounded-md px-2 text-sm text-primary-foreground " +
                  `[&>button]:h-full [&>button]:w-full ${TONOS_DEL_EMBUDO[indice % TONOS_DEL_EMBUDO.length]}`
                }
                style={{ width: `${paso.cantidad === 0 ? 0 : Math.max(6, (paso.cantidad / maximo) * 100)}%` }}
              >
                <Abrible titulo={paso.etiqueta} detalle={paso.detalle}>
                  <span className="cifra">{num(paso.cantidad)}</span>
                </Abrible>
              </span>
            </div>}
          </div>
          {paso.perdidos && paso.perdidos.cantidad > 0 ? (
            <p className="pl-32 text-xs text-muted-foreground">
              Se perdieron:{" "}
              <Abrible titulo={`Se perdieron después de ${paso.etiqueta}`} detalle={paso.perdidos.detalle}>
                <span className="cifra">{num(paso.perdidos.cantidad)}</span>
              </Abrible>
            </p>
          ) : null}
        </div>
      ))}
      <div className="sr-only"><table>
        <caption>Embudo comercial</caption>
        <thead>
          <tr>
            <th>Paso</th>
            <th>Cantidad</th>
            <th>Porcentaje del paso anterior</th>
            <th>Se perdieron</th>
          </tr>
        </thead>
        <tbody>
          {pasos.map((paso) => (
            <tr key={paso.clave}>
              <th>{paso.etiqueta}</th>
              <td>{paso.cantidad}</td>
              <td>{paso.pctDelPaso == null ? "" : pct(paso.pctDelPaso)}</td>
              <td>{paso.perdidos?.cantidad ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

export interface SegmentoDeBarra {
  clave: string;
  etiqueta: string;
  cantidad: number;
  tono: TonoDeBarra;
  detalle?: DetalleDeCifra;
}

export function BarraApilada100({ segmentos }: { segmentos: SegmentoDeBarra[] }) {
  const total = segmentos.reduce((suma, segmento) => suma + segmento.cantidad, 0);
  return (
    <div className="space-y-2">
      {total === 0 ? <p className="text-sm text-muted-foreground">Sin casos.</p> : <div
        className="flex h-9 w-full overflow-hidden rounded-md bg-muted"
        role="group"
        aria-label="Distribución al cien por ciento"
      >
        {segmentos
          .filter((segmento) => segmento.cantidad > 0)
          .map((segmento) => {
            const porcentaje = total === 0 ? null : segmento.cantidad / total;
            const descripcion = `${segmento.etiqueta}: ${num(segmento.cantidad)} · ${
              porcentaje === null ? "—" : pct(porcentaje, 0)
            }`;
            return (
              <span
                key={segmento.clave}
                className={`h-9 text-primary-foreground [&>button]:h-full [&>button]:w-full ${
                  CLASE_POR_TONO[segmento.tono]
                }`}
                style={{ width: `${total === 0 ? 0 : (segmento.cantidad / total) * 100}%` }}
                title={descripcion}
                role="group"
                aria-label={descripcion}
              >
                <Abrible titulo={segmento.etiqueta} detalle={segmento.detalle}>
                  <span className="cifra flex h-9 w-full items-center justify-center px-2 text-xs">
                    {num(segmento.cantidad)}
                  </span>
                </Abrible>
              </span>
            );
          })}
      </div>}
      <div className="sr-only"><table>
        <caption>Distribución</caption>
        <thead>
          <tr>
            <th>Segmento</th>
            <th>Cantidad</th>
            <th>Porcentaje</th>
          </tr>
        </thead>
        <tbody>
          {segmentos.map((segmento) => (
            <tr key={segmento.clave}>
              <th>{segmento.etiqueta}</th>
              <td>{segmento.cantidad}</td>
              <td>{total === 0 ? "" : pct(segmento.cantidad / total)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

export function BarrasHorizontales({
  filas,
}: {
  filas: { clave: string; etiqueta: string; valor: number; texto: string; detalle?: DetalleDeCifra }[];
}) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.valor));
  return (
    <div className="space-y-2">
      {filas.map((fila) => (
        <div key={fila.clave} className="grid grid-cols-[minmax(7rem,1fr)_2fr_auto] items-center gap-2 text-sm">
          <span>{fila.etiqueta}</span>
          {fila.valor <= 0 ? <span aria-hidden="true" /> : <div className="h-3 rounded-full bg-muted">
            <span
              className="block h-3 rounded-full bg-primary"
              style={{ width: `${Math.max(0, (fila.valor / maximo) * 100)}%` }}
            />
          </div>}
          <Abrible titulo={fila.etiqueta} detalle={fila.detalle}>
            <span className="cifra">{fila.texto}</span>
          </Abrible>
        </div>
      ))}
      <div className="sr-only"><table>
        <caption>Barras horizontales</caption>
        <thead>
          <tr>
            <th>Fila</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.clave}>
              <th>{fila.etiqueta}</th>
              <td>{fila.texto}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
