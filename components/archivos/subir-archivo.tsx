"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { comprimirComprobante } from "@/lib/archivos/comprimir";
import type { TipoPermitido } from "@/lib/archivos/reglas";

type ResultadoDeSubida =
  | { ok: true; archivoId: string; subida: { url: string; metodo: "PUT"; cabeceras: Record<string, string> } }
  | { ok: false; error: string };

export function SubirArchivo({
  pedirSubida,
  alSubir,
}: {
  pedirSubida(meta: { tipoMime: TipoPermitido; bytes: number }): Promise<ResultadoDeSubida>;
  alSubir(archivoId: string): void | Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"listo" | "preparando" | "subiendo" | "confirmando">("listo");
  const ocupado = estado !== "listo";

  async function seleccionar(archivo: File | undefined) {
    if (!archivo) return;
    try {
      setEstado("preparando");
      const preparado = await comprimirComprobante(archivo);
      const solicitud = await pedirSubida({ tipoMime: preparado.type as TipoPermitido, bytes: preparado.size });
      if (!solicitud.ok) throw new Error(solicitud.error);

      setEstado("subiendo");
      const respuesta = await fetch(solicitud.subida.url, {
        method: "PUT",
        headers: solicitud.subida.cabeceras,
        body: preparado,
      });
      if (!respuesta.ok) throw new Error("No se pudo subir el archivo.");

      setEstado("confirmando");
      await alSubir(solicitud.archivoId);
      toast.success("Comprobante guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir el comprobante.");
    } finally {
      setEstado("listo");
      if (input.current) input.current.value = "";
    }
  }

  const texto = estado === "preparando"
    ? "Preparando…"
    : estado === "subiendo"
      ? "Subiendo…"
      : estado === "confirmando"
        ? "Confirmando…"
        : "Elegir archivo";

  return (
    <div className="space-y-2">
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        disabled={ocupado}
        onChange={(evento) => void seleccionar(evento.target.files?.[0])}
      />
      <Button type="button" onClick={() => input.current?.click()} disabled={ocupado}>
        {texto}
      </Button>
      <p className="text-xs text-muted-foreground">Imagen o PDF, máximo 5 MB.</p>
    </div>
  );
}
