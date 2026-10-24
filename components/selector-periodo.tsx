"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  atajosDePeriodo,
  comparacionDeParametros,
  descripcionDeComparacion,
  parametrosDeComparacion,
  type ComparacionDePeriodo,
  type PeriodoResuelto,
} from "@/lib/periodo";
import { fecha } from "@/lib/format";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const clavesPeriodo = ["periodo", "a_desde", "a_hasta", "rango", "desde", "hasta"];
const clavesComparacion = ["comparar", "b_desde", "b_hasta"];
const FECHA_COMPLETA = /^\d{4}-\d{2}-\d{2}$/;
const claseInput = "cifra w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const opcionesDeComparacion: { value: ComparacionDePeriodo; label: string }[] = [
  { value: "periodo_anterior", label: "Mismo punto del periodo anterior" },
  { value: "cohorte_anterior", label: "Cohorte anterior al mismo día hábil" },
  { value: "rango", label: "Un rango que elijo" },
  { value: "no", label: "No comparar" },
];

interface SelectorPeriodoProps {
  periodo: PeriodoResuelto;
  cohorteDisponible: boolean;
  anteriorDisponible: boolean;
  /** Solo el periodo, sin comparación: el de las listas (ticket 141). */
  soloA?: boolean;
  /** El agregado entre programas no tiene una ventana de cohorte común. */
  mostrarCohortes?: boolean;
  variante?: "bloque" | "chip";
}

export function SelectorPeriodo({ periodo, cohorteDisponible, anteriorDisponible, soloA = false, mostrarCohortes = true, variante = "bloque" }: SelectorPeriodoProps) {
  const searchParams = useSearchParams();
  const comparacionActual = comparacionDeParametros({
    comparar: searchParams.get("comparar") ?? undefined,
    b_desde: searchParams.get("b_desde") ?? undefined,
    b_hasta: searchParams.get("b_hasta") ?? undefined,
  });
  const [dialogoPeriodo, setDialogoPeriodo] = useState(false);
  const [dialogoComparacion, setDialogoComparacion] = useState(false);
  const [comparacionEnEdicion, setComparacionEnEdicion] = useState<ComparacionDePeriodo>(comparacionActual);
  const { poner } = useFiltrosUrl();
  const atajos = Object.entries(atajosDePeriodo).filter(([valor]) => (mostrarCohortes && !soloA) || !valor.startsWith("cohorte"));
  const legible = (r: PeriodoResuelto["a"]) => r.desde === r.hasta ? fecha(r.desde) : `${fecha(r.desde)} a ${fecha(r.hasta)}`;
  const nombrePreset = periodo.preset === "custom" ? "Personalizado" : atajosDePeriodo[periodo.preset];
  const nombreComparacion = opcionesDeComparacion.find((opcion) => opcion.value === comparacionActual)?.label;

  function navegar(valores: Record<string, string | null>, limpiar: string[], cerrar?: () => void) {
    poner({ ...Object.fromEntries(limpiar.map((clave) => [clave, null])), ...valores, pagina: null });
    cerrar?.();
  }

  function cambiarComparacion(valor: ComparacionDePeriodo) {
    setComparacionEnEdicion(valor);
    if (valor === "rango") {
      if (periodo.b) navegar(parametrosDeComparacion(valor, periodo.b), clavesComparacion);
      return;
    }
    navegar(parametrosDeComparacion(valor), clavesComparacion, () => setDialogoComparacion(false));
  }

  return (
    <div className={variante === "chip" ? "contents" : "flex flex-wrap gap-2"}>
      <Dialog open={dialogoPeriodo} onOpenChange={setDialogoPeriodo}>
        <DialogTrigger
          render={<Button type="button" variant="outline" size={variante === "chip" ? "sm" : "default"} className="h-auto whitespace-normal text-left aria-expanded:border-ring" />}
          title={legible(periodo.a)}
        >
          <span><span className="text-muted-foreground">Periodo:</span>{" "}<span className="font-medium">{nombrePreset}</span>
            {variante !== "chip" ? <span className="cifra block text-xs">{legible(periodo.a)}</span> : null}
          </span>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Periodo</DialogTitle>
          <DialogDescription>Elige un atajo o un rango. Los días son de Bogotá.</DialogDescription>
          <Select
            value={periodo.preset}
            items={[...atajos.map(([value, label]) => ({ value, label })), { value: "custom", label: "Personalizado" }]}
            onValueChange={(valor) => {
              if (valor && valor !== "custom") navegar({ periodo: valor }, soloA ? [...clavesPeriodo, ...clavesComparacion] : clavesPeriodo, () => setDialogoPeriodo(false));
            }}
          >
            <SelectTrigger aria-label="Atajo del periodo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {atajos.map(([valor, etiqueta]) => (
                <SelectItem key={valor} value={valor} disabled={(valor === "cohorte_actual" && !cohorteDisponible) || (valor === "cohorte_anterior" && !anteriorDisponible)}>{etiqueta}</SelectItem>
              ))}
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {!soloA && mostrarCohortes && !cohorteDisponible ? <p className="text-sm text-muted-foreground">Sin cohorte actual con ventana de venta.</p> : null}
          {!soloA && mostrarCohortes && !anteriorDisponible ? <p className="text-sm text-muted-foreground">Sin cohorte anterior con ventana de venta.</p> : null}
          <form
            key={`${periodo.a.desde}-${periodo.a.hasta}`}
            className="grid grid-cols-2 gap-2"
            onInput={(e) => (e.currentTarget.elements.namedItem("a_hasta") as HTMLInputElement).setCustomValidity("")}
            onChange={(e) => {
              const data = new FormData(e.currentTarget);
              const desde = String(data.get("a_desde"));
              const hasta = String(data.get("a_hasta"));
              if (!FECHA_COMPLETA.test(desde) || !FECHA_COMPLETA.test(hasta)) return;
              if (desde > hasta) {
                const input = e.currentTarget.elements.namedItem("a_hasta") as HTMLInputElement;
                input.setCustomValidity("El fin debe ser igual o posterior al inicio.");
                input.reportValidity();
                return;
              }
              navegar({ periodo: "custom", a_desde: desde, a_hasta: hasta }, clavesPeriodo);
            }}
          >
            <fieldset className="contents">
              <legend className="col-span-2 text-sm font-medium">Rango</legend>
              {(["desde", "hasta"] as const).map((extremo) => (
                <label key={extremo} className="text-sm">{extremo === "desde" ? "Desde" : "Hasta"}
                  <input className={claseInput} type="date" name={`a_${extremo}`} aria-label={extremo} required defaultValue={periodo.a[extremo]} />
                </label>
              ))}
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>

      {!soloA ? (
        <Dialog open={dialogoComparacion} onOpenChange={(abierto) => { setDialogoComparacion(abierto); if (abierto) setComparacionEnEdicion(comparacionActual); }}>
          <DialogTrigger
            render={<Button type="button" variant="outline" size={variante === "chip" ? "sm" : "default"} className="h-auto whitespace-normal text-left aria-expanded:border-ring" />}
            title={descripcionDeComparacion(periodo)}
          >
            <span><span className="text-muted-foreground">Comparar con:</span>{" "}<span className="font-medium">{nombreComparacion}</span>
              {variante !== "chip" ? <span className="cifra block text-xs">{periodo.b ? legible(periodo.b) : "Sin comparación"}</span> : null}
            </span>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Comparar con</DialogTitle>
            <DialogDescription>Elige la referencia para leer los cambios del periodo.</DialogDescription>
            <Select value={comparacionEnEdicion} items={opcionesDeComparacion} onValueChange={(valor) => { if (valor) cambiarComparacion(valor as ComparacionDePeriodo); }}>
              <SelectTrigger aria-label="Comparar con"><SelectValue /></SelectTrigger>
              <SelectContent>{opcionesDeComparacion.map((opcion) => <SelectItem key={opcion.value} value={opcion.value}>{opcion.label}</SelectItem>)}</SelectContent>
            </Select>
            {comparacionEnEdicion === "rango" ? (
              <form
                key={`${periodo.b?.desde}-${periodo.b?.hasta}`}
                className="grid grid-cols-2 gap-2"
                onInput={(e) => (e.currentTarget.elements.namedItem("b_hasta") as HTMLInputElement).setCustomValidity("")}
                onChange={(e) => {
                  const data = new FormData(e.currentTarget);
                  const desde = String(data.get("b_desde"));
                  const hasta = String(data.get("b_hasta"));
                  if (!FECHA_COMPLETA.test(desde) || !FECHA_COMPLETA.test(hasta)) return;
                  if (desde > hasta) {
                    const input = e.currentTarget.elements.namedItem("b_hasta") as HTMLInputElement;
                    input.setCustomValidity("El fin debe ser igual o posterior al inicio.");
                    input.reportValidity();
                    return;
                  }
                  navegar(parametrosDeComparacion("rango", { desde, hasta }), clavesComparacion);
                }}
              >
                <fieldset className="contents">
                  <legend className="col-span-2 text-sm font-medium">Rango para comparar</legend>
                  {(["desde", "hasta"] as const).map((extremo) => (
                    <label key={extremo} className="text-sm">{extremo === "desde" ? "Desde" : "Hasta"}
                      <input className={claseInput} type="date" name={`b_${extremo}`} aria-label={`Comparación ${extremo}`} required defaultValue={periodo.b?.[extremo] ?? ""} />
                    </label>
                  ))}
                </fieldset>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
      {variante !== "chip" && periodo.aviso ? <p role="status" className="w-full text-xs text-muted-foreground">{periodo.aviso}</p> : null}
    </div>
  );
}
