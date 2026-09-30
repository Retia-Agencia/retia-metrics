"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  crearCanalAccion,
  desactivarCanalAccion,
  editarCanalAccion,
  reactivarCanalAccion,
  type ResultadoCanalAccion,
} from "@/app/(app)/ajustes/canales/acciones";

type Formato = "plantilla_pauta" | "meta_historico" | "closer" | null;
export interface CanalVista {
  id: string;
  nombre: string;
  utmSource: string | null;
  utmMedium: string;
  areaId: string;
  area: string;
  formato: Formato;
  activo: boolean;
}
export interface AreaCanalVista { id: string; nombre: string }
export interface ParCanalVista { programId: string; programa: string; source: string; medium: string; envios: number }

interface Borrador {
  id: string | null;
  nombre: string;
  utmSource: string;
  utmMedium: string;
  areaId: string;
  formato: Formato;
}

const VACIO: Borrador = { id: null, nombre: "", utmSource: "", utmMedium: "", areaId: "", formato: null };
const ETIQUETA_FORMATO: Record<Exclude<Formato, null>, string> = {
  plantilla_pauta: "Plantilla de Pauta",
  meta_historico: "Meta histórico",
  closer: "Closer",
};
const claseControl = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CanalesAdmin({ canales, areas, pares }: { canales: CanalVista[]; areas: AreaCanalVista[]; pares: ParCanalVista[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [borrador, setBorrador] = useState<Borrador>(VACIO);

  function correr(accion: () => Promise<ResultadoCanalAccion>, mensaje: string, limpiar = false) {
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error });
        return;
      }
      toast.success(mensaje);
      if (limpiar) setBorrador(VACIO);
      router.refresh();
    });
  }

  function editar(canal: CanalVista) {
    setBorrador({ id: canal.id, nombre: canal.nombre, utmSource: canal.utmSource ?? "", utmMedium: canal.utmMedium, areaId: canal.areaId, formato: canal.formato });
  }

  function desdePar(par: ParCanalVista) {
    setBorrador({ id: null, nombre: `${par.source || "Cualquier source"} / ${par.medium || "sin medium"}`, utmSource: par.source, utmMedium: par.medium, areaId: "", formato: null });
    document.getElementById("formulario-canal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const entrada = { nombre: borrador.nombre, utmSource: borrador.utmSource, utmMedium: borrador.utmMedium, areaId: borrador.areaId, formato: borrador.formato };

  return (
    <div className="space-y-6">
      <Card id="formulario-canal">
        <CardHeader><CardTitle className="text-base">{borrador.id ? "Editar canal" : "Crear canal"}</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={(evento) => {
            evento.preventDefault();
            correr(() => borrador.id ? editarCanalAccion(borrador.id, entrada) : crearCanalAccion(entrada), borrador.id ? "Canal actualizado" : "Canal creado", true);
          }}>
            <Campo etiqueta="Nombre"><input className={claseControl} maxLength={80} required value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="UTM source (vacío = cualquiera)"><input className={claseControl} value={borrador.utmSource} onChange={(e) => setBorrador({ ...borrador, utmSource: e.target.value })} /></Campo>
            <Campo etiqueta="UTM medium"><input className={claseControl} required value={borrador.utmMedium} onChange={(e) => setBorrador({ ...borrador, utmMedium: e.target.value })} /></Campo>
            <Campo etiqueta="Área"><select className={claseControl} required value={borrador.areaId} onChange={(e) => setBorrador({ ...borrador, areaId: e.target.value })}><option value="">Selecciona un área</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></Campo>
            <Campo etiqueta="Formato"><select className={claseControl} value={borrador.formato ?? ""} onChange={(e) => setBorrador({ ...borrador, formato: (e.target.value || null) as Formato })}><option value="">Sin formato</option>{Object.entries(ETIQUETA_FORMATO).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></Campo>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={pendiente}><Plus className="size-4" />{borrador.id ? "Guardar" : "Crear"}</Button>
              {borrador.id ? <Button type="button" variant="outline" onClick={() => setBorrador(VACIO)}><X className="size-4" />Cancelar</Button> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Canales</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {canales.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay canales. Crea el primero arriba.</p> : <table className="w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4"><thead className="text-xs text-muted-foreground"><tr><th className="pb-2">Nombre</th><th className="pb-2">Source</th><th className="pb-2">Medium</th><th className="pb-2">Área</th><th className="pb-2">Formato</th><th className="pb-2">Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody className="divide-y">{canales.map((canal) => <tr key={canal.id}><td className="py-3 font-medium">{canal.nombre}</td><td>{canal.utmSource ?? "cualquiera"}</td><td>{canal.utmMedium}</td><td>{canal.area}</td><td>{canal.formato ? ETIQUETA_FORMATO[canal.formato] : "—"}</td><td><Badge variant={canal.activo ? "exito" : "neutro"}>{canal.activo ? "Activo" : "Inactivo"}</Badge></td><td><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => editar(canal)}><Pencil className="size-4" />Editar</Button><Button size="sm" variant="ghost" disabled={pendiente} onClick={() => correr(() => canal.activo ? desactivarCanalAccion(canal.id) : reactivarCanalAccion(canal.id), canal.activo ? "Canal desactivado" : "Canal reactivado")}><RotateCcw className="size-4" />{canal.activo ? "Desactivar" : "Reactivar"}</Button></div></td></tr>)}</tbody></table>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pares sin canal</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {pares.length === 0 ? <p className="text-sm text-muted-foreground">Todos los pares UTM completos están clasificados.</p> : <table className="w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4"><thead className="text-xs text-muted-foreground"><tr><th className="pb-2">Programa</th><th className="pb-2">Source</th><th className="pb-2">Medium</th><th className="pb-2 text-right">Envíos</th><th /></tr></thead><tbody className="divide-y">{pares.map((par) => <tr key={`${par.programId}:${par.source}:${par.medium}`}><td className="py-3 font-medium">{par.programa}</td><td>{par.source || "—"}</td><td>{par.medium || "—"}</td><td className="cifra text-right">{par.envios}</td><td className="text-right"><Button size="sm" variant="outline" onClick={() => desdePar(par)}>Crear canal</Button></td></tr>)}</tbody></table>}
        </CardContent>
      </Card>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return <label className="space-y-1 text-sm"><span className="font-medium">{etiqueta}</span>{children}</label>;
}
