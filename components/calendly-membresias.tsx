"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CuentasDelPrograma } from "@/lib/calendly/cuentas";
import type { MembresiaConCalendly } from "@/lib/catalogo/usuarios";
import { asignarCalendlyDeMembresiaAccion } from "@/app/(app)/ajustes/usuarios/acciones";

/**
 * La cuenta de Calendly de cada closer, por programa (ticket 096). Solo administrador.
 *
 * Nadie escribe un correo: cada programa ofrece las cuentas de SU organizacion de
 * Calendly, leidas con su token. La cuenta cuyo correo es el mismo del login viene
 * preseleccionada como sugerencia, pero no se guarda hasta que alguien la confirma. El
 * servidor vuelve a comprobar contra Calendly antes de guardar.
 */

const SIN_CUENTA = "";

export function CalendlyMembresias({
  membresias,
  programas,
  cuentas,
}: {
  membresias: MembresiaConCalendly[];
  programas: { id: string; nombre: string }[];
  cuentas: Record<string, CuentasDelPrograma>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cuentas de Calendly por programa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Con esta cuenta se sabe qué closer hospeda cada cita, y la closer que la hospeda se queda el deal.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {programas.map((p) => {
          const deEste = membresias.filter((m) => m.programId === p.id);
          if (deEste.length === 0) return null;
          const lista = cuentas[p.id];
          return (
            <section key={p.id} className="space-y-2">
              <h3 className="text-sm font-medium">{p.nombre}</h3>
              {lista && !lista.ok ? (
                <p className="text-xs text-destructive">No se pudieron leer las cuentas: {lista.error}</p>
              ) : null}
              <ul className="divide-y rounded-md border">
                {deEste.map((m) => (
                  <FilaMembresia key={m.id} membresia={m} cuentas={lista?.ok ? lista.cuentas : null} />
                ))}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FilaMembresia({
  membresia,
  cuentas,
}: {
  membresia: MembresiaConCalendly;
  cuentas: { nombre: string | null; correo: string }[] | null;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const guardada = membresia.calendlyEmail;
  const sugerida =
    guardada === null
      ? (cuentas?.find((c) => c.correo === membresia.emailUsuario.toLowerCase())?.correo ?? null)
      : null;
  const [valor, setValor] = useState(guardada ?? sugerida ?? SIN_CUENTA);

  // La guardada puede ya no estar en Calendly (alguien salio de la organizacion): se
  // muestra igual, marcada, para que se vea y se pueda cambiar.
  const opciones = [...(cuentas ?? [])];
  const guardadaHuerfana = guardada !== null && !opciones.some((c) => c.correo === guardada);
  const cambio = (valor === SIN_CUENTA ? null : valor) !== guardada;

  function guardar() {
    startTransition(async () => {
      const res = await asignarCalendlyDeMembresiaAccion({
        membresiaId: membresia.id,
        calendlyEmail: valor === SIN_CUENTA ? null : valor,
      });
      if (res.ok) {
        toast.success("Cuenta de Calendly guardada");
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: res.error });
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium">{membresia.usuario}</span>
        <span className="block truncate text-xs text-muted-foreground">{membresia.emailUsuario}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {sugerida && valor === sugerida ? <Badge variant="outline">sugerida</Badge> : null}
        <select
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          disabled={pendiente || (cuentas === null && !guardada)}
          aria-label={`Cuenta de Calendly de ${membresia.usuario}`}
          className="h-8 max-w-64 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value={SIN_CUENTA}>Sin cuenta</option>
          {guardadaHuerfana ? <option value={guardada}>{guardada} (ya no está en Calendly)</option> : null}
          {opciones.map((c) => (
            <option key={c.correo} value={c.correo}>
              {c.nombre ? `${c.nombre} · ${c.correo}` : c.correo}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={pendiente || !cambio} onClick={guardar}>
          Guardar
        </Button>
      </span>
    </li>
  );
}
