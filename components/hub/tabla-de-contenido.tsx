/**
 * La tabla de contenido horizontal de una página del Hub (Mani, 4-nov): una fila de anclas, no vertical,
 * y cada una lleva a su sección dentro de la misma página. Solo enlaces nativos: no necesita estado.
 */
export function TablaDeContenido({ secciones }: { secciones: { id: string; titulo: string }[] }) {
  return (
    <nav aria-label="En esta página" className="flex flex-wrap items-center gap-1.5 text-xs print:hidden">
      <span className="text-muted-foreground">Ir a:</span>
      {secciones.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {s.titulo}
        </a>
      ))}
    </nav>
  );
}
