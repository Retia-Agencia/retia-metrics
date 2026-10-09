"use client";

import { CampoGrain } from "./campo-grain";

/** Las llamadas son historial; aquí solo se corrige el Grain ya registrado. */
export function AccionesDeLlamada({
  callId,
  linkGrain,
  resultado,
}: {
  callId: string;
  dealId: string | null;
  linkGrain: string | null;
  resultado: string;
  motivosReagenda: unknown[];
  abrirInicial?: "resultado" | null;
}) {
  if (resultado !== "show" && !linkGrain) return null;
  return <CampoGrain callId={callId} valor={linkGrain} yaEsShow />;
}
