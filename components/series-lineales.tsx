import { fecha, num } from "@/lib/format";

const colores = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface SerieParaPintar {
  clave: string;
  /** `null` es un punto que no existe (B más corto que A, una tasa sin base): no se dibuja. */
  valores: Array<number | null>;
  /** Trazo punteado, p. ej. para el periodo B. Por defecto solo las que exceden la paleta. */
  punteada?: boolean;
  /** Índice de color; por defecto el de su posición. Sirve para que A y B de lo mismo compartan color. */
  color?: number;
  /** Lista de las filas de cada punto; una meta no lleva enlace. */
  enlaces?: Array<string | null>;
}

interface SeriesLinealesProps {
  /** `SeriesAlineadas` (lib/series-alineadas.ts) encaja tal cual. */
  datos: { dias: string[]; series: SerieParaPintar[] };
  titulo: string;
  unidad: string;
  /** Etiqueta de cada posición del eje X; por defecto la fecha del día. */
  etiquetas?: string[];
  /** Cómo se escribe un valor; por defecto `num`. */
  formato?: (valor: number) => string;
  /** Tabla desplegable para consultar cifras también desde una pantalla táctil. */
  mostrarTabla?: boolean;
}

/**
 * Superpone series ya alineadas sin añadir una librería para esta vista mínima.
 * Ambos ejes son lineales y Y incluye cero: la distancia entre puntos debe expresar
 * el cambio real, no amplificarlo con una escala logarítmica (ADR 0067).
 *
 * Los colores salen de Tinta y los trazos distinguen las series que exceden la
 * paleta. La tabla conserva los valores para quien no puede leer el SVG.
 */
export function SeriesLineales({ datos, titulo, unidad, etiquetas, formato, mostrarTabla }: SeriesLinealesProps) {
  const escribir = formato ?? ((n: number) => num(n));
  const valores = datos.series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  if (!datos.dias.length || !valores.length) {
    return <p className="text-sm text-muted-foreground">Sin datos para {titulo}.</p>;
  }

  const etiqueta = (i: number) => etiquetas?.[i] ?? fecha(datos.dias[i]);
  const color = (s: SerieParaPintar, i: number) => colores[(s.color ?? i) % colores.length];
  const trazo = (s: SerieParaPintar, i: number) =>
    s.punteada
      ? "6 4"
      : i >= colores.length && s.color === undefined
        ? `${2 + Math.floor(i / colores.length) * 2} 3`
        : undefined;
  const minimo = Math.min(0, ...valores);
  const maximo = Math.max(0, ...valores) || (minimo === 0 ? 1 : 0);
  const escribirEje = (valor: number) => formato ? formato(valor) : num(valor, Number.isInteger(valor) ? 0 : 1);
  const margen = Math.max(70, ...[0, 1, 2, 3, 4].map((i) =>
    escribirEje(minimo + (maximo - minimo) * i / 4).length * 8 + 16));
  const x = (i: number) =>
    margen + (datos.dias.length === 1 ? 270 : i * 540 / (datos.dias.length - 1));
  const y = (n: number) => 230 - (n - minimo) * 200 / (maximo - minimo);
  /** Los tramos sin hueco: un `null` corta la línea en vez de unir puntos que no existen. */
  const tramos = (vs: Array<number | null>) => {
    const salida: string[][] = [[]];
    vs.forEach((v, j) => {
      if (v === null) salida.push([]);
      else salida[salida.length - 1].push(`${x(j)},${y(v)}`);
    });
    return salida.filter((t) => t.length > 0);
  };

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{titulo} · {unidad}</figcaption>
      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${margen + 610} 280`}
        role="img"
        aria-label={`${titulo}, ${unidad}. Ejes lineales.`}
        className="w-full cifra text-xs"
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const valor = minimo + (maximo - minimo) * i / 4;
          return (
            <g key={i}>
              <line x1={margen} x2={margen + 540} y1={y(valor)} y2={y(valor)} stroke="var(--border)" />
              <text
                x={margen - 8}
                y={y(valor) + 4}
                textAnchor="end"
                fill="var(--muted-foreground)"
              >
                {escribirEje(valor)}
              </text>
            </g>
          );
        })}
        <line x1={margen} x2={margen} y1="30" y2="230" stroke="var(--muted-foreground)" />
        {datos.series.map((s, i) => (
          <g key={s.clave}>
            {tramos(s.valores).map((puntos, t) => (
              <polyline
                key={t}
                fill="none"
                stroke={color(s, i)}
                strokeWidth="2"
                strokeDasharray={trazo(s, i)}
                points={puntos.join(" ")}
              />
            ))}
            {s.valores.map((v, j) => {
              if (v === null) return null;
              const punto = (
              <circle
                key={j}
                cx={x(j)}
                cy={y(v)}
                r="3"
                fill={color(s, i)}
              >
                {/* Un solo texto: con varios nodos, React 19 no hidrata el <title> igual que el servidor. */}
                <title>{`${s.clave} · ${etiqueta(j)}: ${escribir(v)} ${unidad}`}</title>
              </circle>
              );
              const href = s.enlaces?.[j];
              return href ? (
                <a key={j} href={href} aria-label={`${s.clave} · ${etiqueta(j)}: ${escribir(v)} ${unidad}. Ver lista.`}
                  className="hover:opacity-70 focus-visible:outline-2 focus-visible:outline-ring">
                  {punto}
                </a>
              ) : punto;
            })}
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
            {etiqueta(i)}
          </text>
        ))}
      </svg>
      </div>
      <ul className="flex flex-wrap gap-4 text-sm" aria-label="Series">
        {datos.series.map((s, i) => (
          <li key={s.clave} className="flex items-center gap-2">
            <svg width="24" height="8" aria-hidden="true">
              <line
                x1="0"
                x2="24"
                y1="4"
                y2="4"
                stroke={color(s, i)}
                strokeWidth="2"
                strokeDasharray={trazo(s, i)}
              />
            </svg>{s.clave}
          </li>
        ))}
      </ul>
      {/* Una <table> no respeta el width:1px de sr-only y desborda la página: el div lo contiene. */}
      <details className={mostrarTabla ? "text-sm" : "sr-only"} open={mostrarTabla ? undefined : true}>
        <summary className="cursor-pointer rounded-lg px-2 py-1 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          Ver cifras de {titulo}
        </summary>
        <div className="overflow-x-auto">
        <table className="w-full cifra text-xs">
          <caption>{titulo}, {unidad}</caption>
          <thead>
            <tr>
              <th>{etiquetas ? "Punto" : "Día"}</th>
              {datos.series.map((s) => <th key={s.clave}>{s.clave}</th>)}
            </tr>
          </thead>
          <tbody>
            {datos.dias.map((dia, i) => (
              <tr key={`${dia}-${i}`}>
                <th>{etiqueta(i)}</th>
                {datos.series.map((s) => {
                  const v = s.valores[i];
                  const href = s.enlaces?.[i];
                  return <td key={s.clave} className="px-2 py-1 text-right whitespace-nowrap">
                    {v === null || v === undefined ? "—" : href ? (
                      <a href={href} className="text-primary underline hover:opacity-70 focus-visible:outline-2 focus-visible:outline-ring">{escribir(v)}</a>
                    ) : escribir(v)}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </figure>
  );
}
