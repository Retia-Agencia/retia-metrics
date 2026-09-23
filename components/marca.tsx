import { cn } from "@/lib/utils";

/**
 * La firma de la app: un cuadro verde de marca con la "R" en tinta, y el nombre. Vive
 * sola porque la usan el marco (la barra lateral) y el login, y tiene que ser la misma
 * en los dos (docs/design-system.md).
 */
export function Marca({ className, subtitulo }: { className?: string; subtitulo?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md bg-marca text-[13px] font-bold text-sidebar"
      >
        R
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight">Retia CRM</span>
        {subtitulo ? <span className="text-xs text-muted-foreground">{subtitulo}</span> : null}
      </span>
    </span>
  );
}
