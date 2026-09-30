"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  crearAreaAccion,
  desactivarAreaAccion,
  reactivarAreaAccion,
  renombrarAreaAccion,
  type ResultadoCanalAccion,
} from "@/app/(app)/ajustes/canales/acciones";

export interface AreaVista {
  id: string;
  nombre: string;
  activo: boolean;
  /** Canales que apuntan a esta area; con uno o mas, desactivarla deja esos canales en "Área inactiva". */
  canales: number;
}

const claseControl = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Areas de origen (ADR 0043): filas editables, nunca un literal en el codigo. */
export function AreasAdmin({ areas }: { areas: AreaVista[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");

  function correr(accion: () => Promise<ResultadoCanalAccion>, mensaje: string) {
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error });
        return;
      }
      toast.success(mensaje);
      setEditando(null);
      setNombre("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Áreas</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            correr(
              () => (editando ? renombrarAreaAccion(editando, { nombre }) : crearAreaAccion({ nombre })),
              editando ? "Área renombrada" : "Área creada",
            );
          }}
        >
          <label className="min-w-48 flex-1 space-y-1 text-sm">
            <span className="font-medium">{editando ? "Nuevo nombre" : "Nombre del área"}</span>
            <input className={claseControl} maxLength={80} required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <Button type="submit" disabled={pendiente}>{editando ? "Guardar" : <><Plus className="size-4" />Crear</>}</Button>
          {editando ? <Button type="button" variant="ghost" onClick={() => { setEditando(null); setNombre(""); }}><X className="size-4" />Cancelar</Button> : null}
        </form>
        <ul className="divide-y text-sm">
          {areas.map((area) => (
            <li key={area.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-medium">{area.nombre}</span>
              <span className="text-muted-foreground"><span className="cifra">{area.canales}</span> {area.canales === 1 ? "canal" : "canales"}</span>
              <Badge variant={area.activo ? "exito" : "neutro"}>{area.activo ? "Activa" : "Inactiva"}</Badge>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditando(area.id); setNombre(area.nombre); }}><Pencil className="size-4" />Renombrar</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pendiente}
                  onClick={() => correr(
                    () => (area.activo ? desactivarAreaAccion(area.id) : reactivarAreaAccion(area.id)),
                    area.activo ? "Área desactivada" : "Área reactivada",
                  )}
                >
                  <RotateCcw className="size-4" />{area.activo ? "Desactivar" : "Reactivar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
