"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { crearCreadorAccion, crearTipoDePiezaAccion } from "@/app/(app)/media/acciones";
import { DetalleDePieza } from "./detalle-de-pieza";
import { BadgeDeEstado, fechaLegible } from "./estado-de-pieza";
import { DialogoDeMedia, Etiqueta, campoSelect, useAccionDeMedia } from "./dialogo-de-media";
import { FormularioDePieza } from "./formulario-de-pieza";
import type { OpcionesDeMedia, PiezaVista } from "./tipos";

/**
 * La pagina de media (tickets 316, 317 y 321): una tabla de piezas del programa elegido y tres
 * botones que abren pop-ups (crear es un boton con dialogo, docs/structure.md §9). Cada fila abre
 * el detalle de la pieza. Todo llega calculado del servidor; ninguna regla vive aqui.
 */
type Abierto = null | { tipo: "creador" } | { tipo: "tipos" } | { tipo: "pieza" } | { tipo: "detalle"; id: string };

export function PanelDeMedia({ piezas, total, opciones }: { piezas: PiezaVista[]; total: number; opciones: OpcionesDeMedia }) {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const cerrar = () => setAbierto(null);
  const detalle = abierto?.tipo === "detalle" ? piezas.find((p) => p.id === abierto.id) : undefined;
  const faltaAlgo = opciones.creadores.length === 0 ? "un creador" : opciones.tipos.length === 0 ? "un tipo de pieza" : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{total === 0 ? "Sin piezas" : `${total} ${total === 1 ? "pieza" : "piezas"}`}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setAbierto({ tipo: "tipos" })}>Tipos de pieza</Button>
          <Button type="button" variant="outline" onClick={() => setAbierto({ tipo: "creador" })}>Nuevo creador</Button>
          <Button type="button" onClick={() => setAbierto({ tipo: "pieza" })} disabled={faltaAlgo !== null}>Agregar pieza</Button>
        </div>
      </div>

      {piezas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {faltaAlgo
            ? `Aún no hay piezas. Para crear la primera hace falta ${faltaAlgo}: usa los botones de arriba.`
            : "Aún no hay piezas en este programa. Usa “Agregar pieza” para crear la primera."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_7rem] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Pieza</span><span>Creador</span><span>Publicación</span><span>Estado</span>
          </div>
          <ul className="divide-y">
            {piezas.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setAbierto({ tipo: "detalle", id: p.id })}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:grid-cols-[1.4fr_1fr_1fr_7rem]"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{p.tipo} · {p.red}</span>
                    {p.cta ? <span className="block truncate text-xs text-muted-foreground">{p.cta}</span> : null}
                  </span>
                  <span className="order-3 text-xs text-muted-foreground sm:order-none sm:text-sm sm:text-foreground">{p.creador}</span>
                  <span className="order-4 text-xs text-muted-foreground sm:order-none sm:text-sm sm:text-foreground">{p.permanente ? "Sin fecha" : fechaLegible(p.fecha)}</span>
                  <span><BadgeDeEstado estado={p.estado} /></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {abierto?.tipo === "creador" ? <FormularioDeCreador opciones={opciones} onCerrar={cerrar} /> : null}
      {abierto?.tipo === "tipos" ? <DialogoDeTipos opciones={opciones} onCerrar={cerrar} /> : null}
      {abierto?.tipo === "pieza" ? <FormularioDePieza opciones={opciones} onCerrar={cerrar} /> : null}
      {detalle ? <DetalleDePieza pieza={detalle} onCerrar={cerrar} /> : null}
    </div>
  );
}

function FormularioDeCreador({ opciones, onCerrar }: { opciones: OpcionesDeMedia; onCerrar: () => void }) {
  const { pendiente, correr } = useAccionDeMedia();
  const [c, setC] = useState({ nombre: "", slug: "", programId: opciones.programaInicial });
  return (
    <DialogoDeMedia titulo="Nuevo creador" descripcion="La persona que publica contenido. Su programa decide a qué formulario llegan sus links." onCerrar={onCerrar}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => crearCreadorAccion({ nombre: c.nombre, slug: c.slug, programId: c.programId || null }), "Creador creado", onCerrar);
        }}
      >
        <Etiqueta texto="Nombre">
          <Input value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} required />
        </Etiqueta>
        <Etiqueta texto="Slug" ayuda="Su nombre corto dentro del UTM de campaña (ej. milena).">
          <Input placeholder="milena" value={c.slug} onChange={(e) => setC({ ...c, slug: e.target.value })} required />
        </Etiqueta>
        <Etiqueta texto="Programa" ayuda="Sin programa el creador se planea, pero sus piezas no tienen link ni miden ventas.">
          <select className={campoSelect} required={!opciones.conSinPrograma} value={c.programId} onChange={(e) => setC({ ...c, programId: e.target.value })}>
            {opciones.conSinPrograma ? <option value="">Sin programa</option> : <option value="" disabled>Elige un programa</option>}
            {opciones.programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Etiqueta>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" disabled={pendiente}>Crear creador</Button>
        </DialogFooter>
      </form>
    </DialogoDeMedia>
  );
}

function DialogoDeTipos({ opciones, onCerrar }: { opciones: OpcionesDeMedia; onCerrar: () => void }) {
  const { pendiente, correr } = useAccionDeMedia();
  const [tipo, setTipo] = useState("");
  return (
    <DialogoDeMedia titulo="Tipos de pieza" descripcion="Reel, Historia, Carrusel… El tipo va dentro del UTM de campaña." onCerrar={onCerrar}>
      <p className="text-sm text-muted-foreground">{opciones.tipos.length === 0 ? "Aún no hay tipos." : opciones.tipos.map((t) => t.nombre).join(" · ")}</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => crearTipoDePiezaAccion(tipo), "Tipo creado", () => setTipo(""));
        }}
      >
        <Input placeholder="Nuevo tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} required />
        <Button type="submit" disabled={pendiente}>Agregar</Button>
      </form>
    </DialogoDeMedia>
  );
}
