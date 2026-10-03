"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";

const TODOS = "todos";

interface FiltroSelectProps {
  nombre: string;
  etiqueta: string;
  opciones: { value: string; label: string }[];
  todos?: string;
  className?: string;
}

export function FiltroSelect({
  nombre,
  etiqueta,
  opciones,
  todos = "Todos",
  className = "w-44",
}: FiltroSelectProps) {
  const { busqueda, poner } = useFiltrosUrl();
  const valor = busqueda.get(nombre) || TODOS;
  const items = [{ value: TODOS, label: todos }, ...opciones];

  return (
    <label className="grid gap-1 text-sm">
      {etiqueta}
      <Select
        value={valor}
        items={items}
        onValueChange={(elegido: string | null) => poner({ [nombre]: !elegido || elegido === TODOS ? null : elegido })}
      >
        <SelectTrigger className={className} aria-label={etiqueta}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{todos}</SelectItem>
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
