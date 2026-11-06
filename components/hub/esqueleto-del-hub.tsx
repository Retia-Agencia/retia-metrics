/**
 * Lo que se ve mientras llega el cuerpo de una pestaña del Hub (streaming). Solo tokens de Tinta
 * (`bg-muted`, `border-border`, `rounded-lg`): ningún color a mano. La forma imita la pantalla
 * real (una fila de cifras y dos bloques) para que no salte al llegar el contenido.
 */
export function EsqueletoDelHub() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">Cargando las cifras…</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-4">
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-7 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-muted/40 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

/** El pie "¿Vamos a llegar?" mientras llega. */
export function EsqueletoDelNorte() {
  return <div aria-hidden className="h-24 animate-pulse rounded-lg border border-border bg-muted/40 motion-reduce:animate-none" />;
}
