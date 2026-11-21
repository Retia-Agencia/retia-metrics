"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usd } from "@/lib/format";
import type { LineaDeDealVisible } from "@/lib/queries/lineas-de-deal";
import { asignarSkuAccion, anularLineaAccion, editarValorLineaAccion, quitarLineaAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";

type SkuActivo = { id: string; nombre: string; codigo: string; precioListaUsd: string };

export function FichaSkus({ dealId, lineas, skus, puedeTrabajar }: {
  dealId: string;
  lineas: LineaDeDealVisible[];
  skus: SkuActivo[];
  puedeTrabajar: boolean;
}) {
  const router = useRouter();
  const [skuId, setSkuId] = useState(skus[0]?.id ?? "");
  const [pendiente, setPendiente] = useState(false);
  async function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    setPendiente(true);
    const resultado = await accion();
    setPendiente(false);
    if (!resultado.ok) return toast.error(resultado.error ?? "No se pudo guardar.");
    toast.success(exito);
    router.refresh();
  }
  return <Card id="skus" className="scroll-mt-24">
    <CardHeader><CardTitle>SKUs</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {lineas.length === 0 ? <p className="text-sm text-muted-foreground">Sin SKU.</p> : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground"><tr>
              {['SKU', 'Ciclo', 'Lista', 'Vendido', 'Recaudado', 'Por cobrar', 'Estado', 'Acciones'].map((x) => <th key={x} className="px-3 py-2 font-medium">{x}</th>)}
            </tr></thead>
            <tbody className="divide-y">{lineas.map((linea) => <tr key={linea.id} className={linea.estado === "anulada" ? "opacity-50" : undefined}>
              <td className="px-3 py-2"><span className="font-medium">{linea.skuNombre}</span><br/><span className="font-mono text-xs">{linea.skuCodigo}</span></td>
              <td className="px-3 py-2">{linea.cohorte}</td>
              <td className="px-3 py-2 whitespace-nowrap">{usd(linea.precioListaUsd)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{usd(linea.valorVendidoUsd)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{usd(linea.recaudadoUsd)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{linea.porCobrarUsd == null ? "—" : usd(linea.porCobrarUsd)}</td>
              <td className="px-3 py-2"><Badge variant={linea.estado === "vendida" ? "secondary" : "outline"}>{linea.estado}</Badge></td>
              <td className="px-3 py-2">{puedeTrabajar && linea.estado !== "anulada" ? <div className="flex gap-1">
                <Button size="xs" variant="ghost" disabled={pendiente} onClick={() => {
                  const valor = window.prompt("Valor vendido USD", String(linea.valorVendidoUsd));
                  if (valor == null || !Number.isFinite(Number(valor))) return;
                  void ejecutar(() => editarValorLineaAccion({ dealId, lineaId: linea.id, valorVendidoUsd: Number(valor) }), "Valor actualizado");
                }}>Editar valor</Button>
                <Button size="xs" variant="ghost" disabled={pendiente} onClick={() => void ejecutar(
                  () => linea.abonosVigentes > 0 ? anularLineaAccion({ dealId, lineaId: linea.id }) : quitarLineaAccion({ dealId, lineaId: linea.id }),
                  linea.abonosVigentes > 0 ? "Línea anulada" : "Línea quitada",
                )}>{linea.abonosVigentes > 0 ? "Anular" : "Quitar"}</Button>
              </div> : null}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      {puedeTrabajar ? <div className="flex flex-wrap items-center gap-2">
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value={skuId} onChange={(e) => setSkuId(e.target.value)}>
          {skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.nombre} · {sku.codigo} · {usd(Number(sku.precioListaUsd))}</option>)}
        </select>
        <Button size="sm" disabled={pendiente || !skuId} onClick={() => void ejecutar(() => asignarSkuAccion({ dealId, skuId }), "SKU asignado")}>Asignar SKU</Button>
      </div> : null}
    </CardContent>
  </Card>;
}
