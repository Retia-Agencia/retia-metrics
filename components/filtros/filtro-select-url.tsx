"use client";

import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Select compacto que escribe una elección simple en la URL. */
export function FiltroSelectUrl({
  nombre,
  etiqueta,
  valor,
  porDefecto,
  opciones,
}: {
  nombre: string;
  etiqueta: string;
  valor: string;
  porDefecto: string;
  opciones: readonly { value: string; label: string }[];
}) {
  const { poner } = useFiltrosUrl();

  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {etiqueta}
      <Select
        value={valor}
        items={opciones}
        onValueChange={(elegido: string | null) => {
          if (elegido) poner({ [nombre]: elegido === porDefecto ? null : elegido });
        }}
      >
        <SelectTrigger className="w-full" aria-label={etiqueta}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
