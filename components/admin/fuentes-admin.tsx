"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { truncarId } from "@/lib/format";
import {
  activarFuenteAccion,
  crearFuenteAccion,
  desactivarFuenteAccion,
  editarFuenteAccion,
  editarPlantillaLeadAccion,
  probarFuenteAccion,
  rotarSecretoFuenteAccion,
  type ResultadoAccion,
} from "@/app/(app)/ajustes/fuentes/acciones";
import { PROVEEDORES_FORMULARIO, rutaDelWebhook, type ProveedorFormulario } from "@/lib/catalogo/fuentes-webhook";
import type { ColumnaResuelta } from "@/lib/sheets/probar-fuente";
import type { EstadoDeFuente } from "@/lib/queries/salud-fuentes";
import {
  aMapeo,
  aPares,
  type MapeoColumnas,
  type ParMapeo,
} from "@/components/admin/mapeo-fuentes";

/**
 * Administracion de fuentes por programa (ticket 016, ADR 0019). Antes esta pantalla
 * era de solo lectura y el mapeo se editaba en `scripts/seed-datos.ts`; ahora se
 * crea, edita, prueba, activa y desactiva desde aca.
 *
 * Deliberadamente usa `<input>`/`<select>` HTML nativos (como `cohortes-admin`), NO
 * los Select/Menu de Base UI: Base UI es estricto con la composicion y una parte
 * fuera de su contenedor revienta la pagina al interactuar, y ningun test de este
 * repo ve ese error (AGENTS.md). El HTML nativo no tiene ese riesgo.
 *
 * El mapeo se edita como pares campo→patron. Un patron con "|" es una lista de
 * alternativas (se parte al guardar). El ID de la hoja se muestra truncado (S-13).
 *
 * Una fuente webhook (ticket 105) no tiene hoja: tiene proveedor, una URL derivada
 * para pegar en el formulario y un secreto que se ve UNA sola vez, al generarlo.
 */

export interface FuenteVista {
  id: string;
  programId: string;
  nombre: string;
  tipo: string;
  sheetId: string | null;
  tab: string | null;
  rango: string;
  mapeoColumnas: MapeoColumnas;
  proveedor: ProveedorFormulario | null;
  tieneSecreto: boolean;
  activo: boolean;
  ultimaSync: string | null;
  orden: number;
  umbralSinRespuestaHoras: number;
  umbralMuertaHoras: number;
  /** Solo en las fuentes activas (ticket 107): se calcula en el servidor, no aqui. */
  salud: SaludVista | null;
}

/** La salud de una fuente ya resuelta para pintar: el "hace X" viene del servidor. */
export interface SaludVista {
  estado: EstadoDeFuente;
  ultimoHace: string;
  sobresPendientes: number;
}

export interface ProgramaConFuentes {
  id: string;
  slug: string;
  nombre: string;
  plantillaLead: MapeoColumnas | null;
  fuentes: FuenteVista[];
}

type TipoBorrador = "google_sheet" | "webhook";

interface Borrador {
  tipo: TipoBorrador;
  proveedor: ProveedorFormulario;
  nombre: string;
  sheetId: string;
  tab: string;
  rango: string;
  mapeo: ParMapeo[];
  umbralSinRespuestaHoras: string;
  umbralMuertaHoras: string;
}

const BORRADOR_VACIO: Borrador = {
  tipo: "google_sheet",
  proveedor: PROVEEDORES_FORMULARIO[0],
  nombre: "",
  sheetId: "",
  tab: "",
  rango: "A1:BZ",
  mapeo: [],
  umbralSinRespuestaHoras: "48",
  umbralMuertaHoras: "120",
};

function aBorrador(f: FuenteVista): Borrador {
  return {
    tipo: f.tipo === "webhook" ? "webhook" : "google_sheet",
    proveedor: f.proveedor ?? PROVEEDORES_FORMULARIO[0],
    nombre: f.nombre,
    sheetId: f.sheetId ?? "",
    tab: f.tab ?? "",
    rango: f.rango,
    mapeo: aPares(f.mapeoColumnas ?? {}),
    umbralSinRespuestaHoras: String(f.umbralSinRespuestaHoras),
    umbralMuertaHoras: String(f.umbralMuertaHoras),
  };
}

export function FuentesAdmin({ programas }: { programas: ProgramaConFuentes[] }) {
  return (
    <div className="space-y-6">
      {programas.map((p) => (
        <ProgramaCard key={p.id} programa={p} />
      ))}
    </div>
  );
}

function ProgramaCard({ programa }: { programa: ProgramaConFuentes }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [editandoPlantilla, setEditandoPlantilla] = useState(false);

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

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{programa.nombre}</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pendiente || editandoPlantilla}
            onClick={() => setEditandoPlantilla(true)}
          >
            Plantilla de lead
          </Button>
          <Button
            size="sm"
            disabled={pendiente || creando}
            onClick={() => setCreando(true)}
          >
            <Plus className="size-4" />
            Nueva fuente
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {editandoPlantilla ? (
          <FormularioPlantilla
            programa={programa}
            pendiente={pendiente}
            onCancelar={() => setEditandoPlantilla(false)}
            onGuardar={(mapeo) =>
              correr(
                () => editarPlantillaLeadAccion(programa.id, mapeo),
                "Plantilla actualizada",
                () => setEditandoPlantilla(false),
              )
            }
          />
        ) : null}

        {creando ? (
          <FormularioFuente
            titulo="Nueva fuente"
            inicial={BORRADOR_VACIO}
            pendiente={pendiente}
            onCancelar={() => setCreando(false)}
            onGuardar={(b) =>
              correr(
                () => crearFuenteAccion(aEntrada(b, programa.id)),
                b.tipo === "webhook"
                  ? "Fuente creada (inactiva: genera el secreto y actívala)"
                  : "Fuente creada (inactiva: pruébala y actívala)",
                () => setCreando(false),
              )
            }
          />
        ) : null}

        {programa.fuentes.length === 0 && !creando ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            Este programa todavía no tiene fuentes.
          </p>
        ) : null}

        {programa.fuentes.map((f) =>
          editando === f.id ? (
            <FormularioFuente
              key={f.id}
              titulo={`Editar ${f.nombre}`}
              inicial={aBorrador(f)}
              tipoFijo
              pendiente={pendiente}
              onCancelar={() => setEditando(null)}
              onGuardar={(b) =>
                correr(
                  () => editarFuenteAccion(f.id, aEntrada(b, programa.id)),
                  "Fuente actualizada",
                  () => setEditando(null),
                )
              }
            />
          ) : (
            <FilaFuente
              key={f.id}
              fuente={f}
              pendiente={pendiente}
              onEditar={() => setEditando(f.id)}
              onActivar={() => correr(() => activarFuenteAccion(f.id), "Fuente activada")}
              onDesactivar={() =>
                correr(() => desactivarFuenteAccion(f.id), "Fuente desactivada")
              }
            />
          ),
        )}
      </CardContent>
    </Card>
  );
}

function FilaFuente({
  fuente,
  pendiente,
  onEditar,
  onActivar,
  onDesactivar,
}: {
  fuente: FuenteVista;
  pendiente: boolean;
  onEditar: () => void;
  onActivar: () => void;
  onDesactivar: () => void;
}) {
  const router = useRouter();
  const [probando, startProbar] = useTransition();
  const [prueba, setPrueba] = useState<ColumnaResuelta[] | null>(null);
  const [rotando, startRotar] = useTransition();
  // El secreto recien generado vive SOLO en el estado de este componente: no hay forma
  // de volver a pedirlo al servidor. Al recargar la pagina desaparece.
  const [secretoNuevo, setSecretoNuevo] = useState<string | null>(null);
  const esWebhook = fuente.tipo === "webhook";
  // El origen solo existe en el navegador: en el servidor es "" y React lo reemplaza
  // al hidratar, sin que los dos HTML discrepen.
  const origen = useSyncExternalStore(sinSuscripcion, origenDelNavegador, () => "");
  const url = `${origen}${rutaDelWebhook(fuente.id)}`;

  function rotar() {
    if (
      fuente.tieneSecreto &&
      !window.confirm(
        "El secreto actual deja de funcionar en el acto. Tendrás que pegar el nuevo en el formulario enseguida. ¿Seguir?",
      )
    ) {
      return;
    }
    startRotar(async () => {
      const res = await rotarSecretoFuenteAccion(fuente.id);
      if (res.ok) {
        setSecretoNuevo(res.secreto);
        router.refresh();
      } else {
        toast.error("No se pudo generar el secreto", { description: res.error });
      }
    });
  }

  function copiar(texto: string, que: string) {
    navigator.clipboard.writeText(texto).then(
      () => toast.success(`${que} copiado`),
      () => toast.error(`No se pudo copiar ${que.toLowerCase()}`),
    );
  }

  function probar() {
    startProbar(async () => {
      setPrueba(null);
      const res = await probarFuenteAccion(fuente.id);
      if (res.ok) {
        setPrueba(res.columnas);
        toast.success("El mapeo cuadra con la hoja");
      } else {
        toast.error("El mapeo no cuadra", { description: res.error });
      }
    });
  }

  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", !fuente.activo && "opacity-70")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{fuente.nombre}</span>
          {esWebhook ? (
            <>
              <span className="ml-2 text-muted-foreground">· webhook de {fuente.proveedor}</span>
              <span className="block break-all text-xs text-muted-foreground">{url}</span>
            </>
          ) : (
            <>
              <span className="ml-2 text-muted-foreground">· {fuente.tab}</span>
              <span className="block text-xs text-muted-foreground">
                hoja {truncarId(fuente.sheetId)} · rango {fuente.rango}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fuente.salud ? <MarcaDeSalud salud={fuente.salud} /> : null}
          {esWebhook && !fuente.tieneSecreto ? (
            <Badge variant="outline" className="text-muted-foreground">
              sin secreto
            </Badge>
          ) : null}
          {fuente.activo ? (
            <Badge variant="secondary">activa</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              inactiva
            </Badge>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Button size="sm" variant="ghost" disabled={pendiente} onClick={onEditar}>
          Editar
        </Button>
        {esWebhook ? (
          <>
            <Button size="sm" variant="ghost" disabled={!origen} onClick={() => copiar(url, "URL")}>
              Copiar URL
            </Button>
            <Button size="sm" variant="ghost" disabled={pendiente || rotando} onClick={rotar}>
              {rotando ? "Generando…" : fuente.tieneSecreto ? "Rotar secreto" : "Generar secreto"}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" disabled={pendiente || probando} onClick={probar}>
            {probando ? "Probando…" : "Probar"}
          </Button>
        )}
        {fuente.activo ? (
          <Button size="sm" variant="ghost" disabled={pendiente} onClick={onDesactivar}>
            Desactivar
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pendiente} onClick={onActivar}>
            Activar
          </Button>
        )}
      </div>
      {secretoNuevo ? (
        <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2">
          <p className="text-xs font-medium">
            Secreto del webhook. Cópialo ahora y pégalo en el formulario: no se vuelve a mostrar.
          </p>
          <code className="block break-all text-xs">{secretoNuevo}</code>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => copiar(secretoNuevo, "Secreto")}>
              Copiar secreto
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSecretoNuevo(null)}>
              Ya lo guardé
            </Button>
          </div>
        </div>
      ) : null}
      {prueba ? (
        <div className="mt-2 rounded-md bg-muted/50 p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Columnas encontradas en la hoja:
          </p>
          <ul className="space-y-0.5 text-xs">
            {prueba.map((c) => (
              <li key={c.campo} className="flex flex-wrap items-center gap-1">
                <span className="font-medium">{c.campo}</span>
                <span className="text-muted-foreground">→ “{c.encabezado}”</span>
                <Badge variant="outline" className="text-[10px]">
                  {c.origen}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** El origen de la app no cambia mientras la pagina vive: no hay nada a que suscribirse. */
const sinSuscripcion = () => () => {};
const origenDelNavegador = () => window.location.origin;

/** Convierte el borrador a la entrada que espera la server action. */
function aEntrada(b: Borrador, programId: string) {
  // Siempre se mandan los dos: la logica valida el orden y zod rechaza lo que no sea
  // un entero, con un mensaje en espanol.
  const umbrales = {
    umbralSinRespuestaHoras: Number(b.umbralSinRespuestaHoras),
    umbralMuertaHoras: Number(b.umbralMuertaHoras),
  };
  if (b.tipo === "webhook") {
    return {
      programId,
      nombre: b.nombre,
      tipo: "webhook" as const,
      proveedor: b.proveedor,
      mapeoColumnas: aMapeo(b.mapeo),
      ...umbrales,
    };
  }
  return {
    programId,
    nombre: b.nombre,
    tipo: "google_sheet" as const,
    sheetId: b.sheetId,
    tab: b.tab,
    rango: b.rango,
    mapeoColumnas: aMapeo(b.mapeo),
    ...umbrales,
  };
}

/** Que dice la marca de cada estado, y con que tono (docs/structure.md §9). */
const MARCA_DE_SALUD: Record<EstadoDeFuente, { texto: (hace: string) => string; tono: "exito" | "info" | "alerta" | "peligro" }> = {
  al_dia: { texto: (h) => `recibiendo · último ${h}`, tono: "exito" },
  volvio: { texto: (h) => `volvió · último ${h}`, tono: "info" },
  sin_respuestas: { texto: (h) => `sin respuestas · último ${h}`, tono: "alerta" },
  muerta: { texto: (h) => `muerta · último ${h}`, tono: "peligro" },
  sin_envios: { texto: () => "todavía sin envíos", tono: "alerta" },
};

function MarcaDeSalud({ salud }: { salud: SaludVista }) {
  const marca = MARCA_DE_SALUD[salud.estado];
  return (
    <>
      <Badge variant={marca.tono}>{marca.texto(salud.ultimoHace)}</Badge>
      {salud.sobresPendientes > 0 ? (
        <Badge variant="peligro">
          {salud.sobresPendientes === 1 ? "1 envío sin procesar" : `${salud.sobresPendientes} envíos sin procesar`}
        </Badge>
      ) : null}
    </>
  );
}

const CLASE_INPUT =
  "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FormularioFuente({
  titulo,
  inicial,
  tipoFijo = false,
  pendiente,
  onCancelar,
  onGuardar,
}: {
  titulo: string;
  inicial: Borrador;
  /** Al editar el tipo no se cambia (la logica lo rechaza con 422): no se ofrece. */
  tipoFijo?: boolean;
  pendiente: boolean;
  onCancelar: () => void;
  onGuardar: (borrador: Borrador) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const esWebhook = borrador.tipo === "webhook";

  function setPar(i: number, campo: "campo" | "patron", valor: string) {
    const mapeo = borrador.mapeo.map((p, j) => (i === j ? { ...p, [campo]: valor } : p));
    setBorrador({ ...borrador, mapeo });
  }
  function agregarPar() {
    setBorrador({ ...borrador, mapeo: [...borrador.mapeo, { campo: "", patron: "" }] });
  }
  function quitarPar(i: number) {
    setBorrador({ ...borrador, mapeo: borrador.mapeo.filter((_, j) => j !== i) });
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <Button size="icon-sm" variant="ghost" onClick={onCancelar} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onGuardar(borrador);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Nombre</span>
              <input
                value={borrador.nombre}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                maxLength={120}
                required
                className={CLASE_INPUT}
                aria-label="Nombre"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Tipo</span>
              <select
                value={borrador.tipo}
                onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value as TipoBorrador })}
                disabled={tipoFijo}
                className={CLASE_INPUT}
                aria-label="Tipo"
              >
                <option value="google_sheet">Hoja de Google</option>
                <option value="webhook">Webhook de formulario</option>
              </select>
            </label>

            {esWebhook ? (
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Proveedor</span>
                <select
                  value={borrador.proveedor}
                  onChange={(e) =>
                    setBorrador({ ...borrador, proveedor: e.target.value as ProveedorFormulario })
                  }
                  className={CLASE_INPUT}
                  aria-label="Proveedor"
                >
                  {PROVEEDORES_FORMULARIO.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {esWebhook ? null : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">ID de la hoja de Google</span>
              <input
                value={borrador.sheetId}
                onChange={(e) => setBorrador({ ...borrador, sheetId: e.target.value })}
                required
                className={CLASE_INPUT}
                aria-label="ID de la hoja"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Pestaña</span>
              <input
                value={borrador.tab}
                onChange={(e) => setBorrador({ ...borrador, tab: e.target.value })}
                required
                className={CLASE_INPUT}
                aria-label="Pestaña"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Rango</span>
              <input
                value={borrador.rango}
                onChange={(e) => setBorrador({ ...borrador, rango: e.target.value })}
                required
                className={CLASE_INPUT}
                aria-label="Rango"
              />
            </label>
          </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Horas sin envíos para marcarla “sin respuestas”</span>
              <input
                type="number"
                min={1}
                step={1}
                value={borrador.umbralSinRespuestaHoras}
                onChange={(e) => setBorrador({ ...borrador, umbralSinRespuestaHoras: e.target.value })}
                required
                className={CLASE_INPUT}
                aria-label="Horas para sin respuestas"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Horas sin envíos para marcarla “muerta”</span>
              <input
                type="number"
                min={1}
                step={1}
                value={borrador.umbralMuertaHoras}
                onChange={(e) => setBorrador({ ...borrador, umbralMuertaHoras: e.target.value })}
                required
                className={CLASE_INPUT}
                aria-label="Horas para muerta"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Mapeo de columnas (campo → texto del encabezado). Deja un campo sin ajuste para
              heredarlo de la plantilla del programa. Varias alternativas se separan con “|”.
            </p>
            {borrador.mapeo.map((par, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={par.campo}
                  onChange={(e) => setPar(i, "campo", e.target.value)}
                  placeholder="campo"
                  className={CLASE_INPUT}
                  aria-label={`Campo ${i + 1}`}
                />
                <input
                  value={par.patron}
                  onChange={(e) => setPar(i, "patron", e.target.value)}
                  placeholder="texto del encabezado"
                  className={CLASE_INPUT}
                  aria-label={`Patrón ${i + 1}`}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => quitarPar(i)}
                  aria-label="Quitar campo"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={agregarPar}>
              <Plus className="size-4" />
              Agregar campo
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {esWebhook
              ? "Al guardar, genera el secreto y pega la URL y el secreto en el formulario. Después actívala."
              : "Comparte la hoja con la cuenta de servicio de Google (lectura) antes de probar."}
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pendiente || !borrador.nombre.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FormularioPlantilla({
  programa,
  pendiente,
  onCancelar,
  onGuardar,
}: {
  programa: ProgramaConFuentes;
  pendiente: boolean;
  onCancelar: () => void;
  onGuardar: (mapeo: MapeoColumnas) => void;
}) {
  const [pares, setPares] = useState<ParMapeo[]>(aPares(programa.plantillaLead ?? {}));

  function setPar(i: number, campo: "campo" | "patron", valor: string) {
    setPares(pares.map((p, j) => (i === j ? { ...p, [campo]: valor } : p)));
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Plantilla de lead · {programa.nombre}</CardTitle>
        <Button size="icon-sm" variant="ghost" onClick={onCancelar} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onGuardar(aMapeo(pares));
          }}
        >
          <p className="text-sm text-muted-foreground">
            Mapeo común a todas las hojas del programa. Cada fuente solo ajusta los campos que su
            hoja redacta distinto; lo que no esté aquí cae al defecto del código.
          </p>
          {pares.map((par, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={par.campo}
                onChange={(e) => setPar(i, "campo", e.target.value)}
                placeholder="campo"
                className={CLASE_INPUT}
                aria-label={`Campo ${i + 1}`}
              />
              <input
                value={par.patron}
                onChange={(e) => setPar(i, "patron", e.target.value)}
                placeholder="texto del encabezado"
                className={CLASE_INPUT}
                aria-label={`Patrón ${i + 1}`}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setPares(pares.filter((_, j) => j !== i))}
                aria-label="Quitar campo"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPares([...pares, { campo: "", patron: "" }])}
          >
            <Plus className="size-4" />
            Agregar campo
          </Button>

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pendiente}>
              Guardar plantilla
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
