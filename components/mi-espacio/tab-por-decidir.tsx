import Link from "next/link";
import { db } from "@/lib/db";
import { seccionesSinDueno } from "@/lib/queries/inbox-sin-dueno";
import { llamadasSinCloserDelPrograma, llamadasSueltasDelPrograma } from "@/lib/queries/inbox";
import { saludDeFuentes } from "@/lib/queries/salud-fuentes";
import { num } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Sección "Por decidir" de Mi espacio del gerente (ticket 179, rediseño del 183/ADR 0077):
 * la operación del CRM que le toca mirar a quien administra sin trabajar leads, acotada al
 * programa del selector.
 *
 * **Agregado y urgente, NO un registro** (ADR 0077): "Mi espacio" no duplica una pestaña que
 * ya tiene su pantalla dedicada. Cada frente que ya vive en el Inbox del programa (Agendados
 * sin dueño, Por settear, Llamadas sueltas, Hosts sin cuenta) se muestra aquí como un
 * CONTADOR con un enlace a esa pestaña —nunca la lista, ni reasignar, ni colgar inline—; y
 * Webhook Health como UN semáforo que enlaza a Ajustes → Webhook Health, no el detalle por
 * fuente (que vive entero en `/ajustes/salud`). Un conteo en cero se silencia (tono neutro,
 * sin enlace de acción), igual que las secciones vacías de `tab-atencion.tsx`.
 *
 * El programa es FRONTERA (ADR 0043): todo entra por `programId`/`slug` y jamás cruza. Es un
 * componente de servidor que reusa los módulos de consulta del Inbox (una respuesta por
 * pregunta), tomando sus conteos; no copia SQL. Y **no monta ningún Base UI Select / Dialog /
 * Menu**: al quitar la reasignación inline y la lista de sueltas desaparece el popup que
 * reventaba la pantalla del gerente en tiempo de ejecución (composición estricta de Base UI).
 */
export async function TabPorDecidir({
  programId,
  slug,
}: {
  programId: string;
  slug: string;
}) {
  const [secciones, llamadasSueltas, llamadasSinCloser, salud] = await Promise.all([
    seccionesSinDueno(db, programId),
    llamadasSueltasDelPrograma(db, programId),
    llamadasSinCloserDelPrograma(db, programId),
    saludDeFuentes(),
  ]);

  const inbox = `/p/${slug}/inbox`;
  const contadores: Contador[] = [
    {
      n: secciones.unclaimed.length,
      etiqueta: (n) => `${n} ${n === 1 ? "agendado sin dueño" : "agendados sin dueño"}`,
      vacio: "Sin agendados sin dueño",
      href: `${inbox}?seccion=agendados-sin-dueno`,
      tono: "alerta",
    },
    {
      n: secciones.pendienteSetteo.length,
      etiqueta: (n) => `${n} ${n === 1 ? "deal por settear" : "deals por settear"}`,
      vacio: "Sin deals por settear",
      href: `${inbox}?seccion=por-settear`,
      tono: "info",
    },
    {
      n: llamadasSueltas.length,
      etiqueta: (n) => `${n} ${n === 1 ? "llamada suelta" : "llamadas sueltas"}`,
      vacio: "Sin llamadas sueltas",
      href: `${inbox}?seccion=sin-deal`,
      tono: "alerta",
    },
    {
      n: llamadasSinCloser.length,
      etiqueta: (n) => `${n} ${n === 1 ? "host sin cuenta" : "hosts sin cuenta"}`,
      vacio: "Sin hosts sin cuenta",
      href: inbox,
      tono: "peligro",
    },
  ];

  // Solo las fuentes del programa elegido (frontera) con alarma (ticket 107). Una fuente
  // `muerta` sube el semáforo a peligro; cualquier otra alarma es alerta.
  const alarmas = salud.filter((s) => s.programId === programId && s.marcada);
  const hayMuerta = alarmas.some((s) => s.estado === "muerta");

  return (
    <div className="space-y-4">
      {/* 1 · Operación del programa: contadores con enlace al Inbox (ADR 0077). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operación del programa</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {contadores.map((c) =>
              c.n === 0 ? (
                // Conteo en cero: silenciado a tono neutro y sin enlace (igual que una
                // sección vacía de `tab-atencion.tsx`).
                <li key={c.href + c.vacio} className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="neutro">0</Badge>
                  <span>{c.vacio}</span>
                </li>
              ) : (
                // Con n > 0: enlace a la pestaña del Inbox, con su tono.
                <li key={c.href + c.vacio}>
                  <Link href={c.href} className="group flex items-center gap-2 underline-offset-2 hover:underline">
                    <Badge variant={c.tono}>{num(c.n)}</Badge>
                    <span className="font-medium">{c.etiqueta(c.n)}</span>
                    <span aria-hidden className="text-muted-foreground">&rarr;</span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </CardContent>
      </Card>

      {/* 2 · Webhook Health: un semáforo, sin detalle por fuente (vive en /ajustes/salud). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Health</CardTitle>
        </CardHeader>
        <CardContent>
          {alarmas.length === 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="exito">Al día</Badge>
              <span className="text-muted-foreground">Webhooks al día</span>
            </div>
          ) : (
            <Link
              href={`/ajustes/salud?programa=${slug}`}
              className="group flex items-center gap-2 text-sm underline-offset-2 hover:underline"
            >
              <Badge variant={hayMuerta ? "peligro" : "alerta"}>{num(alarmas.length)}</Badge>
              <span className="font-medium">
                {alarmas.length === 1 ? "1 fuente con alarma" : `${num(alarmas.length)} fuentes con alarma`}
              </span>
              <span aria-hidden className="text-muted-foreground">&rarr;</span>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type Contador = {
  n: number;
  etiqueta: (n: number) => string;
  vacio: string;
  href: string;
  tono: "info" | "alerta" | "peligro";
};
