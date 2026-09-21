"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buscarPersonasAccion } from "@/app/(app)/personas/acciones";
import type { PersonaEncontrada } from "@/lib/queries/personas";

/** Mismo estilo de input que `/mi-dia`, para que las dos busquedas se vean igual. */
const CLASE_INPUT =
  "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Buscador de `/personas`: la puerta al historial de un lead (ticket 006).
 *
 * Existe porque el historial no tenia entrada para un gerente (18-sep): el unico
 * enlace a `/personas/[id]` vivia dentro de `/mi-dia`, que es exclusiva de closer
 * (ADR 0003). Esta pantalla es de LECTURA: no toma personas ni registra nada, para
 * eso esta `/mi-dia`. Por eso el buscador es mas simple que el de alla, y no una
 * abstraccion compartida con un booleano de por medio: la consulta y la regla de
 * quien puede buscar SI se comparten (`buscarPersonas` y `buscarPersonasAccion`),
 * que es donde importa que la respuesta sea una sola.
 *
 * El texto NO va a la URL: nombre y correo son datos personales y AGENTS.md lo
 * prohibe. Por eso vive en estado local y viaja en el payload de la server action.
 */
export function PersonasBuscador() {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<PersonaEncontrada[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function buscar() {
    const q = texto.trim();
    if (q.length < 2) {
      setError("Escribe al menos 2 caracteres.");
      return;
    }
    setError(null);
    empezar(async () => {
      const res = await buscarPersonasAccion(q);
      if (res.ok) {
        setResultados(res.personas);
        setBuscado(true);
      } else {
        setError(res.error);
        setResultados([]);
        setBuscado(false);
      }
    });
  }

  return (
    <section className="space-y-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
      >
        <div className="flex-1 space-y-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Nombre o correo
          </label>
          <input
            id="q"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={CLASE_INPUT}
            placeholder="Al menos 2 caracteres"
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={pendiente || texto.trim().length < 2}>
          {pendiente ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ul className="space-y-2">
        {resultados.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{p.nombre ?? p.emailNormalizado}</div>
              <div className="truncate text-sm text-muted-foreground">{p.programaNombre}</div>
            </div>
            {/* La URL lleva el id opaco, NUNCA el correo (ticket 006).
                `nativeButton={false}` porque se renderiza como <a>: sin eso Base UI
                avisa que se pierde la semantica nativa de boton. */}
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/personas/${p.id}`} />}
            >
              Historial
            </Button>
          </li>
        ))}
        {buscado && resultados.length === 0 ? (
          <li className="text-sm text-muted-foreground">Sin resultados.</li>
        ) : null}
      </ul>
    </section>
  );
}
