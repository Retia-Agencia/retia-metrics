import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Estilos de los controles de formulario de la ficha: los mismos del dialogo de mover del Kanban. */
export const claseInput =
  "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export const claseTextarea =
  "min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

/** Una etiqueta con su control y, si hace falta, una linea de ayuda. */
export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-muted-foreground">{etiqueta}</span>
      {children}
      {ayuda ? <span className="block text-xs text-muted-foreground">{ayuda}</span> : null}
    </label>
  );
}

/** Un dato de la cabecera: etiqueta chica y valor; sin valor, un guion. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="truncate text-sm">{children ?? "—"}</dd>
    </div>
  );
}

/** Lo que dice una lista vacia: que falta y como llenarlo (§9, estados vacios escritos). */
export function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/**
 * El marco de los dialogos de la ficha: titulo, descripcion, campos y dos botones. Vive
 * abierto mientras esta montado (el padre lo monta al abrir y lo desmonta al cerrar, asi
 * el formulario arranca limpio cada vez).
 */
export function DialogoForm({
  titulo,
  descripcion,
  pendiente,
  confirmar,
  deshabilitarConfirmar = false,
  peligro = false,
  onCerrar,
  children,
}: {
  titulo: string;
  descripcion?: ReactNode;
  pendiente: boolean;
  confirmar: { texto: string; enCurso: string; onClick: () => void };
  deshabilitarConfirmar?: boolean;
  peligro?: boolean;
  onCerrar: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-w-0 space-y-3">{children}</div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={peligro ? "destructive" : "default"}
            onClick={confirmar.onClick}
            disabled={pendiente || deshabilitarConfirmar}
          >
            {pendiente ? confirmar.enCurso : confirmar.texto}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
