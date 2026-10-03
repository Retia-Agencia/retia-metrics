"use client";

import { forwardRef, useRef, useState } from "react";
import { pegarGrainAccion } from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Campo, claseInput } from "./campos";
import { useAccion } from "./uso-accion";

/**
 * El Link de Grain como campo siempre visible (ticket 176, decisión 3): guarda al pegar o
 * al salir del campo. Pegarlo sin resultado marca la llamada como show y pasa el deal a
 * Atendido (ADR 0058), por `pegarGrainAccion`, la misma server action de siempre. No se
 * guarda si el valor no cambió, para no mover la etapa al salir del campo por nada.
 *
 * Reenvía el `ref` del input para que el botón "Show" del menú "Resultado" ponga el foco
 * aquí en vez de abrir un sub-flujo.
 */
export const CampoGrain = forwardRef<HTMLInputElement, { callId: string; valor: string | null }>(
  function CampoGrain({ callId, valor }, ref) {
    const { pendiente, correr } = useAccion();
    const [link, setLink] = useState(valor ?? "");
    const guardado = useRef((valor ?? "").trim());

    function guardar(texto: string) {
      const limpio = texto.trim();
      if (limpio === "" || limpio === guardado.current) return;
      guardado.current = limpio;
      correr(() => pegarGrainAccion({ callId, linkGrain: limpio }), {
        exito: (r) => (r.movioAAtendido ? "Grain guardado: el deal pasó a Atendido." : "Grain guardado."),
      });
    }

    return (
      <Campo etiqueta="Link de Grain" ayuda="Al pegarlo, la llamada queda como show y el deal pasa a Atendido.">
        <input
          ref={ref}
          type="url"
          className={claseInput}
          value={link}
          disabled={pendiente}
          placeholder="https://grain.com/…"
          onChange={(e) => setLink(e.target.value)}
          onBlur={(e) => guardar(e.target.value)}
          onPaste={(e) => {
            const pegado = e.clipboardData.getData("text");
            if (pegado.trim() !== "") {
              setLink(pegado);
              guardar(pegado);
            }
          }}
        />
      </Campo>
    );
  },
);
