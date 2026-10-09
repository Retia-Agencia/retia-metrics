"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  agregarAlProgramaAccion,
  marcarSetterPorDefectoAccion,
  quitarDelProgramaAccion,
} from "@/app/(app)/p/[programa]/programa/acciones-programa";
import { asignarCalendlyDeMembresiaAccion } from "@/app/(app)/ajustes/usuarios/acciones";
import { FilaMembresia, SetterPorDefecto } from "@/components/calendly-membresias";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CuentasDelPrograma } from "@/lib/calendly/cuentas";
import type { MembresiaConCalendly } from "@/lib/catalogo/usuarios";

type UsuarioElegible = { id: string; nombre: string | null; email: string };

export function EquipoDelPrograma({
  programa,
  membresias,
  elegibles,
  cuentas,
}: {
  programa: { id: string; nombre: string };
  membresias: MembresiaConCalendly[];
  elegibles: UsuarioElegible[];
  cuentas: Record<string, CuentasDelPrograma>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [userId, setUserId] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<MembresiaConCalendly | null>(null);
  const listaCuentas = cuentas[programa.id];

  function agregar() {
    if (!userId) return;
    startTransition(async () => {
      const resultado = await agregarAlProgramaAccion({ userId, programId: programa.id });
      if (!resultado.ok) {
        toast.error("No se pudo agregar", { description: resultado.error });
        return;
      }
      toast.success("Persona agregada al equipo");
      setUserId(null);
      router.refresh();
    });
  }

  function quitar() {
    if (!aQuitar) return;
    startTransition(async () => {
      const resultado = await quitarDelProgramaAccion({ userId: aQuitar.userId, programId: programa.id });
      if (!resultado.ok) {
        toast.error("No se pudo quitar", { description: resultado.error });
        return;
      }
      toast.success("Persona retirada del equipo");
      setAQuitar(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <SetterPorDefecto
        programId={programa.id}
        membresias={membresias}
        accion={marcarSetterPorDefectoAccion}
      />
      {membresias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nadie tiene membresía activa en este programa.</p>
      ) : (
        <>
          {listaCuentas && !listaCuentas.ok ? (
            <p className="text-xs text-destructive">No se pudieron leer las cuentas de Calendly: {listaCuentas.error}</p>
          ) : null}
          <ul className="divide-y divide-border text-sm">
            {membresias.map((membresia) => (
              <FilaMembresia
                key={membresia.id}
                membresia={membresia}
                cuentas={listaCuentas?.ok ? listaCuentas.cuentas : null}
                accion={asignarCalendlyDeMembresiaAccion}
                extra={
                  <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => setAQuitar(membresia)}>
                    Quitar
                  </Button>
                }
              />
            ))}
          </ul>
        </>
      )}

      {elegibles.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={userId}
            items={elegibles.map((usuario) => ({
              value: usuario.id,
              label: usuario.nombre ?? usuario.email,
            }))}
            onValueChange={(valor) => setUserId(valor)}
          >
            <SelectTrigger className="w-full" aria-label="Persona para agregar">
              <SelectValue placeholder="Selecciona una persona" />
            </SelectTrigger>
            <SelectContent>
              {elegibles.map((usuario) => (
                <SelectItem key={usuario.id} value={usuario.id}>
                  {usuario.nombre ?? usuario.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={pendiente || !userId} onClick={agregar}>
            Agregar
          </Button>
        </div>
      ) : null}

      <Dialog open={aQuitar != null} onOpenChange={(abierto) => !abierto && setAQuitar(null)}>
        <DialogContent>
          <DialogTitle>Quitar del programa</DialogTitle>
          <DialogDescription>
            {aQuitar ? `${aQuitar.usuario} dejará de pertenecer al equipo de ${programa.nombre}.` : ""}
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" disabled={pendiente} onClick={() => setAQuitar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pendiente} onClick={quitar}>
              Quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
