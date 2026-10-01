"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { atajosDePeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { fecha } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const claves = ["periodo", "a_desde", "a_hasta", "b_desde", "b_hasta", "rango", "desde", "hasta"];
const claseInput =
  "cifra w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

interface SelectorPeriodoProps {
  periodo: PeriodoResuelto;
  cohorteDisponible: boolean;
  anteriorDisponible: boolean;
}

/**
 * Un solo control para elegir A y B en dashboard y listas (ADR 0067). La selección
 * vive en la URL para poder compartirla y recargarla; el estado local solo abre
 * el diálogo. Cambiar el periodo conserva los demás filtros de la pantalla.
 *
 * Las fechas y el atajo visible vienen resueltos por el servidor, incluso cuando
 * hubo que caer a Hoy. El cliente nunca calcula hoy con la zona del navegador.
 */
export function SelectorPeriodo({
  periodo,
  cohorteDisponible,
  anteriorDisponible,
}: SelectorPeriodoProps) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();

  function navegar(valores: Record<string, string>) {
    const params = new URLSearchParams(busqueda.toString());
    claves.forEach((clave) => params.delete(clave));
    Object.entries(valores).forEach(([clave, valor]) => params.set(clave, valor));
    router.push(`${pathname}?${params.toString()}`);
    setAbierto(false);
  }
  const legible = (r: PeriodoResuelto["a"]) => r.desde === r.hasta
    ? fecha(r.desde)
    : `${fecha(r.desde)} a ${fecha(r.hasta)}`;

  return (
    <div className="space-y-1">
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogTrigger
          render={<Button variant="outline" className="h-auto whitespace-normal text-left" />}
        >
          <span>
            <span className="font-medium">
              {periodo.preset === "custom" ? "Personalizado" : atajosDePeriodo[periodo.preset]}
            </span>
            <span className="cifra block text-xs">
              A: {legible(periodo.a)} · B: {periodo.b ? legible(periodo.b) : "Sin comparación"}
            </span>
          </span>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Periodo A contra B</DialogTitle>
          <DialogDescription>
            Elige un atajo o dos rangos. Por defecto B compara el mismo número de días hábiles.
          </DialogDescription>
          <Select
            value={periodo.preset}
            // Sin `items`, Base UI pinta el valor crudo (`hoy`) en el disparador.
            items={[
              ...Object.entries(atajosDePeriodo).map(([value, label]) => ({ value, label })),
              { value: "custom", label: "Personalizado" },
            ]}
            onValueChange={(valor) => {
              if (valor && valor !== "custom") navegar({ periodo: valor });
            }}
          >
            <SelectTrigger aria-label="Atajo del periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(atajosDePeriodo).map(([valor, etiqueta]) => (
                <SelectItem
                  key={valor}
                  value={valor}
                  disabled={
                    (valor === "cohorte_actual" && !cohorteDisponible) ||
                    (valor === "cohorte_anterior" && !anteriorDisponible)
                  }
                >
                  {etiqueta}
                </SelectItem>
              ))}
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {!cohorteDisponible && (
            <p className="text-sm text-muted-foreground">Sin cohorte actual con ventana de venta.</p>
          )}
          {!anteriorDisponible && (
            <p className="text-sm text-muted-foreground">Sin cohorte anterior con ventana de venta.</p>
          )}
          <form
            key={JSON.stringify(periodo)}
            className="space-y-4"
            onInput={(e) => {
              for (const nombre of ["a_hasta", "b_hasta"]) {
                const input = e.currentTarget.elements.namedItem(nombre) as HTMLInputElement;
                input.setCustomValidity("");
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const valores = Object.fromEntries(
                ["a_desde", "a_hasta", "b_desde", "b_hasta"].map((k) => [k, String(data.get(k))]),
              );

              if (valores.a_desde > valores.a_hasta || valores.b_desde > valores.b_hasta) {
                const input = e.currentTarget.elements.namedItem(
                  valores.a_desde > valores.a_hasta ? "a_hasta" : "b_hasta",
                ) as HTMLInputElement;
                input.setCustomValidity("El fin debe ser igual o posterior al inicio.");
                input.reportValidity();
                return;
              }

              navegar({
                periodo: "custom",
                ...valores,
              });
            }}
          >
            {(["a", "b"] as const).map((letra) => (
              <fieldset key={letra} className="grid grid-cols-2 gap-2">
                <legend className="mb-1 text-sm font-medium">Periodo {letra.toUpperCase()}</legend>
                {(["desde", "hasta"] as const).map((extremo) => (
                  <label key={extremo} className="text-sm">
                    {extremo === "desde" ? "Desde" : "Hasta"}
                    <input
                      className={claseInput}
                      type="date"
                      name={`${letra}_${extremo}`}
                      aria-label={`${letra.toUpperCase()} ${extremo}`}
                      required
                      defaultValue={periodo[letra]?.[extremo] ?? ""}
                      onInput={(e) => e.currentTarget.setCustomValidity("")}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
            <Button type="submit">Aplicar A contra B</Button>
          </form>
        </DialogContent>
      </Dialog>
      {periodo.aviso && (
        <p role="status" className="text-xs text-muted-foreground">{periodo.aviso}</p>
      )}
    </div>
  );
}
