import { cn } from "@/lib/utils";

/**
 * El estado de carga de una pantalla (sistema "Tinta", docs/structure.md §9): lo que se ve al instante
 * mientras el servidor termina. Lo usan los `loading.tsx` de `app/`; ninguno repite este JSX.
 * Solo tokens: `bg-muted`, `rounded-*`, `shadow-tarjeta`. Respeta la hoja de `PageShell`
 * (barra de título blanca y el trabajo sobre el fondo gris).
 */
export type VarianteDeEsqueleto = "lista" | "tablero" | "ficha";

function Bloque({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

function Hoja({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-xl bg-card p-4 shadow-tarjeta", className)}>{children}</div>;
}

function Lista() {
  return (
    <Hoja className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Bloque className="h-9 w-56" />
        <Bloque className="h-9 w-32" />
        <Bloque className="h-9 w-32" />
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <Bloque key={i} className="h-10 w-full" />
      ))}
    </Hoja>
  );
}

function Tablero() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Hoja key={i} className="flex flex-col gap-2">
            <Bloque className="h-3 w-20" />
            <Bloque className="h-8 w-28" />
          </Hoja>
        ))}
      </div>
      <Hoja>
        <Bloque className="h-56 w-full" />
      </Hoja>
    </div>
  );
}

function Ficha() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Hoja className="flex flex-col gap-3 lg:col-span-2">
        <Bloque className="h-6 w-48" />
        {Array.from({ length: 5 }, (_, i) => (
          <Bloque key={i} className="h-10 w-full" />
        ))}
      </Hoja>
      <Hoja className="flex flex-col gap-3">
        <Bloque className="h-6 w-32" />
        <Bloque className="h-24 w-full" />
        <Bloque className="h-24 w-full" />
      </Hoja>
    </div>
  );
}

export function EsqueletoDePantalla({ variante = "lista" }: { variante?: VarianteDeEsqueleto }) {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando" className="flex flex-1 flex-col">
      <header className="flex items-center border-b bg-card px-4 py-4 md:px-6 lg:px-8">
        <Bloque className="h-6 w-48" />
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        {variante === "tablero" ? <Tablero /> : variante === "ficha" ? <Ficha /> : <Lista />}
      </main>
    </div>
  );
}
