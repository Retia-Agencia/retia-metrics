/**
 * La tabla de contenido horizontal de una página del Hub (Mani, 4-nov): una fila de anclas que en pantallas angostas se desplaza de lado, no vertical,
 * y cada una lleva a su sección dentro de la misma página. Solo enlaces nativos: no necesita estado.
 */
export function TablaDeContenido({ secciones }: { secciones: { id: string; titulo: string }[] }) {
  return (
    <nav aria-label="En esta página" className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs print:hidden">
      <span className="shrink-0 text-muted-foreground">Ir a:</span>
      {secciones.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {s.titulo}
        </a>
      ))}
    </nav>
  );
}
