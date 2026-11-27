"use client";

import { useId } from "react";

export function EleccionDeReemplazo({ propuestas, value, onChange }: {
  propuestas: { id: string; etiqueta: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const nombre = useId();
  return <fieldset className="space-y-2 text-sm">
    <legend className="font-medium">¿Qué hacer con la propuesta anterior?</legend>
    {propuestas.map((propuesta) => <label key={propuesta.id} className="flex items-start gap-2">
      <input
        type="radio"
        name={nombre}
        value={propuesta.id}
        checked={value === propuesta.id}
        onChange={() => onChange(propuesta.id)}
      />
      <span>Reemplazar «{propuesta.etiqueta}» (sin pagos)</span>
    </label>)}
    <label className="flex items-start gap-2">
      <input type="radio" name={nombre} checked={value === null} onChange={() => onChange(null)} />
      <span>{propuestas.length === 1
        ? "Conservar ambos SKUs: el cliente de verdad compró los dos"
        : "Conservar todos: el cliente de verdad los compró todos"}</span>
    </label>
  </fieldset>;
}
