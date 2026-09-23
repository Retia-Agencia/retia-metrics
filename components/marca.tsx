import { cn } from "@/lib/utils";

/**
 * La firma de la app: un cuadro de marca con la "R", y el nombre. Morado con la "R"
 * blanca sobre fondo claro; lila con la "R" negra dentro del marco o en oscuro. Vive
 * sola porque la usan el marco (la barra lateral) y el login, y tiene que ser la misma
 * en los dos (docs/design-system.md).
 */
export function Marca({ className, subtitulo }: { className?: string; subtitulo?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground"
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
