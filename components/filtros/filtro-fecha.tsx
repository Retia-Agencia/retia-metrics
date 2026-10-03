"use client";

import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";

const FECHA_COMPLETA = /^\d{4}-\d{2}-\d{2}$/;
const claseInput =
  "h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function FiltroFecha({ nombre, etiqueta }: { nombre: string; etiqueta: string }) {
  const { busqueda, poner } = useFiltrosUrl();

  return (
    <label className="grid gap-1 text-sm">
      {etiqueta}
      <input
        type="date"
        value={busqueda.get(nombre) ?? ""}
        className={claseInput}
        onChange={(evento) => {
          const valor = evento.currentTarget.value;
          if (valor === "" || FECHA_COMPLETA.test(valor)) poner({ [nombre]: valor || null });
        }}
      />
    </label>
  );
}
