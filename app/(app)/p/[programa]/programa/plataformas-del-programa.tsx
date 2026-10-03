"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  asociarPlataformaAccion,
  crearEnlacePagoAccion,
  crearOVincularPlataformaAccion,
  desactivarEnlacePagoAccion,
  desasociarPlataformaAccion,
  reemplazarEnlacePagoAccion,
  type ResultadoAccion,
} from "./acciones";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { monto as formatoMonto } from "@/lib/format";
import { MONEDAS } from "@/lib/monedas";

type Plataforma = { id: string; nombre: string };

/** Un enlace de pago vigente de este programa, agrupado bajo su plataforma. */
export type EnlaceDePlataforma = {
  id: string;
  url: string;
  monto: string;
  moneda: string;
  plataformaId: string;
};

const claseInput =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Seccion "Plataformas de pago" de la tab Programa (ticket 171, ADR 0077): aqui se dan
 * de alta los medios de cobro del programa y SUS links de pago. `/recursos` ya solo los
 * muestra en lectura para que el closer los copie.
 *
 * Todo el que ve la tab ve esta seccion; la reja de verdad son las acciones, que vuelven
 * a exigir el rol y el acceso al programa en el servidor (ADR 0003): un closer sin
 * membresia en este programa recibe el 403 de `exigirAccesoAlPrograma` y la base no se
 * mueve. Un boton visible no es un permiso.
 *
 * MOBILE-FIRST: tarjetas y listas que envuelven, URLs con `break-all`; los closers
 * trabajan desde el telefono.
 */
export function PlataformasDelPrograma({
  programId,
  plataformas,
  disponibles,
  enlaces,
}: {
  programId: string;
  plataformas: Plataforma[];
  disponibles: Plataforma[];
  enlaces: EnlaceDePlataforma[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [plataformaId, setPlataformaId] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState<string | null>(null);

  function correr(accion: () => Promise<ResultadoAccion>, exito: string, alExito?: () => void) {
    startTransition(async () => {
      const resultado = await accion();
      if (resultado.ok) {
        toast.success(exito);
        alExito?.();
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: resultado.error });
      }
    });
  }

  /** Los enlaces vigentes de una plataforma concreta. */
  function enlacesDe(plataforma: string): EnlaceDePlataforma[] {
    return enlaces.filter((e) => e.plataformaId === plataforma);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los closers copian estos links desde Recursos para cobrar.
      </p>

      {plataformas.length === 0 ? (        <p className="text-sm text-muted-foreground">
          Este programa todavía no tiene plataformas de pago.
        </p>
      ) : (
        <ul className="space-y-3">
          {plataformas.map((plataforma) => (
            <PlataformaItem
              key={plataforma.id}
              programId={programId}
              plataforma={plataforma}
              enlaces={enlacesDe(plataforma.id)}
              pendiente={pendiente}
              correr={correr}
            />
          ))}
        </ul>
      )}

      {/* Dar de alta un medio de cobro: por nombre libre (lo crea o lo reusa) o
          vinculando uno que ya existe en otro programa. */}
      <div className="flex flex-col gap-2 rounded-md border p-3">
        {disponibles.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={plataformaId}
              items={disponibles.map((plataforma) => ({
                value: plataforma.id,
                label: plataforma.nombre,
              }))}
              onValueChange={(valor: string | null) => setPlataformaId(valor)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Vincular una plataforma existente" />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map((plataforma) => (
                  <SelectItem key={plataforma.id} value={plataforma.id}>
                    {plataforma.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              disabled={pendiente || !plataformaId}
              onClick={() => {
                if (plataformaId) {
                  correr(
                    () => asociarPlataformaAccion(plataformaId, programId),
                    "Plataforma vinculada",
                    () => setPlataformaId(null),
                  );
                }
              }}
            >
              Vincular
            </Button>
          </div>
        ) : null}

        {nombreNuevo === null ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            disabled={pendiente}
            onClick={() => setNombreNuevo("")}
          >
            <Plus className="size-4" />
            Nueva plataforma
          </Button>
        ) : (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const nombre = nombreNuevo.trim();
              if (nombre) {
                correr(
                  () => crearOVincularPlataformaAccion(nombre, programId),
                  "Plataforma lista",
                  () => setNombreNuevo(null),
                );
              }
            }}
          >
            <input
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Nombre de la plataforma"
              aria-label="Nombre de la plataforma nueva"
              maxLength={80}
              autoFocus
              className={cn(claseInput, "sm:w-56")}
            />
            <div className="flex items-center gap-1">
              <Button type="submit" size="sm" disabled={pendiente || !nombreNuevo.trim()}>
                Crear
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setNombreNuevo(null)}
                aria-label="Cancelar"
              >
                <X className="size-4" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Una plataforma vinculada, con sus links de pago y el alta de nuevos. */
function PlataformaItem({
  programId,
  plataforma,
  enlaces,
  pendiente,
  correr,
}: {
  programId: string;
  plataforma: Plataforma;
  enlaces: EnlaceDePlataforma[];
  pendiente: boolean;
  correr: (accion: () => Promise<ResultadoAccion>, exito: string, alExito?: () => void) => void;
}) {
  const [agregando, setAgregando] = useState(false);

  return (
    <li className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{plataforma.nombre}</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pendiente}
          onClick={() =>
            correr(
              () => desasociarPlataformaAccion(plataforma.id, programId),
              "Plataforma desvinculada",
            )
          }
          aria-label={`Quitar ${plataforma.nombre}`}
        >
          <X className="size-4" />
        </Button>
      </div>

      {enlaces.length > 0 ? (
        <ul className="mt-2 space-y-2 border-t pt-2">
          {enlaces.map((enlace) => (
            <EnlaceItem
              key={enlace.id}
              enlace={enlace}
              pendiente={pendiente}
              onReemplazar={(nuevaUrl, reset) =>
                correr(
                  () => reemplazarEnlacePagoAccion(enlace.id, nuevaUrl),
                  "Enlace reemplazado",
                  reset,
                )
              }
              onRetirar={() =>
                correr(() => desactivarEnlacePagoAccion(enlace.id), "Enlace retirado")
              }
            />
          ))}
        </ul>
      ) : null}

      {agregando ? (
        <FormularioEnlace
          programId={programId}
          plataformaId={plataforma.id}
          pendiente={pendiente}
          onCrear={(entrada, reset) =>
            correr(() => crearEnlacePagoAccion(entrada), "Enlace agregado", () => {
              reset();
              setAgregando(false);
            })
          }
          onCancelar={() => setAgregando(false)}
        />
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2"
          disabled={pendiente}
          onClick={() => setAgregando(true)}
        >
          <Plus className="size-4" />
          Agregar link
        </Button>
      )}
    </li>
  );
}

/** Botones copiar y abrir un link. */
function AccionesEnlace({ url }: { url: string }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button size="sm" variant="ghost" onClick={copiar} aria-label="Copiar link">
        <Copy className="size-4" />
        Copiar
      </Button>
      {/* base-ui no acepta `asChild`; un ancla estilizada con `buttonVariants` abre en
          pestaña nueva sin recrear el boton. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        aria-label="Abrir link"
      >
        <ExternalLink className="size-4" />
        Abrir
      </a>
    </span>
  );
}

/** Un link de pago vigente: copiar/abrir, reemplazar la URL y retirar. */
function EnlaceItem({
  enlace,
  pendiente,
  onReemplazar,
  onRetirar,
}: {
  enlace: EnlaceDePlataforma;
  pendiente: boolean;
  onReemplazar: (nuevaUrl: string, reset: () => void) => void;
  onRetirar: () => void;
}) {
  const [reemplazando, setReemplazando] = useState(false);
  const [nuevaUrl, setNuevaUrl] = useState("");

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {/* La moneda SIEMPRE al lado del monto (AGENTS.md). */}
          <span className="cifra font-medium">
            {formatoMonto(Number(enlace.monto), enlace.moneda)}
          </span>
          <a
            href={enlace.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {enlace.url}
          </a>
        </div>
        <AccionesEnlace url={enlace.url} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={pendiente}
          onClick={() => setReemplazando((v) => !v)}
        >
          Editar
        </Button>
        <Button size="sm" variant="ghost" disabled={pendiente} onClick={onRetirar}>
          Retirar
        </Button>
      </div>

      {reemplazando ? (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onReemplazar(nuevaUrl.trim(), () => {
              setNuevaUrl("");
              setReemplazando(false);
            });
          }}
        >
          <input
            value={nuevaUrl}
            onChange={(e) => setNuevaUrl(e.target.value)}
            type="url"
            required
            placeholder="https://…"
            aria-label="Nueva URL del enlace de pago"
            className={claseInput}
          />
          <div className="flex items-center gap-1">
            <Button type="submit" size="sm" disabled={pendiente || !nuevaUrl.trim()}>
              Guardar
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setReemplazando(false)}
              aria-label="Cancelar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** Formulario para agregar un link de pago a una plataforma de este programa. */
function FormularioEnlace({
  programId,
  plataformaId,
  pendiente,
  onCrear,
  onCancelar,
}: {
  programId: string;
  plataformaId: string;
  pendiente: boolean;
  onCrear: (
    entrada: {
      programId: string;
      plataformaId: string;
      monto: string;
      moneda: (typeof MONEDAS)[number];
      url: string;
    },
    reset: () => void,
  ) => void;
  onCancelar: () => void;
}) {
  const [montoValor, setMontoValor] = useState("");
  const [moneda, setMoneda] = useState<(typeof MONEDAS)[number]>("USD");
  const [url, setUrl] = useState("");

  function reset() {
    setMontoValor("");
    setMoneda("USD");
    setUrl("");
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2 border-t pt-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onCrear(
          { programId, plataformaId, monto: montoValor.trim(), moneda, url: url.trim() },
          reset,
        );
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Monto</span>
        <input
          value={montoValor}
          onChange={(e) => setMontoValor(e.target.value)}
          inputMode="decimal"
          required
          className={cn(claseInput, "sm:w-28")}
          aria-label="Monto"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Moneda</span>
        <select
          value={moneda}
          onChange={(e) => setMoneda(e.target.value as (typeof MONEDAS)[number])}
          className={cn(claseInput, "sm:w-24")}
          aria-label="Moneda"
        >
          {MONEDAS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">URL</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
          placeholder="https://…"
          className={cn(claseInput, "sm:w-56")}
          aria-label="URL del enlace de pago"
        />
      </label>
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={pendiente || !montoValor.trim() || !url.trim()}>
          <Check className="size-4" />
          Agregar
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onCancelar} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
