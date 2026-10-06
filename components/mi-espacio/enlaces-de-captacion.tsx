"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Los enlaces de captacion del closer (ticket 086, ADR 0044 punto 1): uno por programa,
 * con su boton Copiar. Llegan ya armados del servidor (`enlacesDeCaptacion`); aqui no se
 * calcula nada, y nada se guarda.
 */
export type EnlaceVista =
  | { programId: string; programa: string; ok: true; url: string; formulario: string }
  | { programId: string; programa: string; ok: false; error: string };

export function EnlacesDeCaptacion({ enlaces }: { enlaces: EnlaceVista[] }) {
  if (enlaces.length === 0) return null;

  function copiar(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Enlace copiado"),
      () => toast.error("No se pudo copiar el enlace"),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tus enlaces de captación</CardTitle>
        <p className="text-sm text-muted-foreground">
          Si invitas a alguien, mándale tu enlace: llena el formulario y el CRM registra que lo trajiste tú. No lo
          hace tuyo; el deal se reclama en el Inbox como cualquier otro.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border">
          {enlaces.map((e) => (
            <li key={e.programId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{e.programa}</span>
                {e.ok ? (
                  <span className="block truncate text-xs text-muted-foreground" title={e.url}>
                    {e.url}
                  </span>
                ) : (
                  <span className="block text-xs text-muted-foreground">{e.error}</span>
                )}
              </span>
              {e.ok ? (
                <Button type="button" size="sm" variant="outline" onClick={() => copiar(e.url)}>
                  Copiar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
