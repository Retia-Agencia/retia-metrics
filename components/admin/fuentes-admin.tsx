"use client";

import { useState, useTransition } from "react";
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
  type ResultadoAccion,
} from "@/app/(app)/ajustes/fuentes/acciones";
import type { ColumnaResuelta } from "@/lib/sheets/probar-fuente";
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
 */

const DESTINOS: { valor: string; etiqueta: string }[] = [
  { valor: "leads", etiqueta: "Personas" },
  { valor: "calls", etiqueta: "Llamadas" },
  { valor: "sales", etiqueta: "Ventas" },
  { valor: "ad_spend", etiqueta: "Pauta" },
];

export interface FuenteVista {
  id: string;
  programId: string;
  nombre: string;
  tipo: string;
  sheetId: string | null;
  tab: string | null;
  rango: string;
  destino: string;
  mapeoColumnas: MapeoColumnas;
  activo: boolean;
  ultimaSync: string | null;
  orden: number;
}

export interface ProgramaConFuentes {
  id: string;
  slug: string;
  nombre: string;
  plantillaLead: MapeoColumnas | null;
  fuentes: FuenteVista[];
}

interface Borrador {
  nombre: string;
  sheetId: string;
  tab: string;
  rango: string;
  destino: string;
  mapeo: ParMapeo[];
}

const BORRADOR_VACIO: Borrador = {
  nombre: "",
  sheetId: "",
  tab: "",
  rango: "A1:BZ",
  destino: "people",
  mapeo: [],
};

function aBorrador(f: FuenteVista): Borrador {
  return {
    nombre: f.nombre,
    sheetId: f.sheetId ?? "",
    tab: f.tab ?? "",
    rango: f.rango,
    destino: f.destino,
    mapeo: aPares(f.mapeoColumnas ?? {}),
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
                "Fuente creada (inactiva: pruébala y actívala)",
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
  const [probando, startProbar] = useTransition();
  const [prueba, setPrueba] = useState<ColumnaResuelta[] | null>(null);
  const destino = DESTINOS.find((d) => d.valor === fuente.destino)?.etiqueta ?? fuente.destino;

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
          <span className="ml-2 text-muted-foreground">· {fuente.tab}</span>
          <span className="block text-xs text-muted-foreground">
            hoja {truncarId(fuente.sheetId)} · rango {fuente.rango}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{destino}</Badge>
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
        <Button size="sm" variant="ghost" disabled={pendiente || probando} onClick={probar}>
          {probando ? "Probando…" : "Probar"}
        </Button>
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

/** Convierte el borrador a la entrada que espera la server action. */
function aEntrada(b: Borrador, programId: string) {
  return {
    programId,
    nombre: b.nombre,
    tipo: "google_sheet" as const,
    sheetId: b.sheetId,
    tab: b.tab,
    rango: b.rango,
    destino: b.destino as "people" | "calls" | "sales" | "ad_spend",
    mapeoColumnas: aMapeo(b.mapeo),
  };
}

const CLASE_INPUT =
  "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FormularioFuente({
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
              <span className="text-muted-foreground">Destino</span>
              <select
                value={borrador.destino}
                onChange={(e) => setBorrador({ ...borrador, destino: e.target.value })}
                className={CLASE_INPUT}
                aria-label="Destino"
              >
                {DESTINOS.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.etiqueta}
                  </option>
                ))}
              </select>
            </label>

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
            Comparte la hoja con la cuenta de servicio de Google (lectura) antes de probar.
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
