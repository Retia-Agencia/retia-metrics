"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sumarDias } from "@/lib/rangos";

export function SelectorDeDia({ dia, hoy, base }: { dia: string; hoy: string; base: { path: string; params: Record<string, string> } }) {
  const router = useRouter();
  const href = (fechaElegida: string | null) => {
    const q = new URLSearchParams(base.params);
    q.set("seccion", "hoy");
    if (fechaElegida) q.set("fecha", fechaElegida);
    return `${base.path}?${q.toString()}`;
  };
  const ayer = sumarDias(hoy, -1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant={dia === hoy ? "default" : "outline"} onClick={() => router.push(href(null))}>Hoy</Button>
      <Popover>
        <PopoverTrigger render={<Button size="sm" variant={dia === hoy ? "outline" : "default"} />}>Seleccionar fecha</PopoverTrigger>
        <PopoverContent className="space-y-3">
          <Button className="w-full" size="sm" variant={dia === ayer ? "secondary" : "ghost"} onClick={() => router.push(href(ayer))}>Ayer</Button>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Fecha del reporte</span>
            <input
              type="date"
              value={dia}
              max={hoy}
              onChange={(evento) => evento.target.value && router.push(href(evento.target.value))}
              className="h-8 w-full rounded-lg border border-border bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </PopoverContent>
      </Popover>
    </div>
  );
}
