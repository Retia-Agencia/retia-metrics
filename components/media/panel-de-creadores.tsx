"use client";

import { useState } from "react";
import { crearLinkFijoAccion } from "@/app/(app)/media/acciones";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { DialogoDeMedia, Etiqueta, campoSelect, copiar, useAccionDeMedia } from "./dialogo-de-media";
import type { CreadorConLinksVista, OpcionesDeMedia } from "./tipos";

const SIN_RED = "__sin_red__";

function copiarSiExiste(link: CreadorConLinksVista["links"][number]["link"]) {
  if (link.ok) copiar(link.url);
}

/** Los links fijos viven con su creador; los links y sus errores llegan resueltos del servidor. */
export function PanelDeCreadores({ creadores, opciones }: { creadores: CreadorConLinksVista[]; opciones: OpcionesDeMedia }) {
  const [creadorId, setCreadorId] = useState<string | null>(null);
  const creador = creadores.find((c) => c.id === creadorId);

  if (creadores.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No hay creadores en este programa.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <ul className="divide-y">
        {creadores.map((c) => (
          <li key={c.id} className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{c.nombre}</p>
                <p className="text-sm text-muted-foreground">{c.programa ?? "Sin programa"}</p>
              </div>
              <Button type="button" size="sm" onClick={() => setCreadorId(c.id)} disabled={!c.activo || opciones.tipos.length === 0}>
                Agregar link fijo
              </Button>
            </div>
            {c.links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tiene links fijos.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {c.links.map((link) => (
                  <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{link.red ?? "Sin red"}</p>
                      {link.link.ok ? (
                        <p className="truncate font-mono text-xs text-muted-foreground">{link.link.url}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{link.link.motivo}</p>
                      )}
                    </div>
                    {link.link.ok ? <Button type="button" size="sm" variant="outline" onClick={() => copiarSiExiste(link.link)}>Copiar</Button> : null}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {creador ? <FormularioDeLinkFijo creador={creador} opciones={opciones} onCerrar={() => setCreadorId(null)} /> : null}
    </div>
  );
}

function FormularioDeLinkFijo({ creador, opciones, onCerrar }: { creador: CreadorConLinksVista; opciones: OpcionesDeMedia; onCerrar: () => void }) {
  const { pendiente, correr } = useAccionDeMedia();
  const [red, setRed] = useState(SIN_RED);
  const [tipoId, setTipoId] = useState("");
  return (
    <DialogoDeMedia titulo="Agregar link fijo" descripcion={`${creador.nombre} · ${creador.programa ?? "sin programa"}`} onCerrar={onCerrar}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          correr(
            () => crearLinkFijoAccion({ creadorId: creador.id, tipoId, red: red === SIN_RED ? null : red as never }),
            "Link fijo agregado",
            onCerrar,
          );
        }}
      >
        <Etiqueta texto="Red">
          <select className={campoSelect} value={red} onChange={(e) => setRed(e.target.value)} required>
            <option value={SIN_RED}>Sin red</option>
            {opciones.redes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Etiqueta>
        <Etiqueta texto="Tipo de pieza" ayuda="Elige el tipo que media usa para su contenido propio.">
          <select className={campoSelect} value={tipoId} onChange={(e) => setTipoId(e.target.value)} required>
            <option value="">Elige…</option>
            {opciones.tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </Etiqueta>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" disabled={pendiente}>Agregar link fijo</Button>
        </DialogFooter>
      </form>
    </DialogoDeMedia>
  );
}
