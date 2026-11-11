"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fecha, fechaHoraEnBogota, monto, pct, saldoLegible, usd } from "@/lib/format";
import type { PagosDeStudent } from "@/lib/queries/pagos-de-students";

export function PagosDeStudentCelda({
  nombre,
  pagos,
  slug,
}: {
  nombre: string;
  pagos: PagosDeStudent;
  slug: string;
}) {
  const abonosVigentes = pagos.abonos.filter((abono) => abono.anuladoEn == null).length;
  const etiqueta = abonosVigentes === 0
    ? "Sin abonos"
    : `${abonosVigentes} ${abonosVigentes === 1 ? "abono" : "abonos"}`;
  const saldo = saldoLegible(pagos.saldo.saldo, pagos.saldo.moneda ?? "USD", pagos.saldo.sinSaldoPorque);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {etiqueta}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagos de {nombre}</DialogTitle>
          <DialogDescription>Detalle de la venta y todos sus abonos.</DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
          <Resumen etiqueta="Valor vendido" valor={pagos.valorVendidoUsd == null ? "Sin definir" : usd(pagos.valorVendidoUsd)} cifra={pagos.valorVendidoUsd != null} />
          <Resumen
            etiqueta="Descuento"
            valor={pagos.descuento ? `${usd(pagos.descuento.usd)} (${pct(pagos.descuento.porcentaje)})` : "Sin definir"}
            cifra={pagos.descuento != null}
          />
          <Resumen etiqueta="Abonado" valor={monto(pagos.saldo.abonado, pagos.saldo.moneda ?? "USD")} cifra />
          <Resumen etiqueta="Saldo" valor={saldo.valor} cifra={saldo.esCifra} />
          <Resumen etiqueta="Acuerdo de pago" valor={pagos.acuerdoPago ?? "Sin definir"} />
          <Resumen etiqueta="Fecha límite" valor={pagos.fechaLimitePago ? fecha(pagos.fechaLimitePago) : "Sin definir"} cifra={pagos.fechaLimitePago != null} />
        </dl>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Abonos</h3>
          {pagos.abonos.length === 0 ? (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">Aún no hay abonos.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {pagos.abonos.map((abono) => {
                const anulado = abono.anuladoEn != null;
                return (
                  <li key={abono.id} className={`space-y-2 p-4 text-sm ${anulado ? "text-muted-foreground" : ""}`}>
                    <div className={`flex flex-wrap items-center gap-2 ${anulado ? "line-through" : ""}`}>
                      <span className="cifra font-medium">{monto(Number(abono.monto), abono.moneda)}</span>
                      <span className="cifra text-xs text-muted-foreground">{fecha(abono.fecha)}</span>
                      {abono.concepto === "adicional" ? <Badge variant="info">Adicional</Badge> : null}
                      {anulado ? <Badge variant="peligro">Anulado</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {abono.plataformaNombre ? <span>Plataforma: {abono.plataformaNombre}</span> : null}
                      {abono.enlacePagoNombre ? <span>Enlace de pago: {abono.enlacePagoNombre}</span> : null}
                      {abono.registradoPorNombre ? <span>Registrado por: {abono.registradoPorNombre}</span> : null}
                    </div>
                    {abono.nota ? <p className="text-xs">Nota: {abono.nota}</p> : null}
                    <div className="flex flex-wrap items-center gap-2">
                      {abono.comprobanteArchivoId ? (
                        <a
                          className="text-xs text-marca-texto underline-offset-2 hover:underline"
                          href={`/p/${slug}/archivos/${abono.comprobanteArchivoId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver comprobante
                        </a>
                      ) : abono.comprobanteUrl ? (
                        <a className="text-xs text-marca-texto underline-offset-2 hover:underline" href={abono.comprobanteUrl} target="_blank" rel="noreferrer">
                          Ver comprobante
                        </a>
                      ) : (
                        <Badge variant="alerta">Sin comprobante</Badge>
                      )}
                    </div>
                    {anulado ? (
                      <p className="text-xs">
                        Anulado el {fechaHoraEnBogota(abono.anuladoEn!)}
                        {abono.anuladoPorNombre ? ` por ${abono.anuladoPorNombre}` : ""}
                        {abono.motivoAnulacion ? `. Motivo: ${abono.motivoAnulacion}` : ""}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Resumen({ etiqueta, valor, cifra = false }: { etiqueta: string; valor: string; cifra?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className={cifra ? "cifra font-medium" : "font-medium"}>{valor}</dd>
    </div>
  );
}
