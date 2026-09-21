"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  agregarAccion,
  asociarProgramaAccion,
  borrarAccion,
  crearPlataformaAccion,
  desactivarAccion,
  desasociarProgramaAccion,
  reactivarAccion,
  renombrarAccion,
  type ResultadoAccion,
} from "@/app/(app)/ajustes/catalogos/acciones";

/**
 * Componente generico de administracion de catalogos (ticket 013, enmienda del 20-sep).
 *
 * Recibe la lista de definiciones (slug + nombre visible) y los items ya leidos de
 * cada catalogo, y arma una pestaña por catalogo sobre UN solo componente. No sabe
 * nada de plataformas, motivos ni origenes: todo llega como dato, incluido si el
 * catalogo se vincula a programas (`programas`) y si este actor puede administrarlo
 * (`puedeAdministrar`). Agregar un catalogo nuevo no toca este archivo — solo el
 * registro (ADR 0012).
 *
 * Las mutaciones son server actions que vuelven a enforzar el rol y el acceso por
 * programa en el servidor; aca solo se muestran los controles y se refleja el
 * resultado. Esconder un boton no es seguridad.
 */

export interface ProgramaOpcion {
  id: string;
  nombre: string;
}

export interface ItemCatalogo {
  id: string;
  nombre: string;
  activo: boolean;
  /** Los programas que sirve, solo en los catalogos vinculados (ADR 0034). */
  programas?: string[];
}

export interface CatalogoVista {
  slug: string;
  nombre: string;
  items: ItemCatalogo[];
  /** Si este actor puede renombrar, desactivar y borrar (no solo crear y vincular). */
  puedeAdministrar: boolean;
  /** Los programas vinculables. Ausente = este catalogo no se vincula a programas. */
  programas?: ProgramaOpcion[];
}

export function CatalogosAdmin({ catalogos }: { catalogos: CatalogoVista[] }) {
  const [activo, setActivo] = useState(catalogos[0]?.slug ?? "");
  const actual = catalogos.find((c) => c.slug === activo) ?? catalogos[0];

  if (catalogos.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay catálogos que puedas administrar.</p>;
  }

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

      {actual ? <PanelCatalogo key={actual.slug} catalogo={actual} /> : null}
    </div>
  );
}

function PanelCatalogo({ catalogo }: { catalogo: CatalogoVista }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [nuevo, setNuevo] = useState("");
  const [programasNuevos, setProgramasNuevos] = useState<string[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");

  const programas = catalogo.programas;
  const seVincula = programas !== undefined;

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
   * Crear y vincular van JUNTOS en los catalogos vinculados: una plataforma sin
   * programa no sale en ningun selector, asi que crearla y asociarla despues deja un
   * hueco en el que el usuario no ve lo que acaba de crear y nada falla.
   */
  function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    const limpiar = () => {
      setNuevo("");
      setProgramasNuevos([]);
    };
    if (seVincula) {
      correr(() => crearPlataformaAccion(nombre, programasNuevos), "Agregado", limpiar);
    } else {
      correr(() => agregarAccion(catalogo.slug, nombre), "Agregado", limpiar);
    }
  }

  function guardarNombre(id: string) {
    const nombre = borrador.trim();
    if (!nombre) return;
    correr(() => renombrarAccion(catalogo.slug, id, nombre), "Renombrado");
    setEditando(null);
  }

  /**
   * Borrar es la unica operacion IRREVERSIBLE de la pantalla (ADR 0026 punto 5), asi
   * que pide confirmacion explicita. El verbo del mensaje sale de lo que de verdad
   * paso: si el item tiene referencias NO se borra —se dice cuantas y se ofrece
   * desactivar— y solo cuando se borro se dice "borrado".
   */
  function borrar(item: ItemCatalogo) {
    if (
      !window.confirm(`¿Borrar "${item.nombre}" para siempre? Esta acción no se puede deshacer.`)
    ) {
      return;
    }
    startTransition(async () => {
      const res = await borrarAccion(catalogo.slug, item.id);
      if (!res.ok) {
        toast.error("No se pudo borrar", { description: res.error });
        return;
      }
      if (res.borrado) {
        toast.success("Borrado");
        router.refresh();
      } else {
        toast.info("No se puede borrar", {
          description: `Lo usan ${res.referencias} registro(s).${
            item.activo ? " Desactívalo en vez de borrarlo." : ""
          }`,
        });
      }
    });
  }

  /** Prende o apaga el vinculo de un item con un programa. */
  function alternarPrograma(item: ItemCatalogo, programa: ProgramaOpcion, vinculado: boolean) {
    if (vinculado) {
      correr(
        () => desasociarProgramaAccion(item.id, programa.id),
        `${item.nombre} ya no sale en ${programa.nombre}`,
      );
    } else {
      correr(
        () => asociarProgramaAccion(item.id, programa.id),
        `${item.nombre} ya sale en ${programa.nombre}`,
      );
    }
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
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            agregar();
          }}
        >
          <div className="flex gap-2">
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
          </div>
          {seVincula && programas.length > 0 ? (
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="sr-only">Programas del nuevo elemento</legend>
              <span className="text-xs text-muted-foreground">Programas:</span>
              {programas.map((p) => {
                const elegido = programasNuevos.includes(p.id);
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={elegido ? "secondary" : "outline"}
                    aria-pressed={elegido}
                    onClick={() =>
                      setProgramasNuevos((antes) =>
                        elegido ? antes.filter((id) => id !== p.id) : [...antes, p.id],
                      )
                    }
                  >
                    {p.nombre}
                  </Button>
                );
              })}
            </fieldset>
          ) : null}
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
                className={cn("px-3 py-2 text-sm", !item.activo && "opacity-50")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                      {catalogo.puedeAdministrar ? (
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
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pendiente}
                            onClick={() => borrar(item)}
                            aria-label={`Borrar ${item.nombre}`}
                          >
                            <Trash2 className="size-4" />
                            Borrar
                          </Button>
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                {/* Los programas que sirve, si el catalogo se vincula (ADR 0034). Un
                    chip apagado NO es "desactivado": es que ahi no aparece. */}
                {seVincula && programas.length > 0 && editando !== item.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Sale en:</span>
                    {programas.map((p) => {
                      const vinculado = (item.programas ?? []).includes(p.id);
                      return (
                        <Button
                          key={p.id}
                          type="button"
                          size="sm"
                          variant={vinculado ? "secondary" : "outline"}
                          aria-pressed={vinculado}
                          disabled={pendiente}
                          onClick={() => alternarPrograma(item, p, vinculado)}
                        >
                          {p.nombre}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
