"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Plus, X } from "lucide-react";
import {
  atajosDePeriodo,
  claveDePedido,
  comparacionesDe,
  MAXIMO_DE_COMPARACIONES,
  nombreDePedido,
  parametrosDeComparaciones,
  parsearPeriodoUrl,
  type PedidoDeComparacion,
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
  // Lo pedido sale de la URL con el mismo parser del servidor; lo resuelto, del periodo.
  const pedidos = parsearPeriodoUrl(Object.fromEntries(searchParams.entries())).comparaciones ?? [];
  const resueltas = new Map(comparacionesDe(periodo).map((c) => [claveDePedido(c.pedido), c.rango]));
  const [dialogoPeriodo, setDialogoPeriodo] = useState(false);
  const [dialogoComparacion, setDialogoComparacion] = useState(false);
  const { poner } = useFiltrosUrl();
  const atajos = Object.entries(atajosDePeriodo).filter(([valor]) => (mostrarCohortes && !soloA) || !valor.startsWith("cohorte"));
  const legible = (r: PeriodoResuelto["a"]) => r.desde === r.hasta ? fecha(r.desde) : `${fecha(r.desde)} a ${fecha(r.hasta)}`;
  const nombrePreset = periodo.preset === "custom" ? "Personalizado" : atajosDePeriodo[periodo.preset];
  const esCohorte = periodo.preset === "cohorte_actual" || periodo.preset === "cohorte_anterior";
  const yaPedido = (clave: string) => pedidos.some((p) => claveDePedido(p) === clave);
  // En un atajo de cohorte el periodo anterior ES la cohorte anterior: una sola opción.
  const opcionesFijas: { pedido: PedidoDeComparacion; etiqueta: string; deshabilitada: boolean }[] = [
    ...(!esCohorte ? [{ pedido: { tipo: "anterior" as const }, etiqueta: "Periodo anterior, al mismo día hábil", deshabilitada: false }] : []),
    ...(mostrarCohortes ? [{ pedido: { tipo: esCohorte ? "anterior" as const : "cohorte" as const }, etiqueta: "Cohorte anterior, al mismo día hábil", deshabilitada: !anteriorDisponible }] : []),
  ].filter((opcion) => !yaPedido(claveDePedido(opcion.pedido)));

  function navegar(valores: Record<string, string | null>, limpiar: string[], cerrar?: () => void) {
    poner({ ...Object.fromEntries(limpiar.map((clave) => [clave, null])), ...valores, pagina: null });
    cerrar?.();
  }

  function ponerComparaciones(lista: PedidoDeComparacion[]) {
    navegar(parametrosDeComparaciones(lista), clavesComparacion, () => setDialogoComparacion(false));
  }

  return (
    <div className={variante === "chip" ? "contents" : "flex flex-wrap gap-2"}>
      <Dialog open={dialogoPeriodo} onOpenChange={setDialogoPeriodo}>
        <DialogTrigger
          render={<Button type="button" variant="outline" size={variante === "chip" ? "sm" : "default"} className="h-auto whitespace-normal border-marca-texto/40 text-left aria-expanded:border-ring" />}
          title="Cambiar el periodo: las cifras de esta pantalla se calculan sobre estas fechas"
        >
          <CalendarDays aria-hidden className="size-4 shrink-0 text-marca-texto" />
          <span><span className="text-muted-foreground">Periodo:</span>{" "}<span className="font-medium">{nombrePreset}</span>
            {variante !== "chip" ? <span className="cifra block text-xs">{legible(periodo.a)}</span> : null}
          </span>
          {variante === "chip" ? <span className="cifra hidden text-xs text-muted-foreground sm:inline">· {legible(periodo.a)}</span> : null}
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

      {!soloA ? pedidos.map((pedido, i) => {
        const clave = claveDePedido(pedido);
        const rango = resueltas.get(clave);
        const nombre = nombreDePedido(pedido, periodo.preset);
        return (
          <span key={clave} className="inline-flex items-center rounded-lg border border-border bg-background text-sm" title={rango ? `Comparar con ${legible(rango)}` : "Sin fechas comparables"}>
            <span className="px-2.5 py-1">
              <span className="text-muted-foreground">vs</span>{" "}<span className="font-medium">{nombre}</span>
              {!rango ? <span className="text-muted-foreground"> · sin fechas</span> : variante !== "chip" && pedido.tipo !== "rango" ? <span className="cifra block text-xs">{legible(rango)}</span> : null}
            </span>
            <Button type="button" variant="ghost" size="icon-xs" className="mr-1" aria-label={`Quitar comparación ${nombre}`} onClick={() => ponerComparaciones(pedidos.filter((_, j) => j !== i))}>
              <X aria-hidden />
            </Button>
          </span>
        );
      }) : null}

      {!soloA && pedidos.length < MAXIMO_DE_COMPARACIONES ? (
        <Dialog open={dialogoComparacion} onOpenChange={setDialogoComparacion}>
          <DialogTrigger
            render={<Button type="button" variant="outline" size={variante === "chip" ? "sm" : "default"} className="aria-expanded:border-ring" />}
          >
            <Plus aria-hidden />
            {pedidos.length === 0 ? "Comparar con" : "Agregar comparación"}
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{pedidos.length === 0 ? "Comparar con" : "Agregar comparación"}</DialogTitle>
            <DialogDescription>Cada comparación se suma al periodo y se quita con su ×. Hasta {MAXIMO_DE_COMPARACIONES}.</DialogDescription>
            <div className="grid gap-2">
              {opcionesFijas.map((opcion) => (
                <Button key={claveDePedido(opcion.pedido)} type="button" variant="outline" className="justify-start" disabled={opcion.deshabilitada} onClick={() => ponerComparaciones([...pedidos, opcion.pedido])}>
                  {opcion.etiqueta}
                </Button>
              ))}
              {mostrarCohortes && !anteriorDisponible ? <p className="text-sm text-muted-foreground">Sin cohorte anterior con ventana de venta.</p> : null}
            </div>
            <form
              className="grid grid-cols-2 gap-2"
              onInput={(e) => (e.currentTarget.elements.namedItem("b_hasta") as HTMLInputElement).setCustomValidity("")}
              onSubmit={(e) => {
                e.preventDefault();
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
                ponerComparaciones([...pedidos, { tipo: "rango", rango: { desde, hasta } }]);
              }}
            >
              <fieldset className="contents">
                <legend className="col-span-2 text-sm font-medium">O un rango que elijo</legend>
                {(["desde", "hasta"] as const).map((extremo) => (
                  <label key={extremo} className="text-sm">{extremo === "desde" ? "Desde" : "Hasta"}
                    <input className={claseInput} type="date" name={`b_${extremo}`} aria-label={`Comparación ${extremo}`} required />
                  </label>
                ))}
              </fieldset>
              <Button type="submit" variant="outline" className="col-span-2">Agregar rango</Button>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
      {variante !== "chip" && periodo.aviso ? <p role="status" className="w-full text-xs text-muted-foreground">{periodo.aviso}</p> : null}
    </div>
  );
}
