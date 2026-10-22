"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { asignarProximaCohorteAccion } from "@/app/(app)/p/[programa]/proxima-cohorte/acciones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TonoEtapa } from "./etapa-tono";

export interface CardProximaCohorte {
  dealId: string;
  nombreLead: string;
  cohorteOrigen: string;
  etapaNombre: string;
  etapaTono: TonoEtapa;
  destino: string;
  ownerNombre: string;
  esperaDesde: string;
}

export function ProximaCohorteCards({
  cards,
  cohortes,
  programId,
  programaSlug,
  permiteSeleccionar,
}: {
  cards: CardProximaCohorte[];
  cohortes: { id: string; codigo: string }[];
  programId: string;
  programaSlug: string;
  permiteSeleccionar: boolean;
}) {
  const router = useRouter();
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function asignar() {
    if (!destinoId) return;
    startTransition(async () => {
      const resultado = await asignarProximaCohorteAccion({ programId, dealIds: seleccionados, destinoId });
      if (!resultado.ok) {
        toast.error("No se pudo asignar", { description: resultado.error });
        return;
      }
      toast.success("Cohorte asignada");
      setSeleccionados([]);
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      {permiteSeleccionar ? (
        <div className="flex shrink-0 justify-end">
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger render={<Button size="sm" disabled={seleccionados.length === 0} />}>Asignar cohorte</DialogTrigger>
            <DialogContent>
              <DialogTitle>Asignar cohorte</DialogTitle>
              <DialogDescription>Elige la cohorte para los deals seleccionados.</DialogDescription>
              <Select value={destinoId} items={cohortes.map((c) => ({ value: c.id, label: c.codigo }))} onValueChange={setDestinoId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Elige la cohorte" /></SelectTrigger>
                <SelectContent>{cohortes.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
                <Button disabled={!destinoId || pendiente} onClick={asignar}>Asignar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
      {cards.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No hay deals en esta vista.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <li key={card.dealId} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                {permiteSeleccionar ? (
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(card.dealId)}
                    onChange={(event) => {
                      // Se lee antes del updater: React lo corre después y `currentTarget` ya es null.
                      const marcado = event.currentTarget.checked;
                      setSeleccionados((actual) => marcado
                        ? [...actual, card.dealId]
                        : actual.filter((id) => id !== card.dealId));
                    }}
                    aria-label={`Elegir ${card.nombreLead}`}
                  />
                ) : null}
                <Link className="min-w-0 flex-1 space-y-3" href={`/p/${programaSlug}/deals/${card.dealId}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-medium">{card.nombreLead}</h2>
                    <Badge variant={card.etapaTono}>{card.etapaNombre}</Badge>
                  </div>
                  <dl className="grid gap-1 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Viene de</dt><dd>{card.cohorteOrigen}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Quiere entrar a</dt><dd>{card.destino}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Dueño</dt><dd>{card.ownerNombre}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Espera desde</dt><dd className="cifra">{card.esperaDesde}</dd></div>
                  </dl>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
