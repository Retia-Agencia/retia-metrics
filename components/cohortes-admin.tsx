"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fechaHoraEnBogota, usd } from "@/lib/format";
import { siguienteCodigoDeCohorte } from "@/lib/catalogo/codigo-de-cohorte";
import {
  activarCohorteAccion,
  crearCohorteAccion,
  desactivarCohorteAccion,
  editarCohorteAccion,
  pasarEsperandoCorteAccion,
  type ResultadoAccion,
} from "@/app/(app)/p/[programa]/programa/acciones-programa";
import type { DealEsperandoCorte } from "@/lib/queries/deals-esperando-corte";

/**
 * Administracion de las cohortes de un programa (ticket 014), solo gerente.
 *
 * Lista las cohortes del programa, permite crear, editar, activar y cerrar. La
 * regla de "una sola cohorte activa por programa" (ADR 0005) la garantiza la base:
 * si se intenta activar una segunda, la server action devuelve un 400 con mensaje
 * claro y aca se muestra como toast de error. Cerrar una cohorte la pasa a
 * `cerrado` (nunca se borra) y libera el cupo de activa.
 *
 * Una cohorte FUTURA puede quedar "por definir" (ticket 227): el inicio de clases, el
 * de ventas y el cierre son opcionales mientras es futura. Donde falta una fecha, la
 * lista muestra "Por definir". El esquema (y el CHECK de la base) exigen las tres en
 * cuanto deja de ser futura.
 */

const ESTADOS = ["futuro", "activo", "cerrado"] as const;
type Estado = (typeof ESTADOS)[number];

export interface CohorteVista {
  id: string;
  codigo: string;
  metaCupos: number;
  metaLeadsDia: number | null;
  precioUsd: string;
  /** Nula cuando la cohorte futura esta "por definir" (ticket 227). */
  fechaInicioClases: string | null;
  fechaInicioVentas: string | null;
  /** Nula cuando la cohorte futura esta "por definir" (ticket 227). */
  fechaCierreVentas: string | null;
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
  estado: "futuro",
};

function aBorrador(c: CohorteVista): Borrador {
  return {
    codigo: c.codigo,
    metaCupos: String(c.metaCupos),
    metaLeadsDia: c.metaLeadsDia === null ? "" : String(c.metaLeadsDia),
    precioUsd: c.precioUsd,
    fechaInicioClases: c.fechaInicioClases ?? "",
    fechaInicioVentas: c.fechaInicioVentas ?? "",
    fechaCierreVentas: c.fechaCierreVentas ?? "",
    estado: c.estado,
  };
}

export function CohortesAdmin({
  slug,
  programId,
  ticketUsd,
  cohortes,
  esperandoCorte,
}: {
  slug: string;
  programId: string;
  ticketUsd: string;
  cohortes: CohorteVista[];
  esperandoCorte: DealEsperandoCorte[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [destinoId, setDestinoId] = useState<string | null>(null);

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
  const siguienteCodigo = siguienteCodigoDeCohorte(cohortes.map((c) => c.codigo));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" disabled={pendiente || creando} onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Crear {siguienteCodigo}
        </Button>
      </div>

      {creando ? (
        <FormularioCohorte
          titulo="Nueva cohorte"
          inicial={{ ...BORRADOR_VACIO, codigo: siguienteCodigo, precioUsd: ticketUsd }}
          pendiente={pendiente}
          onCancelar={() => setCreando(false)}
          onGuardar={(b) =>
            correr(() => crearCohorteAccion(slug, aEntrada(b, programId)), "Cohorte creada", () =>
              setCreando(false),
            )
          }
        />
      ) : null}

      {esperandoCorte.length > 0 ? (
        <div className="space-y-3 rounded-lg bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              <span className="cifra">{esperandoCorte.length}</span> {esperandoCorte.length === 1 ? "deal espera" : "deals esperan"} corte
            </p>
            <Badge variant="info">Esperando corte</Badge>
          </div>
          <ul className="divide-y">
            {esperandoCorte.map((deal) => (
              <li key={deal.dealId} className="flex items-start gap-2 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={seleccionados.includes(deal.dealId)}
                  onChange={(e) => {
                    // Se lee antes: dentro del updater el evento ya no tiene currentTarget.
                    const marcado = e.currentTarget.checked;
                    setSeleccionados((actual) => marcado
                      ? [...actual, deal.dealId]
                      : actual.filter((id) => id !== deal.dealId));
                  }}
                  aria-label={`Elegir ${deal.nombreLead ?? deal.emailLead}`}
                />
                <div className="min-w-0">
                  <p className="font-medium">{deal.nombreLead ?? deal.emailLead}</p>
                  <p className="text-muted-foreground">{deal.textoCorte} · {deal.ownerNombre ?? "Sin dueño"}</p>
                  <p className="text-xs text-muted-foreground">Anotado {fechaHoraEnBogota(deal.anotadoEn)}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-52 flex-1 space-y-1 text-sm">
              <span className="text-muted-foreground">Pasar a</span>
              <Select
                value={destinoId}
                items={ordenadas.filter((c) => c.estado !== "cerrado").map((c) => ({ value: c.id, label: c.codigo }))}
                onValueChange={setDestinoId}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Elige la cohorte" /></SelectTrigger>
                <SelectContent>
                  {ordenadas.filter((c) => c.estado !== "cerrado").map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <Button
              size="sm"
              disabled={pendiente || seleccionados.length === 0 || !destinoId}
              onClick={() => destinoId && correr(
                () => pasarEsperandoCorteAccion(slug, { dealIds: seleccionados, destinoId }),
                `${seleccionados.length} ${seleccionados.length === 1 ? "deal movido" : "deals movidos"}`,
                () => setSeleccionados([]),
              )}
            >
              Pasar seleccionados
            </Button>
          </div>
        </div>
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
                      meta {c.metaCupos} · precio {usd(Number(c.precioUsd))} · ventas {c.fechaInicioVentas ?? "Por definir"} →{" "}
                      {c.fechaCierreVentas ?? "Por definir"} · clases {c.fechaInicioClases ?? "Por definir"}
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
    // Vacio ("") es "por definir": lo normaliza el esquema a null. Solo una cohorte futura
    // puede quedar sin estas fechas (ticket 227); el esquema rechaza el resto con un 400.
    fechaInicioClases: b.fechaInicioClases === "" ? null : b.fechaInicioClases,
    fechaInicioVentas: b.fechaInicioVentas === "" ? null : b.fechaInicioVentas,
    fechaCierreVentas: b.fechaCierreVentas === "" ? null : b.fechaCierreVentas,
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
            <span className="text-muted-foreground">Inicio de clases</span>
            <input
              type="date"
              value={borrador.fechaInicioClases}
              onChange={(e) => setBorrador({ ...borrador, fechaInicioClases: e.target.value })}
              required={borrador.estado !== "futuro"}
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
              required={borrador.estado !== "futuro"}
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
