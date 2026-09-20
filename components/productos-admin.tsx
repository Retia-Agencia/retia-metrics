"use client";

import { useState, useTransition } from "react";
import { RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { MONEDAS } from "@/lib/catalogo/productos";
import { ProductoCrearEnLinea } from "@/components/producto-crear-en-linea";
import {
  borrarProductoAccion,
  desactivarProductoAccion,
  editarProductoAccion,
  reactivarProductoAccion,
  type ResultadoAccion,
} from "@/app/(app)/productos/acciones";

/**
 * Administracion de productos por programa (ticket 017, ADR 0016).
 *
 * Agrupa los productos bajo su programa; los inactivos van atenuados y se pueden
 * reactivar. Crear un producto usa el componente reutilizable `ProductoCrearEnLinea`
 * (el mismo que reusara `/mi-dia`). La moneda vive al lado del numero y nunca se
 * convierte (restriccion dura de AGENTS.md). Las mutaciones son server actions que
 * ya enforzan rol y acceso al programa en el servidor.
 */

export interface ProductoVistaUI {
  id: string;
  programId: string;
  nombre: string;
  precioLista: string;
  moneda: string;
  activo: boolean;
}

export interface ProgramaConProductos {
  id: string;
  nombre: string;
  productos: ProductoVistaUI[];
}

interface Borrador {
  nombre: string;
  precioLista: string;
  moneda: string;
}

export function ProductosAdmin({ programas }: { programas: ProgramaConProductos[] }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);

  function correr(accion: () => Promise<ResultadoAccion>, exito: string, alExito?: () => void) {
    startTransition(async () => {
      const res = await accion();
      if (res.ok) {
        toast.success(exito);
        alExito?.();
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: res.error });
      }
    });
  }

  /**
   * Borrar es la unica operacion IRREVERSIBLE (ADR 0026 punto 5), asi que pide
   * confirmacion explicita. Y usa dos verbos segun lo que de verdad paso: si el
   * producto tiene ventas NO se borra —se avisa cuantas lo referencian y se sugiere
   * desactivar—, y solo cuando se borro de verdad se dice "borrado". Nunca se dice
   * "borrado" habiendo desactivado.
   */
  function borrar(id: string, nombre: string) {
    if (!window.confirm(`¿Borrar "${nombre}" para siempre? Esta acción no se puede deshacer.`)) {
      return;
    }
    startTransition(async () => {
      const res = await borrarProductoAccion(id);
      if (!res.ok) {
        toast.error("No se pudo borrar", { description: res.error });
        return;
      }
      if (res.borrado) {
        toast.success("Producto borrado");
        router.refresh();
      } else {
        // NO se borro: tiene referencias. Se dice la verdad y se sugiere desactivar.
        toast.info("No se puede borrar", {
          description: `Tiene ${res.referencias} venta(s) que lo referencian. Desactívalo en vez de borrarlo.`,
        });
      }
    });
  }

  if (programas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes ningún programa donde gestionar productos.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {programas.map((programa) => {
        const ordenados = [...programa.productos].sort((a, b) => {
          if (a.activo !== b.activo) return a.activo ? -1 : 1;
          return a.nombre.localeCompare(b.nombre, "es");
        });

        return (
          <Card key={programa.id}>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">{programa.nombre}</CardTitle>
              <ProductoCrearEnLinea
                programId={programa.id}
                alCrear={() => router.refresh()}
              />
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-md border">
                {ordenados.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-muted-foreground">
                    Este programa todavía no tiene productos.
                  </li>
                ) : (
                  ordenados.map((p) => (
                    <li key={p.id} className={cn("px-3 py-3 text-sm", !p.activo && "opacity-50")}>
                      {editando === p.id ? (
                        <FormularioEditar
                          inicial={{
                            nombre: p.nombre,
                            precioLista: p.precioLista,
                            moneda: p.moneda,
                          }}
                          pendiente={pendiente}
                          onCancelar={() => setEditando(null)}
                          onGuardar={(b) =>
                            correr(
                              () =>
                                editarProductoAccion(p.id, {
                                  programId: p.programId,
                                  nombre: b.nombre,
                                  precioLista: b.precioLista,
                                  moneda: b.moneda as (typeof MONEDAS)[number],
                                }),
                              "Producto actualizado",
                              () => setEditando(null),
                            )
                          }
                        />
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-medium">{p.nombre}</span>
                              {!p.activo ? (
                                <Badge variant="outline" className="text-muted-foreground">
                                  inactivo
                                </Badge>
                              ) : null}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {p.moneda} {num(Number(p.precioLista), 2)}
                            </span>
                          </div>
                          <span className="flex items-center gap-1">
                            {p.activo ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={pendiente}
                                  onClick={() => setEditando(p.id)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={pendiente}
                                  onClick={() =>
                                    correr(
                                      () => desactivarProductoAccion(p.id),
                                      "Producto desactivado",
                                    )
                                  }
                                >
                                  Desactivar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={pendiente}
                                  onClick={() => borrar(p.id, p.nombre)}
                                >
                                  Borrar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={pendiente}
                                  onClick={() =>
                                    correr(() => reactivarProductoAccion(p.id), "Producto reactivado")
                                  }
                                >
                                  <RotateCcw className="size-4" />
                                  Reactivar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={pendiente}
                                  onClick={() => borrar(p.id, p.nombre)}
                                >
                                  Borrar
                                </Button>
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FormularioEditar({
  inicial,
  pendiente,
  onCancelar,
  onGuardar,
}: {
  inicial: Borrador;
  pendiente: boolean;
  onCancelar: () => void;
  onGuardar: (borrador: Borrador) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);

  const claseInput =
    "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(borrador);
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Nombre</span>
        <input
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          maxLength={80}
          required
          className={claseInput}
          aria-label="Nombre del producto"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Precio de lista</span>
        <input
          value={borrador.precioLista}
          onChange={(e) => setBorrador({ ...borrador, precioLista: e.target.value })}
          inputMode="decimal"
          required
          className={claseInput}
          aria-label="Precio de lista"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Moneda</span>
        <select
          value={borrador.moneda}
          onChange={(e) => setBorrador({ ...borrador, moneda: e.target.value })}
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
          disabled={pendiente || !borrador.nombre.trim() || !borrador.precioLista.trim()}
        >
          Guardar
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onCancelar} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
