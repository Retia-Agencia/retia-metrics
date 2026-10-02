"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FichaDeDeal } from "@/lib/queries/ficha-deal";
import { Dato, Vacio } from "./campos";

export function FichaLead({ ficha }: { ficha: FichaDeDeal }) {
  const { lead } = ficha;
  async function copiar(valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      toast.success("Contacto copiado");
    } catch {
      toast.error("No se pudo copiar el contacto");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead y contactos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Dato etiqueta="Nombre">{lead.nombre}</Dato>
          <Dato etiqueta="Correo">{lead.email}</Dato>
          <Dato etiqueta="Teléfono">{lead.telefono}</Dato>
          <Dato etiqueta="Empresa · cargo">{[lead.empresa, lead.cargo].filter(Boolean).join(" · ") || null}</Dato>
          <Dato etiqueta="Ubicación">{[lead.ciudad, lead.pais].filter(Boolean).join(", ") || null}</Dato>
        </dl>
        {ficha.contactos.length === 0 ? (
          <Vacio>Este lead no tiene contactos adicionales.</Vacio>
        ) : (
          <ul className="divide-y">
            {ficha.contactos.map((contacto) => (
              <li key={contacto.id} className="flex min-w-0 flex-wrap items-center gap-2 py-3 first:pt-0 last:pb-0">
                <span className="text-xs text-muted-foreground">{contacto.tipo === "correo" ? "Correo" : "Teléfono"}</span>
                <span className="min-w-0 flex-1 break-words text-sm" title={contacto.valor}>{contacto.valor}</span>
                {contacto.esPrincipal ? <Badge variant="neutro">Principal</Badge> : null}
                {!contacto.confirmado ? <Badge variant="alerta">Sin confirmar</Badge> : null}
                <Button size="xs" variant="ghost" onClick={() => copiar(contacto.valor)} aria-label={`Copiar ${contacto.valor}`}>
                  Copiar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
