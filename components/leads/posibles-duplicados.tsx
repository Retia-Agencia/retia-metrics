"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmarCorreoAccion, separarCorreoAccion, type ResultadoLeads } from "@/app/(app)/p/[programa]/leads/acciones";
import { enlaceConVuelta } from "@/lib/navegacion/volver";

/**
 * Los posibles duplicados de la tab Leads (ticket 072, ADR 0035): correos que entraron por un
 * teléfono conocido y nadie confirmó. **Confirmar** dice "es la misma persona"; **Separar** crea
 * un lead nuevo con ese correo y sus envíos. Separar pide una segunda confirmación en la misma
 * fila (sin diálogos del navegador).
 *
 * `puedeGestionar` (por fila) es PROYECCIÓN: solo el dueño del deal abierto del lead o quien
 * administra decide (186, ADR 0075); la reja de verdad vive en las server actions.
 * Funciona a 390px: la fila apila su info y los botones envuelven.
 */

export interface DuplicadoVista {
  contactoId: string;
  leadId: string;
  nombreLead: string | null;
  correoPrincipal: string;
  correoSinConfirmar: string;
  /** Solo el dueño del deal abierto o quien administra decide (186). La reja real está en la acción. */
  puedeGestionar: boolean;
}

export function PosiblesDuplicados({
  filas,
  total,
  slug,
  origen,
  verTodosHref,
  paginacion,
}: {
  filas: DuplicadoVista[];
  /** El total del programa (o del closer), para el encabezado y la paginación. */
  total: number;
  /** El programa de la tab: la ficha del lead vive dentro de el (ticket 073). */
  slug: string;
  /** Vuelta a la pantalla que abrió la ficha; ausente conserva el enlace histórico. */
  origen?: string;
  /** Mi espacio muestra 5 y enlaza a la lista completa de Leads (186). */
  verTodosHref?: string;
  /** Leads pagina de a 25 en el servidor (186); ausente no muestra navegación. */
  paginacion?: { pagina: number; paginas: number; hrefDePagina: (p: number) => string };
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [porSeparar, setPorSeparar] = useState<string | null>(null);

  function correr(accion: () => Promise<ResultadoLeads>, exito: string) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(exito);
        setPorSeparar(null);
        router.refresh();
      } else {
        toast.error(r.error, r.dealId ? {
          duration: 8000,
          action: {
            label: "Abrir deal",
            onClick: () => router.push(`/p/${slug}/deals/${r.dealId}`),
          },
        } : undefined);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Posibles duplicados · <span className="cifra">{total}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Correos que llegaron con el teléfono de otro lead. Confirma si es la misma persona o sepáralos si son dos.
        </p>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay correos por revisar en este programa.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filas.map((f) => (
              <li key={f.contactoId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0 space-y-1">
                  <Link
                    href={enlaceConVuelta(`/p/${slug}/leads/${f.leadId}`, origen ?? "")}
                    className="block truncate font-medium text-marca-texto underline-offset-2 outline-none hover:underline focus-visible:underline"
                  >
                    {f.nombreLead ?? f.correoPrincipal}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{f.correoPrincipal}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="alerta">Sin confirmar</Badge>
                    <span className="truncate text-xs">{f.correoSinConfirmar}</span>
                  </div>
                </div>
                {f.puedeGestionar ? (
                  porSeparar === f.contactoId ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">¿Crear un lead aparte con este correo?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pendiente}
                        onClick={() => correr(() => separarCorreoAccion({ contactoId: f.contactoId }), "Correo separado en un lead nuevo.")}
                      >
                        Sí, separar
                      </Button>
                      <Button size="sm" variant="outline" disabled={pendiente} onClick={() => setPorSeparar(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pendiente}
                        onClick={() => correr(() => confirmarCorreoAccion({ contactoId: f.contactoId }), "Correo confirmado.")}
                      >
                        Es la misma persona
                      </Button>
                      <Button size="sm" variant="outline" disabled={pendiente} onClick={() => setPorSeparar(f.contactoId)}>
                        Separar
                      </Button>
                    </div>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {verTodosHref && total > filas.length ? (
          <div className="pt-3 text-sm">
            <Link href={verTodosHref} className="text-marca-texto underline-offset-2 hover:underline">
              Ver todos
            </Link>
          </div>
        ) : null}
        {paginacion && paginacion.paginas > 1 ? (
          <nav className="flex items-center justify-between pt-3 text-sm" aria-label="Páginas de posibles duplicados">
            {paginacion.pagina > 0 ? (
              <Link href={paginacion.hrefDePagina(paginacion.pagina - 1)} className="text-marca-texto underline-offset-2 hover:underline">
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">
              Página <span className="cifra">{paginacion.pagina + 1}</span> de <span className="cifra">{paginacion.paginas}</span>
            </span>
            {paginacion.pagina + 1 < paginacion.paginas ? (
              <Link href={paginacion.hrefDePagina(paginacion.pagina + 1)} className="text-marca-texto underline-offset-2 hover:underline">
                Siguiente
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </CardContent>
    </Card>
  );
}
