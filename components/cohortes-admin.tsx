"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  activarCohorteAccion,
  crearCohorteAccion,
  desactivarCohorteAccion,
  editarCohorteAccion,
  type ResultadoAccion,
} from "@/app/(app)/ajustes/programas/acciones";

/**
 * Administracion de las cohortes de un programa (ticket 014), solo gerente.
 *
 * Lista las cohortes del programa, permite crear, editar, activar y cerrar. La
 * regla de "una sola cohorte activa por programa" (ADR 0005) la garantiza la base:
 * si se intenta activar una segunda, la server action devuelve un 400 con mensaje
 * claro y aca se muestra como toast de error. Cerrar una cohorte la pasa a
 * `cerrado` (nunca se borra) y libera el cupo de activa.
 */

const ESTADOS = ["futuro", "activo", "cerrado"] as const;
type Estado = (typeof ESTADOS)[number];

export interface CohorteVista {
  id: string;
  codigo: string;
  metaCupos: number;
  metaLeadsDia: number | null;
  precioUsd: string;
  fechaInicioClases: string;
  fechaInicioVentas: string | null;
  fechaCierreVentas: string;
  trmCohorte: string;
  estado: Estado;
}

interface Borrador {
  codigo: string;
  metaCupos: string;
  metaLeadsDia: string;
  precioUsd: string;
  fechaInicioClases: string;
  fechaInicioVentas: string;
  fechaCierreVentas: string;
  trmCohorte: string;
  estado: Estado;
}

const BORRADOR_VACIO: Borrador = {
  codigo: "",
  metaCupos: "",
  metaLeadsDia: "",
  precioUsd: "",
  fechaInicioClases: "",
  fechaInicioVentas: "",
  fechaCierreVentas: "",
  trmCohorte: "4000",
  estado: "futuro",
};

function aBorrador(c: CohorteVista): Borrador {
  return {
    codigo: c.codigo,
    metaCupos: String(c.metaCupos),
    metaLeadsDia: c.metaLeadsDia === null ? "" : String(c.metaLeadsDia),
    precioUsd: c.precioUsd,
    fechaInicioClases: c.fechaInicioClases,
    fechaInicioVentas: c.fechaInicioVentas ?? "",
    fechaCierreVentas: c.fechaCierreVentas,
    trmCohorte: c.trmCohorte,
    estado: c.estado,
  };
}

export function CohortesAdmin({
  slug,
  programId,
  cohortes,
}: {
  slug: string;
  programId: string;
  cohortes: CohorteVista[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
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

  const ordenadas = [...cohortes].sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" disabled={pendiente || creando} onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Nueva cohorte
        </Button>
      </div>

      {creando ? (
        <FormularioCohorte
          titulo="Nueva cohorte"
          inicial={BORRADOR_VACIO}
          pendiente={pendiente}
          onCancelar={() => setCreando(false)}
          onGuardar={(b) =>
            correr(() => crearCohorteAccion(slug, aEntrada(b, programId)), "Cohorte creada", () =>
              setCreando(false),
            )
          }
        />
      ) : null}

      <ul className="divide-y rounded-md border">
        {ordenadas.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            Este programa todavía no tiene cohortes.
          </li>
        ) : (
          ordenadas.map((c) => (
            <li key={c.id} className={cn("px-3 py-3 text-sm", c.estado === "cerrado" && "opacity-50")}>
              {editando === c.id ? (
                <FormularioCohorte
                  titulo={`Editar ${c.codigo}`}
                  inicial={aBorrador(c)}
                  pendiente={pendiente}
                  onCancelar={() => setEditando(null)}
                  onGuardar={(b) =>
                    correr(
                      () => editarCohorteAccion(slug, c.id, aEntrada(b, programId)),
                      "Cohorte actualizada",
                      () => setEditando(null),
                    )
                  }
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{c.codigo}</span>
                      <Badge
                        variant={c.estado === "activo" ? "secondary" : "outline"}
                        className={c.estado !== "activo" ? "text-muted-foreground" : undefined}
                      >
                        {c.estado}
                      </Badge>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      meta {c.metaCupos} · precio USD {c.precioUsd} · TRM {c.trmCohorte} ·{" "}
                      {c.fechaInicioClases} → {c.fechaCierreVentas}
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendiente}
                      onClick={() => setEditando(c.id)}
                    >
                      Editar
                    </Button>
                    {c.estado !== "activo" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendiente}
                        onClick={() =>
                          correr(() => activarCohorteAccion(slug, c.id), "Cohorte activada")
                        }
                      >
                        Activar
                      </Button>
                    ) : null}
                    {c.estado !== "cerrado" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendiente}
                        onClick={() =>
                          correr(() => desactivarCohorteAccion(slug, c.id), "Cohorte cerrada")
                        }
                      >
                        Cerrar
                      </Button>
                    ) : null}
                  </span>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Convierte el borrador a la entrada que espera la server action. */
function aEntrada(b: Borrador, programId: string) {
  return {
    programId,
    codigo: b.codigo,
    metaCupos: b.metaCupos,
    metaLeadsDia: b.metaLeadsDia === "" ? null : b.metaLeadsDia,
    precioUsd: b.precioUsd,
    fechaInicioClases: b.fechaInicioClases,
    fechaInicioVentas: b.fechaInicioVentas === "" ? null : b.fechaInicioVentas,
    fechaCierreVentas: b.fechaCierreVentas,
    trmCohorte: b.trmCohorte,
    estado: b.estado,
  };
}

function FormularioCohorte({
  titulo,
  inicial,
  pendiente,
  onCancelar,
  onGuardar,
}: {
  titulo: string;
  inicial: Borrador;
  pendiente: boolean;
  onCancelar: () => void;
  onGuardar: (borrador: Borrador) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);

  const claseInput =
    "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <Button size="icon-sm" variant="ghost" onClick={onCancelar} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onGuardar(borrador);
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Código</span>
            <input
              value={borrador.codigo}
              onChange={(e) => setBorrador({ ...borrador, codigo: e.target.value })}
              maxLength={20}
              required
              className={claseInput}
              aria-label="Código"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Estado</span>
            <select
              value={borrador.estado}
              onChange={(e) => setBorrador({ ...borrador, estado: e.target.value as Estado })}
              className={claseInput}
              aria-label="Estado"
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Meta de cupos</span>
            <input
              value={borrador.metaCupos}
              onChange={(e) => setBorrador({ ...borrador, metaCupos: e.target.value })}
              inputMode="numeric"
              required
              className={claseInput}
              aria-label="Meta de cupos"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Meta de leads/día (opcional)</span>
            <input
              value={borrador.metaLeadsDia}
              onChange={(e) => setBorrador({ ...borrador, metaLeadsDia: e.target.value })}
              inputMode="numeric"
              className={claseInput}
              aria-label="Meta de leads por día"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Precio de referencia (USD)</span>
            <input
              value={borrador.precioUsd}
              onChange={(e) => setBorrador({ ...borrador, precioUsd: e.target.value })}
              inputMode="decimal"
              required
              className={claseInput}
              aria-label="Precio en USD"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">TRM de la cohorte (COP/USD)</span>
            <input
              value={borrador.trmCohorte}
              onChange={(e) => setBorrador({ ...borrador, trmCohorte: e.target.value })}
              inputMode="decimal"
              required
              className={claseInput}
              aria-label="TRM de la cohorte"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Inicio de clases</span>
            <input
              type="date"
              value={borrador.fechaInicioClases}
              onChange={(e) => setBorrador({ ...borrador, fechaInicioClases: e.target.value })}
              required
              className={claseInput}
              aria-label="Fecha de inicio de clases"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Inicio de ventas</span>
            <input
              type="date"
              value={borrador.fechaInicioVentas}
              onChange={(e) => setBorrador({ ...borrador, fechaInicioVentas: e.target.value })}
              required={borrador.estado === "activo"}
              className={claseInput}
              aria-label="Fecha de inicio de ventas"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Cierre de ventas</span>
            <input
              type="date"
              value={borrador.fechaCierreVentas}
              onChange={(e) => setBorrador({ ...borrador, fechaCierreVentas: e.target.value })}
              required
              className={claseInput}
              aria-label="Fecha de cierre de ventas"
            />
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pendiente || !borrador.codigo.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
