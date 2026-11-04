"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
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
} from "@/app/(app)/p/[programa]/recursos/acciones";
import { agruparEnlaces } from "@/components/resources/helpers";
import { BarraDeLista } from "@/components/filtros/barra-de-lista";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
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
 * El programa es el de la ruta: el selector del menu ya lo eligio, asi que ni la lista
 * ni el formulario lo vuelven a pedir. La busqueda por titulo vive en la URL (ADR 0023).
 * El titulo de un brochure no es un dato personal, asi que —a diferencia de `/mi-dia`—
 * si conviene que viaje en la URL.
 *
 * `esAdmin` + `editaPrograma` deciden quien ve los controles de edicion de los
 * recursos, pero NO son la barrera de seguridad: cada server action vuelve a exigir el
 * rol y el acceso por programa en el servidor (ADR 0003). Un administrador (gerente o
 * developer) edita todo, incluido lo global; un closer solo los recursos de los
 * programas donde tiene membresia activa, y NUNCA un recurso global.
 *
 * PANTALLA FIJA (ticket 195, A-99, regla de §9): el buscador y las pestañas
 * quedan fijos arriba (`shrink-0`); solo la lista de la pestaña activa tiene scroll
 * propio desde `md`. Por debajo de `md` vuelve el scroll de página (los closers lo usan
 * en el teléfono). Las dos listas —recursos y links de pago— son dos pestañas: la activa
 * la decide el servidor (`?seccion=`) y llega en `seccion`. El buscador solo filtra
 * recursos (la consulta de links no recibe `q`), así que solo aparece en esa pestaña.
 */

interface Props {
  /** Administra todo: cualquier programa y los recursos globales (gerente/developer). */
  esAdmin: boolean;
  /** ¿Puede editar los recursos de este programa? Un closer, solo con membresia activa. */
  editaPrograma: boolean;
  q: string | null;
  /** La pestaña activa, decidida en el servidor desde `?seccion=`. */
  seccion: string;
  /** La barra de pestañas, renderizada en el servidor (`Pestanas` no toca `lib/db`). */
  pestanas: ReactNode;
  programa: ProgramaOpcion;
  recursos: RecursoUI[];
  enlaces: EnlaceUI[];
}

const claseInput =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RecursosPantalla({
  esAdmin,
  editaPrograma,
  q,
  seccion,
  pestanas,
  programa,
  recursos,
  enlaces,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  // ¿Puede el usuario CREAR algo? Un admin siempre; un closer si edita este programa. Un
  // closer NUNCA ve la opcion de crear un global (asimetria de Mani).
  const puedeCrear = esAdmin || editaPrograma;

  /** ¿Puede el usuario editar/desactivar/reemplazar este recurso? */
  function puedeEditarRecurso(r: RecursoUI): boolean {
    if (esAdmin) return true;
    return r.programId !== null && editaPrograma;
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

  // El buscador por título (`navegar({ q })`) solo aparece en la pestaña recursos. El
  // total de la línea de estado es el de la pestaña activa.
  const buscador =
    seccion === "recursos" ? (
      <input
        type="search"
        defaultValue={q ?? ""}
        placeholder="Buscar por título…"
        aria-label="Buscar por título"
        className={cn(claseInput, "h-8")}
        onChange={(e) => {
          const valor = e.target.value.trim();
          navegar({ q: valor === "" ? null : valor });
        }}
      />
    ) : undefined;

  return (
    <PantallaFija>
      {/* Barra de lista: buscador (solo recursos). Vive en la URL (ADR 0023) y conserva la
          sección activa, porque `navegar` parte de la query actual. */}
      <div className="shrink-0">
        <BarraDeLista
          total={seccion === "recursos" ? recursos.length : enlaces.length}
          sustantivo={
            seccion === "recursos"
              ? { singular: "recurso", plural: "recursos" }
              : { singular: "link de pago", plural: "links de pago" }
          }
          filtros={[]}
          buscador={buscador}
        />
      </div>

      {/* Las pestañas (renderizadas en el servidor) también quedan fijas. */}
      {pestanas}

      {/* Solo la lista de la pestaña activa, con scroll propio desde `md`. Por debajo de
          `md` vuelve el scroll de página. */}
      <div className={clasesDeZonaConScroll()}>
        {seccion === "recursos" ? (
          <section className="space-y-3">
            {puedeCrear ? (
              <CrearRecurso
                programa={programa}
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
        ) : null}

        {/* Enlaces de pago (solo lectura; se administran en la tab Programa). */}
        {seccion === "links-de-pago" ? (
          <section className="space-y-3">
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
        ) : null}
      </div>
    </PantallaFija>
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
            <span className="font-medium">{enlace.nombre}</span>
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
  programa,
  permitirGlobal,
  pendiente,
  onCrear,
}: {
  programa: ProgramaOpcion;
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
  // El recurso es del programa elegido; solo quien administra lo puede hacer global.
  const [global, setGlobal] = useState(false);

  function reset() {
    setTitulo("");
    setUrl("");
    setGlobal(false);
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>
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
            programId: global ? null : programa.id,
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
      {/* Solo un administrador puede crear un recurso global (asimetria de Mani). */}
      {permitirGlobal ? (
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} />
          Para todos los programas
        </label>
      ) : null}
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
