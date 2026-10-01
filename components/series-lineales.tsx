import { fecha, num } from "@/lib/format";
import type { SeriesAlineadas } from "@/lib/series-alineadas";

const colores = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface SeriesLinealesProps {
  datos: SeriesAlineadas;
  titulo: string;
  unidad: string;
}

/**
 * Superpone series ya alineadas sin añadir una librería para esta vista mínima.
 * Ambos ejes son lineales y Y incluye cero: la distancia entre puntos debe expresar
 * el cambio real, no amplificarlo con una escala logarítmica (ADR 0067).
 *
 * Los colores salen de Tinta y los trazos distinguen las series que exceden la
 * paleta. La tabla conserva los valores para quien no puede leer el SVG.
 */
export function SeriesLineales({ datos, titulo, unidad }: SeriesLinealesProps) {
  if (!datos.dias.length || !datos.series.length) {
    return <p className="text-sm text-muted-foreground">Sin datos para {titulo}.</p>;
  }

  const valores = datos.series.flatMap((s) => s.valores);
  const minimo = Math.min(0, ...valores);
  const maximo = Math.max(0, ...valores) || (minimo === 0 ? 1 : 0);
  const x = (i: number) =>
    70 + (datos.dias.length === 1 ? 270 : i * 540 / (datos.dias.length - 1));
  const y = (n: number) => 230 - (n - minimo) * 200 / (maximo - minimo);

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{titulo} · {unidad}</figcaption>
      <svg
        viewBox="0 0 680 280"
        role="img"
        aria-label={`${titulo}, por día, ${unidad}. Ejes lineales.`}
        className="w-full cifra text-xs"
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const valor = minimo + (maximo - minimo) * i / 4;
          return (
            <g key={i}>
              <line x1="70" x2="610" y1={y(valor)} y2={y(valor)} stroke="var(--border)" />
              <text
                x="62"
                y={y(valor) + 4}
                textAnchor="end"
                fill="var(--muted-foreground)"
              >
                {num(valor, Number.isInteger(valor) ? 0 : 1)}
              </text>
            </g>
          );
        })}
        <line x1="70" x2="70" y1="30" y2="230" stroke="var(--muted-foreground)" />
        {datos.series.map((s, i) => (
          <g key={s.clave}>
            <polyline
              fill="none"
              stroke={colores[i % colores.length]}
              strokeWidth="2"
              strokeDasharray={
                i >= colores.length ? `${2 + Math.floor(i / colores.length) * 2} 3` : undefined
              }
              points={s.valores.map((v, j) => `${x(j)},${y(v)}`).join(" ")}
            />
            {s.valores.map((v, j) => (
              <circle
                key={j}
                cx={x(j)}
                cy={y(v)}
                r="3"
                fill={colores[i % colores.length]}
              >
                <title>{s.clave} · {fecha(datos.dias[j])}: {num(v)} {unidad}</title>
              </circle>
            ))}
          </g>
        ))}
        {[...new Set([0, Math.floor((datos.dias.length - 1) / 2), datos.dias.length - 1])].map((i) => (
          <text
            key={i}
            x={x(i)}
            y="255"
            textAnchor="middle"
            fill="var(--muted-foreground)"
          >
            {fecha(datos.dias[i])}
          </text>
        ))}
      </svg>
      <ul className="flex flex-wrap gap-4 text-sm" aria-label="Series">
        {datos.series.map((s, i) => (
          <li key={s.clave} className="flex items-center gap-2">
            <svg width="24" height="8" aria-hidden="true">
              <line
                x1="0"
                x2="24"
                y1="4"
                y2="4"
                stroke={colores[i % colores.length]}
                strokeWidth="2"
                strokeDasharray={
                  i >= colores.length ? `${2 + Math.floor(i / colores.length) * 2} 3` : undefined
                }
              />
            </svg>{s.clave}
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{titulo}, {unidad}</caption>
        <thead>
          <tr>
            <th>Día</th>
            {datos.series.map((s) => <th key={s.clave}>{s.clave}</th>)}
          </tr>
        </thead>
        <tbody>
          {datos.dias.map((dia, i) => (
            <tr key={dia}>
              <th>{fecha(dia)}</th>
              {datos.series.map((s) => <td key={s.clave}>{num(s.valores[i])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
