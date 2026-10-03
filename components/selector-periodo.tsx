"use client";

import { useState } from "react";
import { atajosDePeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { fecha } from "@/lib/format";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";
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

// `pagina` tambien se va: con otro periodo, la pagina vieja ya no existe.
const claves = ["periodo", "a_desde", "a_hasta", "b_desde", "b_hasta", "rango", "desde", "hasta"];
const FECHA_COMPLETA = /^\d{4}-\d{2}-\d{2}$/;
const claseInput =
  "cifra w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

interface SelectorPeriodoProps {
  periodo: PeriodoResuelto;
  cohorteDisponible: boolean;
  anteriorDisponible: boolean;
  /** Solo el rango A, sin comparación: el de las listas (ticket 141). */
  soloA?: boolean;
  /** El agregado entre programas no tiene una ventana de cohorte común. */
  mostrarCohortes?: boolean;
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
  soloA = false,
  mostrarCohortes = true,
}: SelectorPeriodoProps) {
  const letras = soloA ? (["a"] as const) : (["a", "b"] as const);
  // Una lista no tiene ventana de cohorte: sus atajos ni se ofrecen.
  const atajos = Object.entries(atajosDePeriodo).filter(
    ([valor]) => (mostrarCohortes && !soloA) || !valor.startsWith("cohorte"),
  );
  const [abierto, setAbierto] = useState(false);
  const { poner } = useFiltrosUrl();

  // Un atajo cierra el dialogo; una fecha a mano lo deja abierto para seguir editando las otras.
  function navegar(valores: Record<string, string>, cerrar = true) {
    poner({ ...Object.fromEntries(claves.map((clave) => [clave, null])), ...valores });
    if (cerrar) setAbierto(false);
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
              {soloA
                ? legible(periodo.a)
                : `A: ${legible(periodo.a)} · B: ${periodo.b ? legible(periodo.b) : "Sin comparación"}`}
            </span>
          </span>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>{soloA ? "Periodo" : "Periodo A contra B"}</DialogTitle>
          <DialogDescription>
            {soloA
              ? "Elige un atajo o un rango. Los días son de Bogotá."
              : "Elige un atajo o dos rangos. Por defecto B compara el mismo número de días hábiles."}
          </DialogDescription>
          <Select
            value={periodo.preset}
            // Sin `items`, Base UI pinta el valor crudo (`hoy`) en el disparador.
            items={[
              ...atajos.map(([value, label]) => ({ value, label })),
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
              {atajos.map(([valor, etiqueta]) => (
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
          {!soloA && mostrarCohortes && !cohorteDisponible && (
            <p className="text-sm text-muted-foreground">Sin cohorte actual con ventana de venta.</p>
          )}
          {!soloA && mostrarCohortes && !anteriorDisponible && (
            <p className="text-sm text-muted-foreground">Sin cohorte anterior con ventana de venta.</p>
          )}
          <form
            key={JSON.stringify(periodo)}
            className="space-y-4"
            onInput={(e) => {
              for (const letra of letras) {
                const input = e.currentTarget.elements.namedItem(`${letra}_hasta`) as HTMLInputElement;
                input.setCustomValidity("");
              }
            }}
            onChange={(e) => {
              const data = new FormData(e.currentTarget);
              const valores = Object.fromEntries(
                letras.flatMap((l) => [`${l}_desde`, `${l}_hasta`]).map((k) => [k, String(data.get(k))]),
              );
              if (Object.values(valores).some((valor) => !FECHA_COMPLETA.test(valor))) return;

              const invertida = letras.find((l) => valores[`${l}_desde`] > valores[`${l}_hasta`]);
              if (invertida) {
                const input = e.currentTarget.elements.namedItem(`${invertida}_hasta`) as HTMLInputElement;
                input.setCustomValidity("El fin debe ser igual o posterior al inicio.");
                input.reportValidity();
                return;
              }

              navegar({ periodo: "custom", ...valores }, false);
            }}
          >
            {letras.map((letra) => (
              <fieldset key={letra} className="grid grid-cols-2 gap-2">
                <legend className="mb-1 text-sm font-medium">{soloA ? "Rango" : `Periodo ${letra.toUpperCase()}`}</legend>
                {(["desde", "hasta"] as const).map((extremo) => (
                  <label key={extremo} className="text-sm">
                    {extremo === "desde" ? "Desde" : "Hasta"}
                    <input
                      className={claseInput}
                      type="date"
                      name={`${letra}_${extremo}`}
                      aria-label={soloA ? extremo : `${letra.toUpperCase()} ${extremo}`}
                      required
                      defaultValue={periodo[letra]?.[extremo] ?? ""}
                      onInput={(e) => e.currentTarget.setCustomValidity("")}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
          </form>
        </DialogContent>
      </Dialog>
      {periodo.aviso && (
        <p role="status" className="text-xs text-muted-foreground">{periodo.aviso}</p>
      )}
    </div>
  );
}
