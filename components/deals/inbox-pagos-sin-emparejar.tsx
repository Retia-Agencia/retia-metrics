"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { asignarCompraAccion, buscarLeadsParaPagoAccion } from "@/app/(app)/p/[programa]/inbox/acciones";
import { monto, fechaHoraEnBogota } from "@/lib/format";
import { motivoDeRevision } from "@/lib/pagos/motivos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Pago = { id: string; estado: "sin_emparejar"|"en_revision"|"emparejada"; motivoRevision: string|null; nombre:string|null; correo:string|null; telefono:string|null; monto:string|null; moneda:string|null; createdAt:Date };
export function InboxPagosSinEmparejar({ filas, programId }: { filas: Pago[]; programId: string }) {
  const [resultados, setResultados] = useState<Record<string, {id:string; nombre:string|null; emailNormalizado:string}[]>>({});
  const [pendiente, iniciar] = useTransition(); const router = useRouter();
  const buscar = (compraId:string, q:string) => iniciar(async()=>{ const r=await buscarLeadsParaPagoAccion({programId,q}); if(r.ok) setResultados(x=>({...x,[compraId]:r.leads})); });
  const asignar = (compraId:string, leadId:string) => iniciar(async()=>{ const r=await asignarCompraAccion({compraId,leadId}); if(!r.ok) toast.error(r.error); else { toast.success("Pago asignado"); router.refresh(); } });
  return (
    <Card>
      <CardHeader><CardTitle>Pagos sin emparejar</CardTitle></CardHeader>
      <CardContent className="p-0">
        {filas.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No hay pagos pendientes.</p> : (
          <ul className="divide-y">{filas.map((fila) => (
            <li key={fila.id} className="space-y-2 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{fila.nombre ?? fila.correo ?? "Comprador sin nombre"}</p>
                <p className="text-xs text-muted-foreground">{[fila.correo, fila.telefono].filter(Boolean).join(" · ")} · {fechaHoraEnBogota(fila.createdAt)}</p>
                {fila.monto && fila.moneda ? <p className="cifra text-sm">{monto(Number(fila.monto), fila.moneda)}</p> : null}
                {fila.estado === "en_revision" ? <p className="text-sm text-destructive">{motivoDeRevision(fila.motivoRevision)}</p> : null}
              </div>
              {fila.estado === "sin_emparejar" ? (
                <div className="space-y-2">
                  <Input placeholder="Buscar lead" disabled={pendiente} onChange={(e) => { if (e.target.value.trim().length >= 2) buscar(fila.id, e.target.value); }} />
                  <div className="flex flex-wrap gap-2">
                    {(resultados[fila.id] ?? []).map((lead) => <Button key={lead.id} size="sm" variant="outline" disabled={pendiente} onClick={() => asignar(fila.id, lead.id)}>{lead.nombre ?? lead.emailNormalizado}</Button>)}
                  </div>
                </div>
              ) : null}
            </li>
          ))}</ul>
        )}
      </CardContent>
    </Card>
  );
}
