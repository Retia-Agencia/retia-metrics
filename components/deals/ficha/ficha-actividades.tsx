"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fechaHoraEnBogota } from "@/lib/format";
import type { FichaDeActividad } from "@/lib/queries/ficha-deal";
import { registrarActividadAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput, claseTextarea, Vacio } from "./campos";
import { useAccion } from "./uso-accion";

/**
 * Las actividades del deal (ticket 074, ADR 0037): contactos y notas, con canal, autor y
 * fecha. Reemplazan las cinco columnas `Registro 1-5` de la hoja.
 *
 * Registrar un contacto NO mueve la etapa. El canal es texto libre (no catalogo): el
 * `datalist` sugiere WhatsApp, Llamada y Correo, y deja escribir otro.
 */
const TIPOS = [
  { value: "contacto", label: "Contacto" },
  { value: "nota", label: "Nota" },
];

export function FichaActividades({
  actividades,
  dealId,
  puedeRegistrar,
}: {
  actividades: FichaDeActividad[];
  dealId: string;
  /** Su dueño o quien administra; sobre un deal anulado nadie. Proyeccion: la reja es el servidor. */
  puedeRegistrar: boolean;
}) {
  const { pendiente, correr } = useAccion();
  const [tipo, setTipo] = useState<"contacto" | "nota">("contacto");
  const [canal, setCanal] = useState("");
  const [nota, setNota] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividades</CardTitle>
      </CardHeader>

      {puedeRegistrar ? (
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              correr(() => registrarActividadAccion({ dealId, tipo, canal, nota }), {
                exito: tipo === "contacto" ? "Contacto registrado." : "Nota guardada.",
                alExito: () => {
                  setNota("");
                  setCanal("");
                },
              });
            }}
          >
            <Campo etiqueta="Tipo">
              <Select value={tipo} items={TIPOS} onValueChange={(v: string | null) => v && setTipo(v as "contacto" | "nota")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo etiqueta="Canal">
              <input
                className={claseInput}
                list="canales-de-contacto"
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
                placeholder="WhatsApp, Llamada…"
                maxLength={60}
              />
              <datalist id="canales-de-contacto">
                <option value="WhatsApp" />
                <option value="Llamada" />
                <option value="Correo" />
              </datalist>
            </Campo>
            {/* La tarjeta vive en media columna: el texto va a lo ancho, no en una columna del grid. */}
            <div className="sm:col-span-2">
              <Campo etiqueta="¿Qué pasó?">
                <textarea
                  className={claseTextarea}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={2}
                  placeholder="Le escribí, quedó de responder el jueves…"
                />
              </Campo>
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={pendiente || nota.trim() === ""}>
                {pendiente ? "Guardando…" : "Registrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      ) : null}

      {actividades.length === 0 ? (
        <Vacio>
          Aún no hay contactos ni notas.{puedeRegistrar ? " Registra el primero arriba." : ""}
        </Vacio>
      ) : (
        <ul className="divide-y">
          {actividades.map((a) => (
            <li key={a.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={a.tipo === "contacto" ? "info" : "neutro"}>{a.tipo === "contacto" ? "Contacto" : "Nota"}</Badge>
                {a.canal ? <span className="text-xs text-muted-foreground">{a.canal}</span> : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {a.autorNombre ?? "Sistema"} · {fechaHoraEnBogota(a.fecha)}
                </span>
              </div>
              {a.nota ? <p className="whitespace-pre-wrap">{a.nota}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
