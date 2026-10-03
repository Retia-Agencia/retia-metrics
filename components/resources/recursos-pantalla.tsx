"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Copy, ExternalLink, History, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { monto as formatoMonto } from "@/lib/format";
import {
  borrarRecursoAccion,
  crearRecursoAccion,
  desactivarRecursoAccion,
  reemplazarRecursoAccion,
  type ResultadoAccion,
} from "@/app/(app)/recursos/acciones";
import { agruparEnlaces, GLOBAL } from "@/components/resources/helpers";
import { FiltroSelect } from "@/components/filtros/filtro-select";
import type {
  EnlaceUI,
  ProgramaOpcion,
  RecursoUI,
} from "@/components/resources/types";
export type {
  EnlaceUI,
  ProgramaOpcion,
  RecursoUI,
} from "@/components/resources/types";

/**
 * Pantalla de recursos (ticket 023, ADR 0017; enmienda del ticket 171): lista los
 * recursos libres (brochures, guiones, Calendly…) y los links de pago vigentes, y deja
 * copiarlos o abrirlos en un clic.
 *
 * Desde el ticket 171 los recursos ya NO se categorizan (ADR 0077: la categoria era un
 * catalogo que nadie leia para decidir) y los links de pago son de SOLO LECTURA aqui:
 * se administran en la seccion "Plataformas de pago" de la tab Programa. Crear o
 * reemplazar un recurso sigue viviendo aqui.
 *
 * MOBILE-FIRST (criterio de aceptacion: los closers trabajan desde el telefono, sin
 * scroll horizontal): nada de tablas de ancho fijo, todo son tarjetas y listas que
 * envuelven, y las URLs largas cortan con `break-all` en vez de estirar el layout.
 *
 * El filtro (programa + titulo) vive en la URL (ADR 0023): un dashboard de recursos
 * filtrado se puede compartir y recargar. El titulo de un brochure no es un dato
 * personal, asi que —a diferencia de `/mi-dia`— si conviene que viaje en la URL. El
 * programa viaja como SLUG (id opaco, nunca un dato personal).
 *
 * `esAdmin` + `programasEditables` deciden quien ve los controles de edicion de los
 * recursos, pero NO son la barrera de seguridad: cada server action vuelve a exigir el
 * rol y el acceso por programa en el servidor (ADR 0003). Un administrador (gerente o
 * developer) edita todo, incluido lo global; un closer solo los recursos de los
 * programas donde tiene membresia activa, y NUNCA un recurso global.
 */

interface Props {
  /** Administra todo: cualquier programa y los recursos globales (gerente/developer). */
  esAdmin: boolean;
  /** Programas (uuids) que un closer puede editar. Vacio para quien no edita nada. */
  programasEditables: string[];
  q: string | null;
  programas: ProgramaOpcion[];
  recursos: RecursoUI[];
  enlaces: EnlaceUI[];
}

const claseInput =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RecursosPantalla({
  esAdmin,
  programasEditables,
  q,
  programas,
  recursos,
  enlaces,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  // ¿Puede el usuario CREAR algo? Un admin siempre; un closer si tiene algun programa
  // editable. Los programas que puede elegir al crear: todos si es admin, solo los
  // suyos si es closer. Un closer NUNCA ve la opcion "Global" (asimetria de Mani).
  const editables = new Set(programasEditables);
  const puedeCrear = esAdmin || programasEditables.length > 0;
  const programasParaCrear = esAdmin
    ? programas
    : programas.filter((p) => editables.has(p.id));

  /** ¿Puede el usuario editar/desactivar/reemplazar este recurso? */
  function puedeEditarRecurso(r: RecursoUI): boolean {
    if (esAdmin) return true;
    return r.programId !== null && editables.has(r.programId);
  }

  function navegar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(busqueda.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") params.delete(clave);
      else params.set(clave, valor);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

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
   * Borrar es la unica operacion IRREVERSIBLE de la pantalla (ADR 0026 punto 5), asi
   * que pide confirmacion explicita. El verbo del mensaje sale de lo que de verdad
   * paso: un recurso con historial NO se borra —se dice cuantas versiones lo
   * encadenan y se ofrece desactivar— y solo cuando se borro se dice "borrado".
   */
  function borrarRecurso(recurso: RecursoUI) {
    if (
      !window.confirm(
        `¿Borrar "${recurso.titulo}" para siempre? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await borrarRecursoAccion(recurso.id);
      if (!res.ok) {
        toast.error("No se pudo borrar", { description: res.error });
        return;
      }
      if (res.borrado) {
        toast.success("Recurso borrado");
        router.refresh();
      } else {
        toast.info("No se puede borrar", {
          description: `Tiene ${res.referencias} versión(es) en su historial. Desactívalo en vez de borrarlo.`,
        });
      }
    });
  }

  const enlacesAgrupados = useMemo(() => agruparEnlaces(enlaces), [enlaces]);

  return (
    <div className="space-y-8">
      {/* Filtro: vive en la URL (ADR 0023). Envuelve en pantallas angostas. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <FiltroSelect
          nombre="programa"
          etiqueta="Programa"
          todos="Todos los programas"
          className="w-full sm:w-56"
          opciones={programas.map((p) => ({ value: p.slug, label: p.nombre }))}
        />

        <input
          type="search"
          defaultValue={q ?? ""}
          placeholder="Buscar por título…"
          aria-label="Buscar por título"
          className={cn(claseInput, "sm:w-64")}
          onChange={(e) => {
            const valor = e.target.value.trim();
            navegar({ q: valor === "" ? null : valor });
          }}
        />
      </div>

      {/* ── Recursos ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Recursos</h2>

        {puedeCrear ? (
          <CrearRecurso
            programas={programasParaCrear}
            permitirGlobal={esAdmin}
            pendiente={pendiente}
            onCrear={(entrada, reset) =>
              correr(() => crearRecursoAccion(entrada), "Recurso creado", reset)
            }
          />
        ) : null}

        {recursos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay recursos que coincidan.</p>
        ) : (
          <ul className="space-y-2">
            {recursos.map((r) => (
              <RecursoItem
                key={r.id}
                recurso={r}
                puedeEditar={puedeEditarRecurso(r)}
                pendiente={pendiente}
                onReemplazar={(nuevaUrl, reset) =>
                  correr(() => reemplazarRecursoAccion(r.id, nuevaUrl), "Recurso reemplazado", reset)
                }
                onDesactivar={() =>
                  correr(() => desactivarRecursoAccion(r.id), "Recurso desactivado")
                }
                onBorrar={() => borrarRecurso(r)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Enlaces de pago (solo lectura; se administran en la tab Programa) ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Enlaces de pago</h2>

        {enlacesAgrupados.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay enlaces de pago que coincidan.</p>
        ) : (
          <div className="space-y-4">
            {enlacesAgrupados.map((grupo) => (
              <Card key={grupo.programa}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">{grupo.programa}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {grupo.enlaces.map((e) => (
                      <EnlaceItem key={e.id} enlace={e} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Botones copiar y abrir; comparten estilo entre recurso y enlace. */
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
      {/* La UI de base-ui no acepta `asChild` aqui; un ancla estilizada con
          `buttonVariants` abre en pestaña nueva sin recrear el boton. */}
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

/** Formulario en linea para reemplazar la URL de una entidad versionada. */
function FormularioReemplazar({
  pendiente,
  etiqueta,
  onGuardar,
  onCancelar,
}: {
  pendiente: boolean;
  etiqueta: string;
  onGuardar: (nuevaUrl: string, reset: () => void) => void;
  onCancelar: () => void;
}) {
  const [nuevaUrl, setNuevaUrl] = useState("");
  return (
    <form
      className="mt-2 flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(nuevaUrl.trim(), () => setNuevaUrl(""));
      }}
    >
      <input
        value={nuevaUrl}
        onChange={(e) => setNuevaUrl(e.target.value)}
        type="url"
        required
        placeholder="https://…"
        aria-label={etiqueta}
        className={claseInput}
      />
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={pendiente || !nuevaUrl.trim()}>
          Guardar
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onCancelar} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}

function RecursoItem({
  recurso,
  puedeEditar,
  pendiente,
  onReemplazar,
  onDesactivar,
  onBorrar,
}: {
  recurso: RecursoUI;
  puedeEditar: boolean;
  pendiente: boolean;
  onReemplazar: (nuevaUrl: string, reset: () => void) => void;
  onDesactivar: () => void;
  onBorrar: () => void;
}) {
  const [verHistorial, setVerHistorial] = useState(false);
  const [reemplazando, setReemplazando] = useState(false);

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{recurso.titulo}</span>
            <span className="text-xs text-muted-foreground">
              {recurso.programaNombre ?? "Global"}
            </span>
          </span>
          {/* La URL corta en vez de estirar el layout en el telefono. */}
          <a
            href={recurso.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {recurso.url}
          </a>
        </div>
        <AccionesEnlace url={recurso.url} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {recurso.historial.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVerHistorial((v) => !v)}
            aria-expanded={verHistorial}
          >
            <History className="size-4" />
            Historial ({recurso.historial.length})
            <ChevronDown className={cn("size-4 transition-transform", verHistorial && "rotate-180")} />
          </Button>
        ) : null}
        {puedeEditar ? (
          <>
            <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => setReemplazando((v) => !v)}>
              Reemplazar
            </Button>
            <Button size="sm" variant="ghost" disabled={pendiente} onClick={onDesactivar}>
              Desactivar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pendiente}
              onClick={onBorrar}
              aria-label={`Borrar ${recurso.titulo}`}
            >
              <Trash2 className="size-4" />
              Borrar
            </Button>
          </>
        ) : null}
      </div>

      {reemplazando && puedeEditar ? (
        <FormularioReemplazar
          pendiente={pendiente}
          etiqueta="Nueva URL del recurso"
          onGuardar={(nuevaUrl, reset) =>
            onReemplazar(nuevaUrl, () => {
              reset();
              setReemplazando(false);
            })
          }
          onCancelar={() => setReemplazando(false)}
        />
      ) : null}

      {verHistorial && recurso.historial.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t pt-2">
          {recurso.historial.map((v) => (
            <li key={v.id}>
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {v.url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Un enlace de pago vigente, en SOLO LECTURA: copiar o abrir. Se edita en la tab Programa. */
function EnlaceItem({ enlace }: { enlace: EnlaceUI }) {
  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            {/* La moneda SIEMPRE al lado del monto, con `monto()` (AGENTS.md). */}
            <span className="cifra font-medium">
              {formatoMonto(Number(enlace.monto), enlace.moneda)}
            </span>
            {enlace.plataformaNombre ? (
              <span className="text-xs text-muted-foreground">{enlace.plataformaNombre}</span>
            ) : null}
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
    </li>
  );
}

/** Formulario en linea para crear un recurso (gerente, developer o closer). */
function CrearRecurso({
  programas,
  permitirGlobal,
  pendiente,
  onCrear,
}: {
  programas: ProgramaOpcion[];
  /** Solo un administrador puede crear un recurso global; un closer, no (asimetria). */
  permitirGlobal: boolean;
  pendiente: boolean;
  onCrear: (
    entrada: { programId: string | null; titulo: string; url: string },
    reset: () => void,
  ) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  // GLOBAL = recurso global (sin programa). El resto es el uuid del programa. Un
  // closer no puede crear globales, asi que arranca en su primer programa.
  const programIdInicial = permitirGlobal ? GLOBAL : (programas[0]?.id ?? "");
  const [programId, setProgramId] = useState<string>(programIdInicial);

  function reset() {
    setTitulo("");
    setUrl("");
    setProgramId(programIdInicial);
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setAbierto(true)}
        disabled={!permitirGlobal && programas.length === 0}
      >
        Nuevo recurso
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onCrear(
          {
            programId: programId === GLOBAL ? null : programId,
            titulo: titulo.trim(),
            url: url.trim(),
          },
          reset,
        );
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Título</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={120}
          required
          className={cn(claseInput, "sm:w-52")}
          aria-label="Título del recurso"
        />
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
          aria-label="URL del recurso"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Programa</span>
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className={cn(claseInput, "sm:w-44")}
          aria-label="Programa"
        >
          {/* Solo un administrador puede crear un recurso global (asimetria de Mani). */}
          {permitirGlobal ? <option value={GLOBAL}>Global (todos)</option> : null}
          {programas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={pendiente || !titulo.trim() || !url.trim()}>
          Crear
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={reset} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
