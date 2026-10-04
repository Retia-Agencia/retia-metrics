import type { ReactNode } from "react";
import { Volver } from "@/components/volver";

type Props = {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  /** El enlace "← {lista}" sobre el titulo (ticket 174), en las pantallas de detalle. */
  volver?: { desde?: string; porDefecto: { href: string; etiqueta: string } };
  fija?: boolean;
  children: ReactNode;
};

/**
 * La HOJA de cada pantalla (sistema "Tinta", docs/structure.md §9): una barra de
 * titulo blanca pegada arriba y el trabajo sobre el fondo gris lila, donde las
 * tarjetas se leen como hojas. Toda pantalla de la app entra por aqui, asi que el
 * encabezado es igual en todas.
 */
export function PageShell({ titulo, descripcion, acciones, volver, fija, children }: Props) {
  if (fija) {
    return (
      <div className="flex min-h-0 flex-1 flex-col md:h-dvh md:max-h-dvh md:overflow-hidden">
        <header className="z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-card/95 px-4 py-4 md:sticky md:top-0 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:px-8">
          <div className="min-w-0">
            {volver ? (
              <div className="mb-1">
                <Volver {...volver} />
              </div>
            ) : null}
            <h1 className="text-lg font-semibold tracking-tight">{titulo}</h1>
            {descripcion ? (
              <p className="text-sm text-muted-foreground">{descripcion}</p>
            ) : null}
          </div>
          {acciones}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    );
  }

  return (
    <>
      <header className="z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-card/95 px-4 py-4 md:sticky md:top-0 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:px-8">
        <div className="min-w-0">
          {volver ? (
            <div className="mb-1">
              <Volver {...volver} />
            </div>
          ) : null}
          <h1 className="text-lg font-semibold tracking-tight">{titulo}</h1>
          {descripcion ? (
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        {acciones}
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
    </>
  );
}
