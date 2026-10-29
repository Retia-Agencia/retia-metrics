"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ResultadoAccion } from "@/app/(app)/media/acciones";

/** Piezas comunes de los pop-ups de media: marco, campo con etiqueta, link con su desglose y la accion con aviso. */

export const campoSelect = "h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Vive abierto mientras esta montado: el padre lo monta al abrir, asi el formulario arranca limpio. */
export function DialogoDeMedia({
  titulo,
  descripcion,
  onCerrar,
  children,
}: {
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-w-0 space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function Etiqueta({ texto, ayuda, children }: { texto: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-muted-foreground">{texto}</span>
      {children}
      {ayuda ? <span className="block text-xs text-muted-foreground">{ayuda}</span> : null}
    </label>
  );
}

export function copiar(url: string) {
  navigator.clipboard.writeText(url).then(
    () => toast.success("Link copiado"),
    () => toast.error("No se pudo copiar el link"),
  );
}

/** Corre una server action con aviso de exito o error y refresca la pagina. */
export function useAccionDeMedia() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  function correr(accion: () => Promise<ResultadoAccion>, ok: string, despues?: (r: ResultadoAccion & { ok: true }) => void) {
    empezar(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(ok);
        despues?.(r);
        router.refresh();
      } else toast.error(r.error);
    });
  }
  return { pendiente, correr };
}

/** El link con su boton de copiar y, debajo, cada parametro del UTM con un nombre que se entiende (`desglose` lo arma el servidor). */
export function BloqueDeLink({ url, desglose }: { url: string; desglose: { nombre: string; valor: string }[] }) {
  return (
    <div className="space-y-2">
      <p className="break-all rounded-lg border bg-muted/40 p-2 font-mono text-xs">{url}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {desglose.map((d) => (
          <div key={d.nombre} className="contents">
            <dt className="text-muted-foreground">{d.nombre}</dt>
            <dd className="break-all font-mono">{d.valor}</dd>
          </div>
        ))}
      </dl>
      <Button type="button" size="sm" variant="outline" onClick={() => copiar(url)}>Copiar link</Button>
    </div>
  );
}
