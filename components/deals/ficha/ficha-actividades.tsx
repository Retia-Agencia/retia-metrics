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
import { ID_DE_SECCION, useAccionPedida } from "./accion-pedida";

/**
 * Las actividades del deal (ticket 074, ADR 0037): contactos y notas, con canal, autor y
 * fecha. Reemplazan las cinco columnas `Registro 1-5` de la hoja.
 *
 * Un contacto o un intento sobre un deal en Potencial o Registrado lo pasan a En gestión, y
 * un contacto lo pasa además a Contactado (ADR 0071 puntos 1 y 2); lo mueve
 * `registrarActividad`, no esta pantalla. Una nota nunca mueve. El canal es texto libre (no
 * catalogo): el `datalist` sugiere WhatsApp, Llamada y Correo, y deja escribir otro.
 */
type TipoDeActividad = "contacto" | "intento" | "nota";

const TIPOS: { value: TipoDeActividad; label: string }[] = [
  { value: "contacto", label: "Contacto" },
  { value: "intento", label: "Intento sin respuesta" },
  { value: "nota", label: "Nota" },
];

const ETIQUETA_DE_TIPO: Record<TipoDeActividad, string> = { contacto: "Contacto", intento: "Intento", nota: "Nota" };
const EXITO: Record<TipoDeActividad, string> = {
  contacto: "Contacto registrado.",
  intento: "Intento registrado.",
  nota: "Nota guardada.",
};

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
  const [tipo, setTipo] = useState<TipoDeActividad>("contacto");
  const [canal, setCanal] = useState("");
  const [nota, setNota] = useState("");
  // La pregunta de la etapa ("¿Se logró el contacto?") llega aquí con el tipo ya elegido.
  useAccionPedida(["contacto", "intento"], (accion) => setTipo(accion === "intento" ? "intento" : "contacto"));

  return (
    <Card id={ID_DE_SECCION.actividades} className="scroll-mt-24">
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
                exito: EXITO[tipo],
                alExito: () => {
                  setNota("");
                  setCanal("");
                },
              });
            }}
          >
            <Campo etiqueta="Tipo">
              <Select value={tipo} items={TIPOS} onValueChange={(v: string | null) => v && setTipo(v as TipoDeActividad)}>
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
                <Badge variant={a.tipo === "contacto" ? "info" : "neutro"}>{ETIQUETA_DE_TIPO[a.tipo]}</Badge>
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
