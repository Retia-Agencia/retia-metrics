import type { ReactNode } from "react";

type Props = {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
};

/**
 * La HOJA de cada pantalla (sistema "Tinta", docs/design-system.md): una barra de
 * titulo blanca pegada arriba y el trabajo sobre el fondo gris azulado, donde las
 * tarjetas se leen como hojas. Toda pantalla de la app entra por aqui, asi que el
 * encabezado es igual en todas.
 */
export function PageShell({ titulo, descripcion, acciones, children }: Props) {
  return (
    <>
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-card/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{titulo}</h1>
          {descripcion ? (
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        {acciones}
      </header>
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </>
  );
}
