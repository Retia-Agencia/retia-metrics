"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { editarCohorteAccion, editarProgramaAccion } from "@/app/(app)/p/[programa]/programa/acciones-programa";
import { guardarObjetivoAccion, quitarObjetivoAccion } from "@/app/(app)/p/[programa]/programa/acciones-objetivos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DatosConfiguracionHoy } from "@/lib/queries/configuracion-de-hoy";

type DatosDelPanel = DatosConfiguracionHoy & {
  slug: string;
  ritmo: 5 | 10 | 20;
};

const claseInput = "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Campo({ titulo, origen, children }: { titulo: string; origen: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm"><span className="font-medium">{titulo}</span>{children}<span className="block text-xs text-muted-foreground">{origen}</span></label>;
}

export function ConfiguracionHoy({ datos }: { datos: DatosDelPanel }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [metaCupos, setMetaCupos] = useState(String(datos.cohorte?.metaCupos ?? ""));
  const [cierre, setCierre] = useState(datos.cohorte?.fechaCierreVentas ?? "");
  const [metaLeads, setMetaLeads] = useState(datos.cohorte?.metaLeadsDia?.toString() ?? "");
  const [objetivo, setObjetivo] = useState(datos.objetivo?.meta.toString() ?? "");
  const [muestra, setMuestra] = useState(String(datos.programa.muestraMinimaConversion));
  const [ritmo, setRitmo] = useState(String(datos.ritmo));

  const guardar = () => iniciar(async () => {
    const resultados = [];
    if (datos.cohorte) {
      resultados.push(await editarCohorteAccion(datos.slug, datos.cohorte.id, {
        ...datos.cohorte,
        metaCupos,
        metaLeadsDia: metaLeads === "" ? null : metaLeads,
        fechaCierreVentas: cierre,
      }));
      if (objetivo === "" && datos.objetivo) resultados.push(await quitarObjetivoAccion(datos.objetivo.id));
      if (objetivo !== "") resultados.push(await guardarObjetivoAccion({
        id: datos.objetivo?.id,
        cohortId: datos.cohorte.id,
        area: null,
        metrica: "conversion_agenda_venta",
        meta: objetivo,
        aceptable: null,
      }));
    }
    resultados.push(await editarProgramaAccion(datos.programa.id, { ...datos.programa, muestraMinimaConversion: muestra }));
    const fallo = resultados.find((resultado) => !resultado.ok);
    if (fallo && !fallo.ok) {
      toast.error("No se pudo guardar", { description: fallo.error });
      return;
    }
    const q = new URLSearchParams(window.location.search);
    q.set("seccion", "hoy");
    q.set("ritmo", ritmo);
    router.replace(`${window.location.pathname}?${q.toString()}`);
    router.refresh();
    setAbierto(false);
    toast.success("Configuración actualizada");
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Configuración</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogTitle>Configuración de Hoy</DialogTitle>
        <DialogDescription>Supuestos de la cohorte activa y de la proyección.</DialogDescription>
        {!datos.cohorte ? <p className="text-sm text-muted-foreground">No hay una cohorte activa. Configúrala en Programa.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo titulo="Meta de cupos" origen="Sale de la cohorte activa."><input className={claseInput} type="number" min="0" value={metaCupos} disabled={!datos.cohorte} onChange={(e) => setMetaCupos(e.target.value)} /></Campo>
          <Campo titulo="Cierre de ventas" origen="Sale de la ventana de ventas de la cohorte."><input className={claseInput} type="date" value={cierre} disabled={!datos.cohorte} onChange={(e) => setCierre(e.target.value)} /></Campo>
          <Campo titulo="Meta de leads por día" origen="Es la meta declarada en la cohorte; no es el requerido calculado."><input className={claseInput} type="number" min="0" value={metaLeads} disabled={!datos.cohorte} onChange={(e) => setMetaLeads(e.target.value)} /></Campo>
          <Campo titulo="Objetivo agenda → venta (%)" origen="Objetivo declarado de la cohorte; vacío usa las tasas medidas."><input className={claseInput} type="number" min="0" max="100" step="0.01" value={objetivo} disabled={!datos.cohorte} onChange={(e) => setObjetivo(e.target.value)} /></Campo>
          <Campo titulo="Muestra mínima de conversión" origen="Sale del programa y decide cuándo una tasa medida es suficiente."><input className={claseInput} type="number" min="1" value={muestra} onChange={(e) => setMuestra(e.target.value)} /></Campo>
          <Campo titulo="Ventana del ritmo" origen="Vive en este enlace; no se guarda en el programa."><select className={claseInput} value={ritmo} onChange={(e) => setRitmo(e.target.value)}><option value="5">5 días hábiles</option><option value="10">10 días hábiles</option><option value="20">20 días hábiles</option></select></Campo>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setAbierto(false)} disabled={pendiente}>Cancelar</Button><Button onClick={guardar} disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
