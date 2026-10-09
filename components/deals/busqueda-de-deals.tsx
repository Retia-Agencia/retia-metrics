"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface EstadoBusquedaDeDeals {
  idsVisibles: Set<string> | null;
  mostrar(ids: string[] | null): void;
}

const ContextoBusquedaDeDeals = createContext<EstadoBusquedaDeDeals | null>(null);

export function BusquedaDeDeals({ children }: { children: ReactNode }) {
  const [idsVisibles, setIdsVisibles] = useState<Set<string> | null>(null);
  const valor = useMemo(
    () => ({
      idsVisibles,
      mostrar: (ids: string[] | null) => setIdsVisibles(ids === null ? null : new Set(ids)),
    }),
    [idsVisibles],
  );

  return <ContextoBusquedaDeDeals.Provider value={valor}>{children}</ContextoBusquedaDeDeals.Provider>;
}

export function useBusquedaDeDeals(): EstadoBusquedaDeDeals {
  const contexto = useContext(ContextoBusquedaDeDeals);
  if (!contexto) throw new Error("useBusquedaDeDeals debe usarse dentro de BusquedaDeDeals.");
  return contexto;
}
