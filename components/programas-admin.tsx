"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/format";
import {
  conectarCalendlyAccion,
  crearProgramaAccion,
  desactivarProgramaAccion,
  editarProgramaAccion,
  reactivarProgramaAccion,
  type ResultadoAccion,
} from "@/app/(app)/ajustes/programas/acciones";

/**
 * Administracion de programas (ticket 014), solo gerente.
 *
 * Lista los programas (activos e inactivos, estos ultimos atenuados) y permite
 * crear, editar, desactivar y reactivar. Desde cada programa se entra a sus
 * cohortes. El slug no se puede cambiar despues de creado, asi que al editar el
 * campo queda bloqueado. Las mutaciones son server actions que ya enforzan
 * `requireRole("gerente")` en el servidor.
 */

export interface ProgramaVista {
  id: string;
  slug: string;
  nombre: string;
  ticketUsd: string;
  /** Lo que gana un closer por venta, en USD (ticket 062). Nulo = sin cargar. */
  comisionPorVentaUsd: string | null;
  webUrl: string | null;
  calendlyUrl: string | null;
  /** URL base del formulario (ADR 0057). Un programa no se activa sin ella ni sin token. */
  formUrl: string | null;
  /** Si el programa ya tiene token de Calendly. El valor nunca llega al cliente (ADR 0057). */
  tieneTokenCalendly: boolean;
  /** Si el webhook de Calendly esta conectado. La clave nunca llega al cliente (ticket 096). */
  webhookCalendlyConectado: boolean;
  activo: boolean;
}

interface Borrador {
  nombre: string;
  slug: string;
  ticketUsd: string;
  comisionPorVentaUsd: string;
  webUrl: string;
  calendlyUrl: string;
  formUrl: string;
  /** Lo que se teclea o pega en Calendly Token. Nunca se rellena con el guardado. */
  tokenCalendly: string;
}

const BORRADOR_VACIO: Borrador = {
  nombre: "",
  slug: "",
  ticketUsd: "",
  comisionPorVentaUsd: "",
  webUrl: "",
  calendlyUrl: "",
  formUrl: "",
  tokenCalendly: "",
};

function aBorrador(p: ProgramaVista): Borrador {
  return {
    nombre: p.nombre,
    slug: p.slug,
    ticketUsd: p.ticketUsd,
    comisionPorVentaUsd: p.comisionPorVentaUsd ?? "",
    webUrl: p.webUrl ?? "",
    calendlyUrl: p.calendlyUrl ?? "",
    formUrl: p.formUrl ?? "",
    tokenCalendly: "",
  };
}

export function ProgramasAdmin({ programas }: { programas: ProgramaVista[] }) {
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

  const ordenados = [...programas].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" disabled={pendiente || creando} onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Nuevo programa
        </Button>
      </div>

      {creando ? (
        <FormularioPrograma
          titulo="Nuevo programa"
          inicial={BORRADOR_VACIO}
          pendiente={pendiente}
          onCancelar={() => setCreando(false)}
          onGuardar={(b) =>
            correr(() => crearProgramaAccion(aEntrada(b), b.tokenCalendly), "Programa creado", () =>
              setCreando(false),
            )
          }
        />
      ) : null}

      <ul className="divide-y rounded-md border">
        {ordenados.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">Todavía no hay programas.</li>
        ) : (
          ordenados.map((p) => (
            <li key={p.id} className={cn("px-3 py-3 text-sm", !p.activo && "opacity-50")}>
              {editando === p.id ? (
                <FormularioPrograma
                  titulo={`Editar ${p.nombre}`}
                  inicial={aBorrador(p)}
                  pendiente={pendiente}
                  slugBloqueado
                  tieneTokenCalendly={p.tieneTokenCalendly}
                  onCancelar={() => setEditando(null)}
                  onGuardar={(b) =>
                    correr(
                      () => editarProgramaAccion(p.id, aEntrada(b), b.tokenCalendly),
                      "Programa actualizado",
                      () => setEditando(null),
                    )
                  }
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{p.nombre}</span>
                        {!p.activo ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            inactivo
                          </Badge>
                        ) : null}
                        {p.tieneTokenCalendly ? (
                          <Badge variant="secondary">token cargado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            sin token
                          </Badge>
                        )}
                        {p.webhookCalendlyConectado ? (
                          <Badge variant="secondary">webhook conectado</Badge>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        /{p.slug} · ticket {usd(Number(p.ticketUsd))} ·{" "}
                        {p.comisionPorVentaUsd != null
                          ? `comisión ${usd(Number(p.comisionPorVentaUsd))} por venta`
                          : "sin comisión cargada"}
                      </span>
                    </div>
                    <span className="flex items-center gap-1">
                      {p.activo ? (
                        <>
                          {/* `nativeButton={false}`: se renderiza como <a>, no como
                              <button>. Sin eso Base UI avisa en consola que se pierde
                              la semantica nativa de boton. */}
                          <Button
                            size="sm"
                            variant="ghost"
                            nativeButton={false}
                            disabled={pendiente}
                            render={<Link href={`/ajustes/programas/${p.slug}`}>Cohortes</Link>}
                          />
                          {p.tieneTokenCalendly ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pendiente}
                              onClick={() =>
                                correr(
                                  () => conectarCalendlyAccion(p.id),
                                  p.webhookCalendlyConectado ? "Webhook de Calendly rehecho" : "Calendly conectado",
                                )
                              }
                            >
                              {p.webhookCalendlyConectado ? "Rehacer webhook" : "Conectar Calendly"}
                            </Button>
                          ) : null}
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
                              correr(() => desactivarProgramaAccion(p.id), "Programa desactivado")
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
                            correr(() => reactivarProgramaAccion(p.id), "Programa reactivado")
                          }
                        >
                          <RotateCcw className="size-4" />
                          Reactivar
                        </Button>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Convierte el borrador del formulario a la entrada que espera la server action. */
function aEntrada(b: Borrador) {
  return {
    nombre: b.nombre,
    slug: b.slug,
    ticketUsd: b.ticketUsd,
    comisionPorVentaUsd: b.comisionPorVentaUsd,
    webUrl: b.webUrl,
    calendlyUrl: b.calendlyUrl,
    formUrl: b.formUrl,
  };
}

function FormularioPrograma({
  titulo,
  inicial,
  pendiente,
  slugBloqueado,
  tieneTokenCalendly = false,
  onCancelar,
  onGuardar,
}: {
  titulo: string;
  inicial: Borrador;
  pendiente: boolean;
  slugBloqueado?: boolean;
  /** Si ya hay token guardado: el campo puede quedar vacio y se conserva. */
  tieneTokenCalendly?: boolean;
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
            <span className="text-muted-foreground">Nombre</span>
            <input
              value={borrador.nombre}
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              maxLength={120}
              required
              className={claseInput}
              aria-label="Nombre"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">
              Slug {slugBloqueado ? "(no se puede cambiar)" : "(minúsculas, números y guiones)"}
            </span>
            <input
              value={borrador.slug}
              onChange={(e) => setBorrador({ ...borrador, slug: e.target.value })}
              disabled={slugBloqueado}
              maxLength={60}
              required
              className={claseInput}
              aria-label="Slug"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Ticket (USD)</span>
            <input
              value={borrador.ticketUsd}
              onChange={(e) => setBorrador({ ...borrador, ticketUsd: e.target.value })}
              inputMode="decimal"
              required
              className={claseInput}
              aria-label="Ticket en USD"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Comisión por venta (USD)</span>
            <input
              value={borrador.comisionPorVentaUsd}
              onChange={(e) => setBorrador({ ...borrador, comisionPorVentaUsd: e.target.value })}
              inputMode="decimal"
              placeholder="Monto fijo por venta, por ejemplo 80"
              className={claseInput}
              aria-label="Comisión por venta en USD"
            />
          </label>

          {/* `webUrl` y `calendlyUrl` ya no se muestran (vacias en produccion y sin
              lector, 28-sep): el borrador las pasa tal cual para no pisar nada. */}
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Forms Link</span>
            <input
              type="url"
              value={borrador.formUrl}
              onChange={(e) => setBorrador({ ...borrador, formUrl: e.target.value })}
              required
              placeholder="https://form.typeform.com/to/..."
              className={claseInput}
              aria-label="Forms Link"
            />
          </label>

          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Calendly Token</span>
            {/* type="password": se ve con puntos y se puede pegar. El valor guardado
                nunca vuelve al navegador (ADR 0057), asi que el campo arranca vacio;
                autoComplete="new-password" evita que el gestor del navegador lo llene. */}
            <input
              type="password"
              autoComplete="new-password"
              value={borrador.tokenCalendly}
              onChange={(e) => setBorrador({ ...borrador, tokenCalendly: e.target.value })}
              required={!tieneTokenCalendly}
              placeholder={tieneTokenCalendly ? "Cargado. Déjalo vacío para conservarlo" : ""}
              className={claseInput}
              aria-label="Calendly Token"
            />
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pendiente || !borrador.nombre.trim() || !borrador.slug.trim()}
            >
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
