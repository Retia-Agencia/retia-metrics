"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { crearPiezaAccion } from "@/app/(app)/media/acciones";
import { campanaDePieza } from "@/lib/atribucion/campana-de-pieza";
import { sanearUtm } from "@/lib/atribucion/sanear-utm";
import { BloqueDeLink, DialogoDeMedia, Etiqueta, campoSelect, useAccionDeMedia } from "./dialogo-de-media";
import type { OpcionesDeMedia } from "./tipos";

/**
 * "Agregar pieza": el formulario y, al crear, la confirmacion DENTRO del mismo pop-up (el link
 * con su UTM y copiar), nunca una tarjeta suelta en la pagina. La vista previa del UTM usa las
 * mismas funciones puras que el servidor, asi que no puede diferir del link real.
 */
export function FormularioDePieza({ opciones, onCerrar }: { opciones: OpcionesDeMedia; onCerrar: () => void }) {
  const { pendiente, correr } = useAccionDeMedia();
  const vacio = {
    nombre: "",
    creadorId: opciones.creadores.length === 1 ? opciones.creadores[0].id : "",
    tipoId: "",
    red: opciones.redes[0] ?? "",
    fecha: "",
    permanente: false,
    cta: "",
  };
  const [f, setF] = useState(vacio);
  const [creada, setCreada] = useState<{ titulo: string; link?: string; desglose?: { nombre: string; valor: string }[]; sinLink?: string } | null>(null);
  const elCreador = opciones.creadores.find((c) => c.id === f.creadorId);
  const elTipo = opciones.tipos.find((t) => t.id === f.tipoId);
  const campana =
    elCreador && elTipo && (f.permanente || f.fecha)
      ? sanearUtm(campanaDePieza({ tipo: elTipo.nombre, creadorSlug: elCreador.slug, fechaPublicacion: f.permanente ? null : f.fecha, permanente: f.permanente }))
      : null;

  if (creada) {
    return (
      <DialogoDeMedia titulo="Pieza creada" descripcion={creada.titulo} onCerrar={onCerrar}>
        {creada.link ? (
          <>
            <p className="text-sm text-muted-foreground">Usa este link en la publicación. Es el que atribuye los leads a esta pieza.</p>
            <BloqueDeLink url={creada.link} desglose={creada.desglose ?? []} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{creada.sinLink}</p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => { setCreada(null); setF({ ...vacio, creadorId: f.creadorId, tipoId: f.tipoId, red: f.red }); }}>Agregar otra</Button>
          <Button type="button" onClick={onCerrar}>Listo</Button>
        </DialogFooter>
      </DialogoDeMedia>
    );
  }

  return (
    <DialogoDeMedia titulo="Agregar pieza" descripcion="Un contenido concreto (un reel, una historia). Al crearla recibes su link con el UTM armado." onCerrar={onCerrar}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          correr(
            () => crearPiezaAccion({
              nombre: f.nombre,
              creadorId: f.creadorId,
              tipoId: f.tipoId,
              red: f.red as never,
              cta: f.cta || null,
              permanente: f.permanente,
              fechaPublicacion: f.permanente ? null : f.fecha || null,
            }),
            "Pieza creada",
            (r) => setCreada({ titulo: `${f.nombre} · ${elCreador?.nombre ?? ""}`, link: r.link, desglose: r.desglose, sinLink: r.sinLink }),
          );
        }}
      >
        <Etiqueta texto="Nombre de la pieza" ayuda="Cómo la reconoce el equipo, p. ej. “Reel objeción del precio”. Solo se ve en el CRM.">
          <Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} maxLength={80} required />
        </Etiqueta>
        <Etiqueta texto="Creador">
          <select className={campoSelect} value={f.creadorId} onChange={(e) => setF({ ...f, creadorId: e.target.value })} required>
            <option value="">Elige un creador…</option>
            {opciones.creadores.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.programa ?? "sin programa"}</option>)}
          </select>
        </Etiqueta>
        <div className="grid grid-cols-2 gap-3">
          <Etiqueta texto="Tipo de pieza">
            <select className={campoSelect} value={f.tipoId} onChange={(e) => setF({ ...f, tipoId: e.target.value })} required>
              <option value="">Elige…</option>
              {opciones.tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Etiqueta>
          <Etiqueta texto="Red">
            <select className={campoSelect} value={f.red} onChange={(e) => setF({ ...f, red: e.target.value })}>
              {opciones.redes.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Etiqueta>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted-foreground">¿Cuándo se publica?</legend>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={f.permanente ? "outline" : "default"} onClick={() => setF({ ...f, permanente: false })}>Un día concreto</Button>
            <Button type="button" size="sm" variant={f.permanente ? "default" : "outline"} onClick={() => setF({ ...f, permanente: true, fecha: "" })}>Siempre visible</Button>
          </div>
          {f.permanente ? (
            <p className="text-xs text-muted-foreground">Para el link fijo del creador (bio, perfil, destacadas). Solo una por creador y red.</p>
          ) : (
            <Input type="date" aria-label="Fecha de publicación" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
          )}
        </fieldset>
        <Etiqueta texto="Llamado a la acción (opcional)" ayuda="Lo que le pides a la audiencia, p. ej. “agenda tu llamada”. Es una nota para el equipo; no viaja en el UTM.">
          <Input value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} />
        </Etiqueta>

        <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
          <p className="font-medium">Así quedará el UTM del link</p>
          <p className="font-mono">utm_source=<b>{f.red}</b></p>
          <p className="font-mono">utm_medium=<b>{opciones.medioDeContenido}</b></p>
          <p className="break-all font-mono">utm_campaign=<b>{campana ?? "(elige creador, tipo y fecha)"}</b></p>
          <p className="font-mono">utm_content=<b>(código de la pieza, se genera al crearla)</b></p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" disabled={pendiente}>Agregar pieza</Button>
        </DialogFooter>
      </form>
    </DialogoDeMedia>
  );
}
