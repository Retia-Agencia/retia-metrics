"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  agregarAccion,
  desactivarAccion,
  reactivarAccion,
  renombrarAccion,
  type ResultadoAccion,
} from "@/app/(app)/ajustes/catalogos/acciones";

/**
 * Componente generico de administracion de catalogos (ticket 013).
 *
 * Recibe la lista de definiciones (slug + nombre visible) y los items ya leidos de
 * cada catalogo, y arma una pestaña por catalogo sobre UN solo componente. No sabe
 * nada de plataformas, motivos ni origenes: todo llega como dato. Agregar un
 * catalogo nuevo no toca este archivo — solo el registro (ADR 0012).
 *
 * Las mutaciones son server actions que ya enforzan `requireRole("gerente")` en el
 * servidor; aca solo se muestran los botones y se refleja el resultado.
 */

export interface ItemCatalogo {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface CatalogoVista {
  slug: string;
  nombre: string;
  items: ItemCatalogo[];
}

export function CatalogosAdmin({ catalogos }: { catalogos: CatalogoVista[] }) {
  const [activo, setActivo] = useState(catalogos[0]?.slug ?? "");
  const actual = catalogos.find((c) => c.slug === activo) ?? catalogos[0];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Catálogos" className="flex flex-wrap gap-2">
        {catalogos.map((c) => (
          <Button
            key={c.slug}
            role="tab"
            aria-selected={c.slug === activo}
            variant={c.slug === activo ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActivo(c.slug)}
          >
            {c.nombre}
          </Button>
        ))}
      </div>

      {actual ? <PanelCatalogo catalogo={actual} /> : null}
    </div>
  );
}

function PanelCatalogo({ catalogo }: { catalogo: CatalogoVista }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [nuevo, setNuevo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");

  function correr(accion: () => Promise<ResultadoAccion>, exito: string) {
    startTransition(async () => {
      const res = await accion();
      if (res.ok) {
        toast.success(exito);
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: res.error });
      }
    });
  }

  function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    correr(() => agregarAccion(catalogo.slug, nombre), "Agregado");
    setNuevo("");
  }

  function guardarNombre(id: string) {
    const nombre = borrador.trim();
    if (!nombre) return;
    correr(() => renombrarAccion(catalogo.slug, id, nombre), "Renombrado");
    setEditando(null);
  }

  const items = [...catalogo.items].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{catalogo.nombre}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            agregar();
          }}
        >
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Nombre nuevo"
            aria-label={`Agregar a ${catalogo.nombre}`}
            maxLength={80}
            className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="submit" size="sm" disabled={pendiente || !nuevo.trim()}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </form>

        <ul className="divide-y rounded-md border">
          {items.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              Todavía no hay elementos en este catálogo.
            </li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm",
                  !item.activo && "opacity-50",
                )}
              >
                {editando === item.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      guardarNombre(item.id);
                    }}
                  >
                    <input
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      aria-label={`Nuevo nombre de ${item.nombre}`}
                      maxLength={80}
                      autoFocus
                      className="h-7 flex-1 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <Button
                      type="submit"
                      size="icon-sm"
                      variant="secondary"
                      disabled={pendiente || !borrador.trim()}
                      aria-label="Guardar nombre"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditando(null)}
                      aria-label="Cancelar"
                    >
                      <X className="size-4" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{item.nombre}</span>
                      {!item.activo ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          inactivo
                        </Badge>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1">
                      {item.activo ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pendiente}
                            onClick={() => {
                              setEditando(item.id);
                              setBorrador(item.nombre);
                            }}
                          >
                            Renombrar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pendiente}
                            onClick={() =>
                              correr(
                                () => desactivarAccion(catalogo.slug, item.id),
                                "Desactivado",
                              )
                            }
                          >
                            Desactivar
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendiente}
                          onClick={() =>
                            correr(
                              () => reactivarAccion(catalogo.slug, item.id),
                              "Reactivado",
                            )
                          }
                        >
                          <RotateCcw className="size-4" />
                          Reactivar
                        </Button>
                      )}
                    </span>
                  </>
                )}
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
