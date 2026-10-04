"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { AlertasDelDeal } from "@/lib/queries/ficha-deal";
import {
  confirmarCorreoDesdeDealAccion,
  separarCorreoDesdeDealAccion,
  type ResultadoFicha,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
function Franja({ titulo, tono, filas }: {
  titulo: "Urgente" | "Alertas";
  tono: "peligro" | "alerta";
  filas: AlertasDelDeal["urgentes"];
}) {
  if (filas.length === 0) return null;
  return (
    <Card className={tono === "peligro" ? "border-l-4 border-tono-peligro" : "border-l-4 border-tono-alerta"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{titulo} <Badge variant={tono}>{filas.length}</Badge></CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {filas.map((fila) => <li key={fila.motivo}>{fila.mensaje}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}

function PosibleDuplicado({
  duplicado,
  programaSlug,
  puedeGestionar,
}: {
  duplicado: AlertasDelDeal["posiblesDuplicados"][number];
  programaSlug: string;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  function correr(accion: () => Promise<ResultadoFicha>, exito: string) {
    iniciar(async () => {
      const resultado = await accion();
      if (resultado.ok) {
        toast.success(exito);
        router.refresh();
        return;
      }
      toast.error(resultado.error, resultado.dealId ? {
        duration: 8000,
        action: {
          label: "Abrir deal",
          onClick: () => router.push(`/p/${programaSlug}/deals/${resultado.dealId}`),
        },
      } : { duration: 6000 });
    });
  }

  return (
    <Card className="border-l-4 border-tono-alerta">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Posible duplicado <Badge variant="alerta">Por decidir</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 rounded-lg bg-tono-alerta-suave p-3 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Correo principal</dt>
            <dd className="break-all font-medium">{duplicado.correoPrincipal}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Correo nuevo</dt>
            <dd className="break-all font-medium">{duplicado.correoSinConfirmar}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Teléfono en común</dt>
            <dd>{duplicado.telefonoEnComun ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Envío que lo trajo</dt>
            <dd>
              {duplicado.envio
                ? `${duplicado.envio.fuente ?? "Formulario"} · ${fechaHoraEnBogota(duplicado.envio.fecha)}`
                : "No se encontró el envío"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          “Es la misma persona” conserva este lead y este deal. “Son dos personas” mueve el correo y sus envíos a un lead nuevo y abre su propio deal.
        </p>
        {puedeGestionar ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pendiente}
              onClick={() => correr(
                () => confirmarCorreoDesdeDealAccion({ contactoId: duplicado.contactoId }),
                "Correo confirmado: es la misma persona.",
              )}
            >
              Es la misma persona
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pendiente}
              onClick={() => correr(
                () => separarCorreoDesdeDealAccion({ contactoId: duplicado.contactoId }),
                "Correo separado: la otra persona ya tiene su propio deal.",
              )}
            >
              Son dos personas
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FichaAlertas({
  alertas,
  programaSlug,
  puedeGestionar,
}: {
  alertas: AlertasDelDeal | null;
  programaSlug: string;
  puedeGestionar: boolean;
}) {
  if (!alertas) return null;
  return (
    <>
      {alertas.posiblesDuplicados.map((duplicado) => (
        <PosibleDuplicado
          key={duplicado.contactoId}
          duplicado={duplicado}
          programaSlug={programaSlug}
          puedeGestionar={puedeGestionar}
        />
      ))}
      <Franja titulo="Urgente" tono="peligro" filas={alertas.urgentes} />
      <Franja titulo="Alertas" tono="alerta" filas={alertas.alertas} />
    </>
  );
}
