"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MONEDAS } from "@/lib/catalogo/productos";
import {
  crearProductoAccion,
  type ResultadoAccion,
} from "@/app/(app)/productos/acciones";

/**
 * Creacion de un producto EN LINEA, reutilizable (ticket 017, ADR 0016).
 *
 * Vive suelto para que `/mi-dia` (ticket 003) lo use tal cual cuando un closer
 * necesita, en medio de una llamada, vender algo que aun no esta en la lista: crea
 * el producto sin salir del flujo de la venta. La pantalla `/productos` lo usa para
 * su "nuevo producto".
 *
 * Se le pasa el `programId` (los productos cuelgan de un programa) y un callback
 * `alCrear` que corre tras un alta exitosa (refrescar la lista, o seleccionar el
 * producto recien creado en el formulario de venta). La barrera de rol y la de
 * programa se enforzan en el servidor (server action + `lib/catalogo/productos`).
 */
export function ProductoCrearEnLinea({
  programId,
  alCrear,
}: {
  programId: string;
  alCrear?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [precioLista, setPrecioLista] = useState("");
  const [moneda, setMoneda] = useState<(typeof MONEDAS)[number]>("USD");
  const [pendiente, startTransition] = useTransition();

  const claseInput =
    "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  function limpiar() {
    setNombre("");
    setPrecioLista("");
    setMoneda("USD");
  }

  function guardar() {
    startTransition(async () => {
      const res: ResultadoAccion = await crearProductoAccion({
        programId,
        nombre,
        precioLista,
        moneda,
      });
      if (res.ok) {
        toast.success("Producto creado");
        limpiar();
        setAbierto(false);
        alCrear?.();
      } else {
        toast.error("No se pudo crear", { description: res.error });
      }
    });
  }

  if (!abierto) {
    return (
      <Button size="sm" variant="outline" disabled={pendiente} onClick={() => setAbierto(true)}>
        <Plus className="size-4" />
        Nuevo producto
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Nombre</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={80}
          required
          autoFocus
          className={claseInput}
          aria-label="Nombre del producto"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Precio de lista</span>
        <input
          value={precioLista}
          onChange={(e) => setPrecioLista(e.target.value)}
          inputMode="decimal"
          required
          className={claseInput}
          aria-label="Precio de lista"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Moneda</span>
        <select
          value={moneda}
          onChange={(e) => setMoneda(e.target.value as (typeof MONEDAS)[number])}
          className={claseInput}
          aria-label="Moneda"
        >
          {MONEDAS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1">
        <Button
          type="submit"
          size="sm"
          disabled={pendiente || !nombre.trim() || !precioLista.trim()}
        >
          Guardar
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            limpiar();
            setAbierto(false);
          }}
          aria-label="Cancelar"
        >
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
