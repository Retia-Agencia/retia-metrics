import type { ReactNode } from "react";

type Props = {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
};

export function PageShell({ titulo, descripcion, acciones, children }: Props) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{titulo}</h1>
          {descripcion ? (
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        {acciones}
      </header>
      <main className="flex-1 p-6">{children}</main>
    </>
  );
}
