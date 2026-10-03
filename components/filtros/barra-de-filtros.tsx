"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hayFiltrosActivos } from "@/components/filtros/query";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";

export function BarraDeFiltros({ nombres, children }: { nombres: string[]; children: ReactNode }) {
  const { busqueda, quitar } = useFiltrosUrl();

  return (
    <div className="flex flex-wrap items-end gap-2">
      {children}
      {hayFiltrosActivos(busqueda, nombres) ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => quitar(nombres)}>
          <X aria-hidden />
          Quitar filtros
        </Button>
      ) : null}
    </div>
  );
}
