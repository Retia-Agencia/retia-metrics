"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogoForm } from "@/components/deals/ficha/campos";
import {
  previsualizarReclamoCsvAccion,
  reclamarDealsDeCsvAccion,
} from "@/app/(app)/p/[programa]/inbox/acciones";
import {
  csvDeNoReclamados,
  ETIQUETA_DE_RESULTADO,
  marcarDuplicados,
  parsearCsvDeReclamo,
  type CategoriaReclamoCsv,
  type ResultadoFilaReclamo,
} from "@/lib/deals/csv-reclamo";

const MAX_ARCHIVO = 5 * 1024 * 1024;
const TAMANO_LOTE = 500;
const FILAS_POR_PAGINA = 100;
const ETIQUETAS: Record<CategoriaReclamoCsv, string> = {
  reclamable: "Se pueden reclamar",
  ya_es_tuyo: "Ya son tuyos",
  de_otro: "Los tiene otra persona",
  sin_dueno_fuera_de_setteo: "Están fuera de Por settear",
  sin_deal_abierto: "No tienen deal abierto",
  no_esta: "No están en el programa",
  ambiguo: "Tienen coincidencias ambiguas",
  invalida: "No tienen contacto válido",
  duplicada: "Están repetidos en el archivo",
};

function lotesDe<T>(filas: readonly T[]): T[][] {
  const lotes: T[][] = [];
  for (let inicio = 0; inicio < filas.length; inicio += TAMANO_LOTE) {
    lotes.push(filas.slice(inicio, inicio + TAMANO_LOTE));
  }
  return lotes;
}

function conteosDe(resultados: readonly ResultadoFilaReclamo[]): Map<CategoriaReclamoCsv, number> {
  const conteos = new Map<CategoriaReclamoCsv, number>();
  for (const resultado of resultados) conteos.set(resultado.categoria, (conteos.get(resultado.categoria) ?? 0) + 1);
  return conteos;
}

export function ReclamarPorCsv({ programId }: { programId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const operando = useRef(false);
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [pendiente, setPendiente] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [resultados, setResultados] = useState<ResultadoFilaReclamo[]>([]);
  const [paginaVista, setPaginaVista] = useState(0);
  const [reclamados, setReclamados] = useState(0);
  const [reclamoHecho, setReclamoHecho] = useState(false);

  const cerrar = () => {
    if (pendiente) return;
    setAbierto(false);
    setPaso(1);
    setResultados([]);
    setPaginaVista(0);
    setProgreso({ actual: 0, total: 0 });
    if (reclamoHecho) router.refresh();
    setReclamoHecho(false);
    setReclamados(0);
  };

  async function analizar(archivo: File) {
    if (operando.current) return;
    if (archivo.size > MAX_ARCHIVO) {
      toast.error("El archivo supera el tope de 5 MB.");
      return;
    }
    operando.current = true;
    setPendiente(true);
    try {
      const { filas } = parsearCsvDeReclamo(await archivo.text());
      setProgreso({ actual: 0, total: filas.length });
      const acumulados: ResultadoFilaReclamo[] = [];
      for (const lote of lotesDe(filas)) {
        const respuesta = await previsualizarReclamoCsvAccion({ programId, filas: lote });
        if (!respuesta.ok) throw new Error(respuesta.error);
        acumulados.push(...respuesta.resultados);
        setProgreso({ actual: acumulados.length, total: filas.length });
      }
      setResultados(marcarDuplicados(acumulados));
      setPaginaVista(0);
      setPaso(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos leer el CSV.", { duration: 6000 });
    } finally {
      operando.current = false;
      setPendiente(false);
      if (input.current) input.current.value = "";
    }
  }

  async function confirmar() {
    if (operando.current) return;
    const dealIds = [...new Set(resultados.flatMap((resultado) =>
      resultado.categoria === "reclamable" && resultado.dealId ? [resultado.dealId] : []))];
    if (dealIds.length === 0) return;
    operando.current = true;
    setPendiente(true);
    const idsReclamados = new Set<string>();
    const idsSaltados = new Set<string>();
    try {
      setProgreso({ actual: 0, total: dealIds.length });
      for (const lote of lotesDe(dealIds)) {
        const respuesta = await reclamarDealsDeCsvAccion({ programId, dealIds: lote });
        if (!respuesta.ok) throw new Error(respuesta.error);
        respuesta.reclamados.forEach((id) => idsReclamados.add(id));
        respuesta.saltados.forEach((id) => idsSaltados.add(id));
        setProgreso({ actual: idsReclamados.size + idsSaltados.size, total: dealIds.length });
      }
      setResultados((actuales) => actuales.map((resultado) =>
        resultado.dealId && idsSaltados.has(resultado.dealId)
          ? { ...resultado, categoria: "de_otro", dealId: null, detalle: "Lo reclamó otra persona antes de confirmar." }
          : resultado));
      setReclamados(idsReclamados.size);
      setReclamoHecho(true);
      setPaso(3);
      toast.success(`Te asignaste ${idsReclamados.size} deals.`);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "No pudimos reclamar los deals.";
      if (idsReclamados.size + idsSaltados.size > 0) {
        toast.error(`Se procesaron ${idsReclamados.size + idsSaltados.size} deals antes del error: ${mensaje} La vista se actualizará.`, { duration: 8000 });
        setAbierto(false);
        setPaso(1);
        setResultados([]);
        setReclamados(0);
        setReclamoHecho(false);
        router.refresh();
      } else {
        toast.error(mensaje, { duration: 6000 });
      }
    } finally {
      operando.current = false;
      setPendiente(false);
    }
  }

  function descargar() {
    const blob = new Blob([csvDeNoReclamados(resultados)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "no-reclamados.csv";
    enlace.click();
    URL.revokeObjectURL(url);
  }

  const conteos = conteosDe(resultados);
  const reclamables = conteos.get("reclamable") ?? 0;
  const noReclamados = resultados.length - reclamables;
  const paginas = Math.max(1, Math.ceil(resultados.length / FILAS_POR_PAGINA));
  const filasVisibles = resultados.slice(
    paginaVista * FILAS_POR_PAGINA,
    (paginaVista + 1) * FILAS_POR_PAGINA,
  );

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>Reclamar desde CSV</Button>
      {abierto ? (
        <DialogoForm
          titulo="Reclamar desde CSV"
          descripcion={paso === 1
            ? "Sube un CSV con las personas que vas a settear; te asignamos las que estén en Por settear sin dueño."
            : paso === 2 ? "Revisa el resultado antes de confirmar." : "Terminamos de procesar tu archivo."}
          pendiente={pendiente}
          confirmar={paso === 2 ? { texto: `Reclamar ${reclamables}`, enCurso: "Reclamando…", onClick: confirmar } : undefined}
          deshabilitarConfirmar={reclamables === 0}
          textoCerrar={paso === 3 ? "Cerrar" : "Cancelar"}
          onCerrar={cerrar}
        >
          <div className="max-h-[65vh] min-w-0 space-y-4 overflow-y-auto pr-1">
            {paso === 1 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Pon una persona por fila. Usa los encabezados <strong>correo</strong> y <strong>celular</strong> (al menos uno).
                  El nombre es opcional y no se usa. Separa por coma o punto y coma; en Excel usa Guardar como → CSV.
                </p>
                <pre className="max-w-full overflow-x-auto rounded-md bg-muted p-3 text-xs">{`nombre,correo,celular\nAna,ana@correo.co,3001234567\nLuis,luis@correo.co,`}</pre>
                <div
                  className="rounded-lg border border-dashed p-6 text-center"
                  onDragOver={(evento) => evento.preventDefault()}
                  onDrop={(evento) => {
                    evento.preventDefault();
                    if (pendiente) return;
                    const archivo = evento.dataTransfer.files[0];
                    if (archivo) void analizar(archivo);
                  }}
                >
                  <p className="mb-3 text-sm text-muted-foreground">Suelta aquí tu CSV (máximo 5 MB).</p>
                  <input
                    ref={input}
                    className="hidden"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(evento) => {
                      const archivo = evento.target.files?.[0];
                      if (archivo) void analizar(archivo);
                    }}
                  />
                  <Button type="button" variant="outline" disabled={pendiente} onClick={() => input.current?.click()}>
                    {pendiente ? "Leyendo…" : "Elegir CSV"}
                  </Button>
                </div>
              </>
            ) : null}
            {pendiente && progreso.total > 0 ? (
              <p className="text-sm" role="status">{paso === 1 ? "Analizando" : "Reclamando"} {progreso.actual} de {progreso.total}</p>
            ) : null}
            {paso === 2 ? (
              <>
                <ul className="space-y-2 text-sm">
                  {[...conteos.entries()].map(([categoria, cantidad]) => (
                    <li key={categoria} className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                      <span>{ETIQUETAS[categoria]}</span><strong className="cifra">{cantidad}</strong>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Detalle por fila</h3>
                  <ul className="divide-y rounded-md border text-sm">
                    {filasVisibles.map((resultado) => (
                      <li key={resultado.fila} className="min-w-0 space-y-1 p-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <strong>Fila {resultado.fila}</strong>
                          <span>{ETIQUETA_DE_RESULTADO[resultado.categoria]}</span>
                        </div>
                        <p className="break-words text-muted-foreground">
                          {[resultado.correoOriginal, resultado.telefonoOriginal].filter(Boolean).join(" · ") || "Sin contacto válido"}
                        </p>
                        <p className="break-words">{resultado.detalle}</p>
                      </li>
                    ))}
                  </ul>
                  {paginas > 1 ? (
                    <div className="flex items-center justify-between gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={paginaVista === 0} onClick={() => setPaginaVista((pagina) => pagina - 1)}>
                        Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">Página {paginaVista + 1} de {paginas}</span>
                      <Button type="button" size="sm" variant="outline" disabled={paginaVista + 1 >= paginas} onClick={() => setPaginaVista((pagina) => pagina + 1)}>
                        Siguiente
                      </Button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            {paso === 3 ? (
              <>
                <p className="text-sm">Te asignaste <strong>{reclamados}</strong> deals. No se reclamaron <strong>{noReclamados}</strong> filas.</p>
                {noReclamados > 0 ? (
                  <Button type="button" variant="outline" className="w-full whitespace-normal" onClick={descargar}>
                    Descargar no reclamados (.csv)
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </DialogoForm>
      ) : null}
    </>
  );
}
