"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { editarCohorteAccion, editarProgramaAccion } from "@/app/(app)/p/[programa]/programa/acciones-programa";
import { guardarObjetivoAccion, quitarObjetivoAccion } from "@/app/(app)/p/[programa]/programa/acciones-objetivos";
import { abrirInfo } from "@/components/hub/info-de-pagina";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DatosConfiguracionHoy } from "@/lib/queries/configuracion-de-hoy";
import { num, pct } from "@/lib/format";
import { definicion, nombreCorto } from "@/lib/vocabulario-metricas";

/** Los números vivos de la cohorte, para que cada ejemplo del panel sea con sus cifras y no inventado. */
export interface VivoDeHoy {
  faltan: number;
  diasHabilesRestantes: number;
  ventasPorDia: number | null;
  leadsPorDia: number | null;
  pctCierre: number | null;
  pctShow: number | null;
  objetivoAgendaAVenta: number | null;
  citasPorLead: number | null;
  origenDeLaTasa: string;
  personasConCita: number | null;
  asistentes: number | null;
}

type DatosDelPanel = DatosConfiguracionHoy & {
  slug: string;
  ritmo: 5 | 10 | 20;
  vivo: VivoDeHoy;
};

const claseInput = "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const p1 = (v: number | null) => (v === null ? "—" : pct(v));

/** Un grupo del panel: una tarjeta con su título y su pregunta. */
function Grupo({ titulo, pregunta, children }: { titulo: string; pregunta: string; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-xl border p-4"><div><h4 className="text-sm font-semibold">{titulo}</h4><p className="text-xs text-muted-foreground">{pregunta}</p></div>{children}</section>;
}

/**
 * Un campo explicado: el nombre en palabras de todos los días, para qué sirve, qué cifras de Hoy cambia (con
 * el enlace a su apartado del Info), un ejemplo con números de la cohorte y el valor de hoy con su origen.
 */
function Campo({ titulo, sirve, cambia, ejemplo, ahora, verEnInfo, children }: {
  titulo: string;
  sirve: string;
  cambia: { texto: string; seccion: string }[];
  ejemplo: string;
  ahora: string;
  verEnInfo: (seccion: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <label className="block space-y-1"><span className="font-medium">{titulo}</span>{children}</label>
      <p className="text-xs text-muted-foreground">{sirve}</p>
      <p className="text-xs text-muted-foreground">
        Cambia:{" "}
        {cambia.map((c, i) => (
          <span key={c.seccion + c.texto}>{i > 0 ? ", " : ""}<button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => verEnInfo(c.seccion)}>{c.texto}</button></span>
        ))}
      </p>
      <p className="rounded-md bg-muted px-2 py-1 text-xs">Ejemplo: {ejemplo}</p>
      <p className="text-xs"><span className="text-muted-foreground">Ahora: </span>{ahora}</p>
    </div>
  );
}

/** Con `enlace` el botón es un enlace corto ("Definir objetivo") para las tarjetas que no tienen objetivo. */
export function ConfiguracionHoy({ datos, enlace = false }: { datos: DatosDelPanel; enlace?: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [metaCupos, setMetaCupos] = useState(String(datos.cohorte?.metaCupos ?? ""));
  const [cierre, setCierre] = useState(datos.cohorte?.fechaCierreVentas ?? "");
  const [metaLeads, setMetaLeads] = useState(datos.cohorte?.metaLeadsDia?.toString() ?? "");
  const [objetivo, setObjetivo] = useState(datos.objetivo?.meta.toString() ?? "");
  const [muestra, setMuestra] = useState(String(datos.programa.muestraMinimaConversion));
  const [ritmo, setRitmo] = useState(String(datos.ritmo));
  const v = datos.vivo;
  const codigo = datos.cohorte?.codigo ?? "la cohorte";

  /** Cierra el panel y abre el Info de Hoy en su apartado (`?info=`), sin pedirle nada al servidor. */
  const verEnInfo = (seccion: string) => {
    setAbierto(false);
    abrirInfo(seccion);
  };

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
      <DialogTrigger render={<Button size="sm" variant={enlace ? "link" : "outline"} className={enlace ? "h-auto p-0" : undefined} />}>{enlace ? "Definir objetivo" : "Configuración"}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogTitle>Configuración de Hoy</DialogTitle>
        <DialogDescription>Con estos seis datos se calculan los objetivos y los leads que hacen falta. Cada cambio queda registrado.</DialogDescription>
        {!datos.cohorte ? <p className="text-sm text-muted-foreground">No hay una cohorte activa. Configúrala en Programa.</p> : null}

        <Grupo titulo="Objetivos de la cohorte" pregunta="¿Cuánto queremos vender y hasta cuándo?">
          <Campo
            titulo={nombreCorto("objetivo_cohorte")}
            sirve="Cuántos cupos quiere vender la empresa en toda la cohorte."
            cambia={[{ texto: "objetivo del día", seccion: "cifras" }, { texto: "objetivo de la semana", seccion: "semana" }, { texto: "leads que hacen falta", seccion: "leads-que-hacen-falta" }]}
            ejemplo={`con ${num(Number(metaCupos) || 0)} cupos y ${num(Number(metaCupos) - v.faltan || 0)} vendidos, faltan ${num(v.faltan)}.`}
            ahora={datos.cohorte ? `${num(datos.cohorte.metaCupos)} cupos (de ${codigo}; siempre está puesto).` : "sin cohorte activa."}
            verEnInfo={verEnInfo}
          ><input className={claseInput} type="number" min="0" value={metaCupos} disabled={!datos.cohorte} onChange={(e) => setMetaCupos(e.target.value)} /></Campo>
          <Campo
            titulo="Cierre de ventas"
            sirve="El último día en que se vende la cohorte."
            cambia={[{ texto: "días hábiles que quedan", seccion: "leads-que-hacen-falta" }, { texto: "objetivo del día", seccion: "cifras" }, { texto: "reparto de la semana", seccion: "semana" }]}
            ejemplo={`quedan ${num(v.diasHabilesRestantes)} días hábiles; los ${num(v.faltan)} cupos que faltan piden ${v.ventasPorDia === null ? "—" : num(v.ventasPorDia, 1)} ventas por día.`}
            ahora={datos.cohorte?.fechaCierreVentas ? `${datos.cohorte.fechaCierreVentas} (puesta en ${codigo}).` : "sin fecha: no hay ventana de ventas y no se calcula el objetivo del día."}
            verEnInfo={verEnInfo}
          ><input className={claseInput} type="date" value={cierre} disabled={!datos.cohorte} onChange={(e) => setCierre(e.target.value)} /></Campo>
          <Campo
            titulo={nombreCorto("objetivo_de_leads")}
            sirve={definicion("objetivo_de_leads")}
            cambia={[{ texto: "barras de Leads de hoy y de la semana", seccion: "cifras" }]}
            ejemplo={`si escribes 60 y hoy llegaron 30, la barra de Leads va al 50 %. Hoy el cálculo pide ${v.leadsPorDia === null ? "—" : num(v.leadsPorDia, 0)} por día: es otra cosa y no se escribe aquí.`}
            ahora={datos.cohorte?.metaLeadsDia != null ? `${num(datos.cohorte.metaLeadsDia)} por día.` : "sin objetivo: se ve — y las barras de Leads no se dibujan. No cambia los leads que hacen falta."}
            verEnInfo={verEnInfo}
          ><input className={claseInput} type="number" min="0" value={metaLeads} disabled={!datos.cohorte} onChange={(e) => setMetaLeads(e.target.value)} /></Campo>
        </Grupo>

        <Grupo titulo="Cómo se calculan los leads que hacen falta" pregunta="¿Qué tasas usa el cálculo y de cuántos días hacia atrás?">
          <Campo
            titulo="De cada 100 citas, ¿cuántas deberían terminar en venta? (%)"
            sirve="Una promesa de conversión de cita a venta. Si la escribes, manda sobre lo que se mide."
            cambia={[{ texto: "leads que hacen falta", seccion: "leads-que-hacen-falta" }]}
            ejemplo={`con 15 %, de 100 citas se esperan 15 ventas. Hoy lo medido es cierre ${p1(v.pctCierre)} × asistencia ${p1(v.pctShow)}.`}
            ahora={v.objetivoAgendaAVenta !== null ? `${p1(v.objetivoAgendaAVenta)} (escrito por ustedes).` : `sin escribir: se usa lo medido (${v.origenDeLaTasa}): cierre ${p1(v.pctCierre)} y asistencia ${p1(v.pctShow)}.`}
            verEnInfo={verEnInfo}
          ><input className={claseInput} type="number" min="0" max="100" step="0.01" value={objetivo} disabled={!datos.cohorte} onChange={(e) => setObjetivo(e.target.value)} /></Campo>
          <Campo
            titulo={nombreCorto("citas_minimas")}
            sirve={definicion("citas_minimas")}
            cambia={[{ texto: "asistencia y cierre medidos", seccion: "embudo" }, { texto: "leads que hacen falta", seccion: "leads-que-hacen-falta" }]}
            ejemplo={`${codigo} tiene ${v.personasConCita === null ? "—" : num(v.personasConCita)} personas con cita y ${v.asistentes === null ? "—" : num(v.asistentes)} asistentes: ${v.personasConCita !== null && v.asistentes !== null && v.personasConCita >= Number(muestra) && v.asistentes >= Number(muestra) ? `con ${num(Number(muestra) || 0)} sí alcanza.` : `con ${num(Number(muestra) || 0)} todavía no alcanza.`}`}
            ahora={`${num(datos.programa.muestraMinimaConversion)} (del programa).`}
            verEnInfo={verEnInfo}
          ><input className={claseInput} type="number" min="1" value={muestra} onChange={(e) => setMuestra(e.target.value)} /></Campo>
          <Campo
            titulo={nombreCorto("dias_del_ritmo")}
            sirve={definicion("dias_del_ritmo")}
            cambia={[{ texto: "leads que hacen falta", seccion: "leads-que-hacen-falta" }, { texto: "reparto de la semana", seccion: "semana" }]}
            ejemplo={`con ${ritmo} días se miran los últimos ${ritmo} días hábiles; hoy da ${v.citasPorLead === null ? "—" : p1(v.citasPorLead)} citas por lead.`}
            ahora={`${datos.ritmo} días hábiles (vive en el enlace; no se guarda en el programa).`}
            verEnInfo={verEnInfo}
          ><select className={claseInput} value={ritmo} onChange={(e) => setRitmo(e.target.value)}><option value="5">5 días hábiles (una semana)</option><option value="10">10 días hábiles (dos semanas)</option><option value="20">20 días hábiles (un mes)</option></select></Campo>
        </Grupo>

        <DialogFooter><Button variant="outline" onClick={() => setAbierto(false)} disabled={pendiente}>Cancelar</Button><Button onClick={guardar} disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
