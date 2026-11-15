"use client";

export default function ErrorDePantalla({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-[50vh] items-center justify-center px-4 py-12">
      <div className="flex max-w-md flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-foreground">No pudimos cargar esta pantalla</h1>
          <p className="text-sm text-muted-foreground">
            Puede que haya tardado demasiado. Vuelve a intentarlo.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
