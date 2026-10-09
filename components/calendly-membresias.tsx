"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CuentaDeCalendly, CuentasDelPrograma } from "@/lib/calendly/cuentas";
import type { EntradaCalendlyDeMembresia, MembresiaConCalendly } from "@/lib/catalogo/usuarios";
import { trabajaLeads } from "@/lib/auth/roles";

/**
 * La cuenta de Calendly de cada closer, por programa. La usan `/ajustes/usuarios` y
 * `/perfil` para el dueño de la membresía (ADR 0074).
 *
 * Nadie escribe un correo: cada programa ofrece las cuentas de SU organizacion de
 * Calendly, leidas con su token. La cuenta cuyo correo es el mismo del login viene
 * aparece primero. El servidor vuelve a comprobar contra Calendly antes de guardar.
 */

const SIN_CUENTA = "";
const SIN_SETTER = "ninguno";

export function SetterPorDefecto({
  programId,
  membresias,
  accion,
}: {
  programId: string;
  membresias: MembresiaConCalendly[];
  accion: (input: { programId: string; userId: string | null }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const actual = membresias.find((m) => m.setterPorDefecto)?.userId ?? SIN_SETTER;
  const [valor, setValor] = useState(actual);
  const elegibles = membresias.filter((m) => trabajaLeads(m.rol));

  function guardar(nuevo: string | null) {
    if (!nuevo) return;
    const anterior = valor;
    setValor(nuevo);
    startTransition(async () => {
      const resultado = await accion({ programId, userId: nuevo === SIN_SETTER ? null : nuevo });
      if (!resultado.ok) {
        setValor(anterior);
        toast.error("No se pudo guardar", { description: resultado.error });
        return;
      }
      toast.success("Setter por defecto guardado");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-border p-3">
      <div>
        <p className="text-sm font-medium">Setter por defecto</p>
        <p className="text-xs text-muted-foreground">Recibe los deals nuevos que llegan sin agenda.</p>
      </div>
      <span className="flex items-center gap-2">
        {valor === SIN_SETTER ? <Badge variant="neutro">Ninguno</Badge> : <Badge variant="info">Activo</Badge>}
        <Select
          value={valor}
          items={[
            { value: SIN_SETTER, label: "Ninguno" },
            ...elegibles.map((m) => ({ value: m.userId, label: m.usuario })),
          ]}
          onValueChange={guardar}
          disabled={pendiente}
        >
          <SelectTrigger className="w-56" aria-label="Setter por defecto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_SETTER}>Ninguno</SelectItem>
            {elegibles.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>{m.usuario}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    </div>
  );
}

export function CalendlyMembresias({
  membresias,
  programas,
  cuentas,
  accion,
}: {
  membresias: MembresiaConCalendly[];
  programas: { id: string; nombre: string }[];
  cuentas: Record<string, CuentasDelPrograma>;
  accion: (
    input: EntradaCalendlyDeMembresia,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
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
                  <FilaMembresia
                    key={m.id}
                    membresia={m}
                    cuentas={lista?.ok ? lista.cuentas : null}
                    accion={accion}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function FilaMembresia({
  membresia,
  cuentas,
  accion,
  extra,
}: {
  membresia: MembresiaConCalendly;
  cuentas: CuentaDeCalendly[] | null;
  accion: (
    input: EntradaCalendlyDeMembresia,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Contenido opcional al final de la fila (p. ej. el botón Quitar del equipo). */
  extra?: ReactNode;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [guardada, setGuardada] = useState(membresia.calendlyEmail);
  const [valor, setValor] = useState(membresia.calendlyEmail ?? SIN_CUENTA);
  const [error, setError] = useState<string | null>(null);

  // La guardada puede ya no estar en Calendly (alguien salio de la organizacion): se
  // muestra igual, marcada, para que se vea y se pueda cambiar.
  const opciones = (cuentas ?? [])
    .filter((c) => c.membresiaId === null || c.membresiaId === membresia.id)
    .sort((a, b) => {
      const login = membresia.emailUsuario.toLowerCase();
      return Number(b.correo === login) - Number(a.correo === login) || a.correo.localeCompare(b.correo, "es");
    });
  const guardadaHuerfana = guardada !== null && !opciones.some((c) => c.correo === guardada);

  function guardar(nuevoValor: string) {
    const anterior = guardada ?? SIN_CUENTA;
    setValor(nuevoValor);
    setError(null);
    startTransition(async () => {
      const res = await accion({
        membresiaId: membresia.id,
        calendlyEmail: nuevoValor === SIN_CUENTA ? null : nuevoValor,
      });
      if (res.ok) {
        setGuardada(nuevoValor === SIN_CUENTA ? null : nuevoValor);
        toast.success("Cuenta de Calendly guardada");
        router.refresh();
      } else {
        setValor(anterior);
        setError(res.error);
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
        {guardada ? <Badge variant="outline">Conectada</Badge> : null}
        <select
          value={valor}
          onChange={(e) => guardar(e.target.value)}
          disabled={pendiente || (cuentas === null && !guardada)}
          aria-label={`Cuenta de Calendly de ${membresia.usuario}`}
          className="h-8 max-w-64 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value={SIN_CUENTA}>Sin cuenta</option>
          {guardadaHuerfana ? <option value={guardada}>{guardada} (ya no está en Calendly)</option> : null}
          {opciones.map((c) => (
            <option key={c.correo} value={c.correo}>
              {c.correo}
            </option>
          ))}
        </select>
        {error ? <span className="max-w-64 text-xs text-destructive">{error}</span> : null}
        {extra}
      </span>
    </li>
  );
}
