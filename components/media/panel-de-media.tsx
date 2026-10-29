"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  crearCreadorAccion,
  crearPiezaAccion,
  crearTipoDePiezaAccion,
  descartarPiezaAccion,
  marcarPublicadaAccion,
  type ResultadoAccion,
} from "@/app/(app)/media/acciones";

/**
 * La pagina minima de media (tickets 316 y 317, ADR 0107): crear creadores, tipos y piezas,
 * copiar el link de cada pieza, marcar "ya publiqué" y descartar. Todo llega calculado del
 * servidor: el link se arma alla (`linkDeLaPieza`) y aqui solo se copia; un creador sin programa
 * no tiene boton de copiar y dice por que. Ninguna regla vive aqui: cada accion la valida el servidor.
 */
export interface PiezaVista {
  id: string;
  tipo: string;
  red: string;
  cta: string | null;
  fecha: string | null;
  permanente: boolean;
  publicada: boolean;
  /** El link ya armado, o el porque no hay. */
  link: { ok: true; url: string } | { ok: false; motivo: string };
}
export interface CreadorVista {
  id: string;
  nombre: string;
  activo: boolean;
  programa: string | null;
  piezas: PiezaVista[];
}
export interface OpcionesDeMedia {
  redes: readonly string[];
  tipos: { id: string; nombre: string }[];
  programas: { id: string; nombre: string }[];
  /** Solo quien no tiene el alcance limitado puede crear un creador sin programa. */
  conSinPrograma: boolean;
  /** El programa elegido en el selector: prellena el del creador nuevo. */
  programaInicial: string;
}

const campo = "h-9 rounded-md border bg-background px-2 text-sm";

export function PanelDeMedia({ creadores, opciones }: { creadores: CreadorVista[]; opciones: OpcionesDeMedia }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [creador, setCreador] = useState({ nombre: "", slug: "", programId: opciones.programaInicial });
  const [creado, setCreado] = useState<{ pieza: string; link?: string; sinLink?: string } | null>(null);
  const [tipo, setTipo] = useState("");

  function correr(accion: () => Promise<ResultadoAccion>, ok: string, despues?: (r: ResultadoAccion & { ok: true }) => void) {
    empezar(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(ok);
        despues?.(r);
        router.refresh();
      } else toast.error(r.error);
    });
  }
  function copiar(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado"),
      () => toast.error("No se pudo copiar el link"),
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Nuevo creador</CardTitle></CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              correr(
                () => crearCreadorAccion({ nombre: creador.nombre, slug: creador.slug, programId: creador.programId || null }),
                "Creador creado",
                () => setCreador({ nombre: "", slug: "", programId: opciones.programaInicial }),
              );
            }}
          >
            <Input className="sm:w-44" placeholder="Nombre" value={creador.nombre} onChange={(e) => setCreador({ ...creador, nombre: e.target.value })} required />
            <Input className="sm:w-36" placeholder="slug-corto" value={creador.slug} onChange={(e) => setCreador({ ...creador, slug: e.target.value })} required />
            <select className={campo} aria-label="Programa" required={!opciones.conSinPrograma} value={creador.programId} onChange={(e) => setCreador({ ...creador, programId: e.target.value })}>
              {opciones.conSinPrograma ? <option value="">Sin programa</option> : <option value="" disabled>Elige un programa</option>}
              {opciones.programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <Button type="submit" disabled={pendiente}>Crear</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tipos de pieza</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{opciones.tipos.length === 0 ? "Aún no hay tipos." : opciones.tipos.map((t) => t.nombre).join(" · ")}</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              correr(() => crearTipoDePiezaAccion(tipo), "Tipo creado", () => setTipo(""));
            }}
          >
            <Input className="w-44" placeholder="Reel, Historia…" value={tipo} onChange={(e) => setTipo(e.target.value)} required />
            <Button type="submit" variant="outline" disabled={pendiente}>Agregar tipo</Button>
          </form>
        </CardContent>
      </Card>

      {creado ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Pieza creada: {creado.pieza}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {creado.link ? (
              <>
                <p className="break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">{creado.link}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => copiar(creado.link as string)}>Copiar link</Button>
              </>
            ) : (
              <p className="text-muted-foreground">{creado.sinLink}</p>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreado(null)}>Cerrar</Button>
          </CardContent>
        </Card>
      ) : null}

      {creadores.length === 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">Aún no hay creadores en tu alcance.</p>
      ) : creadores.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {c.nombre}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {c.programa ?? "sin programa"}{c.activo ? "" : " · desactivado"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.piezas.length === 0 ? <p className="text-sm text-muted-foreground">Sin piezas.</p> : (
              <ul className="divide-y rounded-md border">
                {c.piezas.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{p.tipo} · {p.red} · {p.permanente ? "permanente" : p.fecha}</span>
                      {p.cta ? <span className="block text-xs text-muted-foreground">{p.cta}</span> : null}
                      {!p.link.ok ? <span className="block text-xs text-muted-foreground">{p.link.motivo}</span> : null}
                    </span>
                    {p.link.ok ? <Button type="button" size="sm" variant="outline" onClick={() => copiar((p.link as { url: string }).url)}>Copiar link</Button> : null}
                    {p.publicada ? <span className="text-xs text-muted-foreground">Publicada</span> : (
                      <Button type="button" size="sm" variant="outline" disabled={pendiente} onClick={() => correr(() => marcarPublicadaAccion(p.id), "Marcada como publicada")}>Ya publiqué</Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pendiente}
                      onClick={() => {
                        const motivo = window.prompt("¿Por qué se descarta esta pieza?");
                        if (motivo) correr(() => descartarPiezaAccion(p.id, motivo), "Pieza descartada");
                      }}
                    >
                      Descartar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {c.activo ? <FormularioDePieza creadorId={c.id} nombreDelCreador={c.nombre} opciones={opciones} pendiente={pendiente} correr={correr} alCrear={(pieza, r) => setCreado({ pieza, link: r.link, sinLink: r.sinLink })} /> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FormularioDePieza({
  creadorId,
  nombreDelCreador,
  opciones,
  pendiente,
  correr,
  alCrear,
}: {
  creadorId: string;
  nombreDelCreador: string;
  opciones: OpcionesDeMedia;
  pendiente: boolean;
  correr: (accion: () => Promise<ResultadoAccion>, ok: string, despues?: (r: ResultadoAccion & { ok: true }) => void) => void;
  alCrear: (pieza: string, r: ResultadoAccion & { ok: true }) => void;
}) {
  const [f, setF] = useState({ tipoId: "", red: opciones.redes[0] ?? "", fecha: "", permanente: false, cta: "" });
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        correr(
          () => crearPiezaAccion({
            creadorId,
            tipoId: f.tipoId,
            red: f.red as never,
            cta: f.cta || null,
            permanente: f.permanente,
            fechaPublicacion: f.permanente ? null : f.fecha || null,
          }),
          "Pieza creada",
          (r) => {
            alCrear(`${nombreDelCreador} · ${f.red}`, r);
            setF({ ...f, fecha: "", cta: "" });
          },
        );
      }}
    >
      <select className={campo} aria-label="Tipo" value={f.tipoId} onChange={(e) => setF({ ...f, tipoId: e.target.value })} required>
        <option value="">Tipo…</option>
        {opciones.tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
      </select>
      <select className={campo} aria-label="Red" value={f.red} onChange={(e) => setF({ ...f, red: e.target.value })}>
        {opciones.redes.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={f.permanente} onChange={(e) => setF({ ...f, permanente: e.target.checked })} /> Permanente
      </label>
      {f.permanente ? null : <Input className="sm:w-40" type="date" aria-label="Fecha de publicación" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />}
      <Input className="sm:w-48" placeholder="CTA (opcional)" value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} />
      <Button type="submit" size="sm" disabled={pendiente}>Agregar pieza</Button>
    </form>
  );
}
