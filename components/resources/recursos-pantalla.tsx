"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Copy, ExternalLink, History, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { monto as formatoMonto } from "@/lib/format";
import { MONEDAS } from "@/lib/catalogo/enlaces-pago";
import {
  crearEnlacePagoAccion,
  crearRecursoAccion,
  desactivarEnlacePagoAccion,
  desactivarRecursoAccion,
  reemplazarEnlacePagoAccion,
  reemplazarRecursoAccion,
  type ResultadoAccion,
} from "@/app/(app)/recursos/acciones";
import { agruparEnlaces, GLOBAL, TODOS } from "@/components/resources/helpers";
import type {
  CategoriaOpcion,
  EnlaceUI,
  PlataformaOpcion,
  ProgramaOpcion,
  RecursoUI,
} from "@/components/resources/types";
export type {
  CategoriaOpcion,
  EnlaceUI,
  PlataformaOpcion,
  ProgramaOpcion,
  RecursoUI,
} from "@/components/resources/types";

/**
 * Pantalla de recursos (ticket 023, ADR 0017): lista los brochures y links de pago
 * vigentes, deja copiarlos o abrirlos en un clic, y —solo al gerente— crearlos,
 * reemplazarlos y desactivarlos.
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
 * `puedeEditar` decide quien ve los controles de edicion, pero NO es la barrera de
 * seguridad: cada server action vuelve a exigir gerente en el servidor (ADR 0003).
 */

interface Props {
  puedeEditar: boolean;
  slugPrograma: string | null;
  q: string | null;
  programas: ProgramaOpcion[];
  categorias: CategoriaOpcion[];
  plataformas: PlataformaOpcion[];
  recursos: RecursoUI[];
  enlaces: EnlaceUI[];
}

const claseInput =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RecursosPantalla({
  puedeEditar,
  slugPrograma,
  q,
  programas,
  categorias,
  plataformas,
  recursos,
  enlaces,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();
  const [pendiente, startTransition] = useTransition();

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

  const enlacesAgrupados = useMemo(() => agruparEnlaces(enlaces), [enlaces]);

  return (
    <div className="space-y-8">
      {/* Filtro: vive en la URL (ADR 0023). Envuelve en pantallas angostas. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={slugPrograma ?? TODOS}
          onValueChange={(valor: string | null) =>
            navegar({ programa: valor === null || valor === TODOS ? null : valor })
          }
        >
          <SelectTrigger className="w-full sm:w-56" aria-label="Programa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los programas</SelectItem>
            {programas.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        {puedeEditar ? (
          <CrearRecurso
            categorias={categorias}
            programas={programas}
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
                puedeEditar={puedeEditar}
                pendiente={pendiente}
                onReemplazar={(nuevaUrl, reset) =>
                  correr(() => reemplazarRecursoAccion(r.id, nuevaUrl), "Recurso reemplazado", reset)
                }
                onDesactivar={() =>
                  correr(() => desactivarRecursoAccion(r.id), "Recurso desactivado")
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Enlaces de pago ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Enlaces de pago</h2>

        {puedeEditar ? (
          <CrearEnlace
            programas={programas}
            plataformas={plataformas}
            pendiente={pendiente}
            onCrear={(entrada, reset) =>
              correr(() => crearEnlacePagoAccion(entrada), "Enlace de pago creado", reset)
            }
          />
        ) : null}

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
                  {grupo.productos.map((prod) => (
                    <div key={prod.producto} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{prod.producto}</p>
                      <ul className="space-y-2">
                        {prod.enlaces.map((e) => (
                          <EnlaceItem
                            key={e.id}
                            enlace={e}
                            puedeEditar={puedeEditar}
                            pendiente={pendiente}
                            onReemplazar={(nuevaUrl, reset) =>
                              correr(
                                () => reemplazarEnlacePagoAccion(e.id, nuevaUrl),
                                "Enlace reemplazado",
                                reset,
                              )
                            }
                            onDesactivar={() =>
                              correr(() => desactivarEnlacePagoAccion(e.id), "Enlace desactivado")
                            }
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
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
}: {
  recurso: RecursoUI;
  puedeEditar: boolean;
  pendiente: boolean;
  onReemplazar: (nuevaUrl: string, reset: () => void) => void;
  onDesactivar: () => void;
}) {
  const [verHistorial, setVerHistorial] = useState(false);
  const [reemplazando, setReemplazando] = useState(false);

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{recurso.titulo}</span>
            {recurso.categoriaNombre ? (
              <Badge variant="outline" className="text-muted-foreground">
                {recurso.categoriaNombre}
              </Badge>
            ) : null}
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

function EnlaceItem({
  enlace,
  puedeEditar,
  pendiente,
  onReemplazar,
  onDesactivar,
}: {
  enlace: EnlaceUI;
  puedeEditar: boolean;
  pendiente: boolean;
  onReemplazar: (nuevaUrl: string, reset: () => void) => void;
  onDesactivar: () => void;
}) {
  const [reemplazando, setReemplazando] = useState(false);

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            {/* La moneda SIEMPRE al lado del monto, con `monto()` (AGENTS.md). */}
            <span className="font-medium">{formatoMonto(Number(enlace.monto), enlace.moneda)}</span>
            {enlace.plataformaNombre ? (
              <Badge variant="outline" className="text-muted-foreground">
                {enlace.plataformaNombre}
              </Badge>
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

      {puedeEditar ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => setReemplazando((v) => !v)}>
            Reemplazar
          </Button>
          <Button size="sm" variant="ghost" disabled={pendiente} onClick={onDesactivar}>
            Desactivar
          </Button>
        </div>
      ) : null}

      {reemplazando && puedeEditar ? (
        <FormularioReemplazar
          pendiente={pendiente}
          etiqueta="Nueva URL del enlace de pago"
          onGuardar={(nuevaUrl, reset) =>
            onReemplazar(nuevaUrl, () => {
              reset();
              setReemplazando(false);
            })
          }
          onCancelar={() => setReemplazando(false)}
        />
      ) : null}
    </li>
  );
}

/** Formulario en linea para crear un recurso (solo gerente). */
function CrearRecurso({
  categorias,
  programas,
  pendiente,
  onCrear,
}: {
  categorias: CategoriaOpcion[];
  programas: ProgramaOpcion[];
  pendiente: boolean;
  onCrear: (
    entrada: { programId: string | null; categoriaId: string; titulo: string; url: string },
    reset: () => void,
  ) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  // GLOBAL = recurso global (sin programa). El resto es el uuid del programa.
  const [programId, setProgramId] = useState<string>(GLOBAL);

  function reset() {
    setTitulo("");
    setUrl("");
    setProgramId(GLOBAL);
    setCategoriaId(categorias[0]?.id ?? "");
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAbierto(true)} disabled={categorias.length === 0}>
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
            categoriaId,
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
        <span className="text-muted-foreground">Categoría</span>
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          required
          className={cn(claseInput, "sm:w-44")}
          aria-label="Categoría"
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Programa</span>
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className={cn(claseInput, "sm:w-44")}
          aria-label="Programa"
        >
          <option value={GLOBAL}>Global (todos)</option>
          {programas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={pendiente || !titulo.trim() || !url.trim() || !categoriaId}>
          Crear
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={reset} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}

/** Formulario en linea para crear un enlace de pago (solo gerente). */
function CrearEnlace({
  programas,
  plataformas,
  pendiente,
  onCrear,
}: {
  programas: ProgramaOpcion[];
  plataformas: PlataformaOpcion[];
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
}) {
  const [abierto, setAbierto] = useState(false);
  // El enlace de pago SIEMPRE es de un programa (columna NOT NULL); no hay opcion
  // global. La plataforma sale del catalogo activo (ADR 0012), no se escribe a mano.
  const [programId, setProgramId] = useState<string>(programas[0]?.id ?? "");
  const [plataformaId, setPlataformaId] = useState(plataformas[0]?.id ?? "");
  const [montoValor, setMontoValor] = useState("");
  const [moneda, setMoneda] = useState<(typeof MONEDAS)[number]>("USD");
  const [url, setUrl] = useState("");

  function reset() {
    setProgramId(programas[0]?.id ?? "");
    setPlataformaId(plataformas[0]?.id ?? "");
    setMontoValor("");
    setMoneda("USD");
    setUrl("");
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setAbierto(true)}
        disabled={programas.length === 0 || plataformas.length === 0}
      >
        Nuevo enlace de pago
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onCrear(
          { programId, plataformaId, monto: montoValor.trim(), moneda, url: url.trim() },
          reset,
        );
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Programa</span>
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          required
          className={cn(claseInput, "sm:w-44")}
          aria-label="Programa del enlace"
        >
          {programas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Plataforma</span>
        <select
          value={plataformaId}
          onChange={(e) => setPlataformaId(e.target.value)}
          required
          className={cn(claseInput, "sm:w-44")}
          aria-label="Plataforma de pago"
        >
          {plataformas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
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
        <Button
          type="submit"
          size="sm"
          disabled={pendiente || !programId || !plataformaId || !montoValor.trim() || !url.trim()}
        >
          Crear
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={reset} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
