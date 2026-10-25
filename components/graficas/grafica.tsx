import { GraficaDinamica } from "@/components/graficas/grafica-dinamica";
import {
  crearModeloGrafica,
  filasDeTabla,
  type ComparacionDeGrafica,
  type MetaDeGrafica,
  type SerieDeGrafica,
} from "@/components/graficas/contrato";

interface GraficaProps {
  tipo?: "linea" | "barra";
  datos: { dias: string[]; series: SerieDeGrafica[] };
  titulo: string;
  unidad: string;
  frescura: string;
  etiquetas?: string[];
  formato: (valor: number) => string;
  comparacion?: ComparacionDeGrafica;
  meta?: MetaDeGrafica;
}

/** Contrato único de gráficas del CRM (ADR 0091). */
export function Grafica({ tipo, datos, titulo, unidad, frescura, etiquetas, formato, comparacion, meta }: GraficaProps) {
  const modelo = crearModeloGrafica({
    tipo,
    unidad,
    dias: datos.dias,
    etiquetas: etiquetas ?? datos.dias,
    series: datos.series,
    comparacion,
    meta,
    escribir: formato,
  });
  const filas = filasDeTabla(modelo);
  const tieneDatos = modelo.series.some((serie) => serie.valores.some((valor) => valor !== null));
  if (!datos.dias.length || !tieneDatos) return <p className="text-sm text-muted-foreground">Sin datos para {titulo}.</p>;

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{titulo} · {unidad}</figcaption>
      <p className="text-xs text-muted-foreground">{frescura}</p>
      <GraficaDinamica modelo={modelo} titulo={`${titulo}, ${unidad}. Ejes lineales con cero visible.`} />
      <details className="text-sm">
        <summary className="cursor-pointer rounded-lg px-2 py-1 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          Ver cifras de {titulo}
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full cifra text-xs">
            <caption>{titulo}, {unidad}</caption>
            <thead><tr><th>{etiquetas ? "Punto" : "Día"}</th>{modelo.series.map((serie) => <th key={serie.clave}>{serie.clave}</th>)}</tr></thead>
            <tbody>{filas.map((fila) => (
              <tr key={fila.dia}>
                <th>{fila.etiqueta}</th>
                {fila.celdas.map((celda) => <td key={celda.clave} className="px-2 py-1 text-right whitespace-nowrap">
                  {celda.enlace ? <a href={celda.enlace} className="text-primary underline hover:opacity-70 focus-visible:outline-2 focus-visible:outline-ring">{celda.texto}</a> : celda.texto}
                </td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
