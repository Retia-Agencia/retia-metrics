"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import { cargarMasEntregasAccion, reprocesarSobreAccion } from "@/app/(app)/ajustes/salud/acciones";

/**
 * La tabla de entregas del webhook (ticket 110), la mas reciente arriba. Sistema
 * "Tinta" (docs/structure.md §9): cada bloque es una tarjeta, los estados van en
 * `<Badge variant>` (tono semantico, no color suelto), la hora en `cifra` y el
 * movimiento solo en 150 ms de color.
 *
 * Usa `<select>` HTML nativo para el programa y `Link` para refrescar, NO los Select de
 * Base UI: Base UI revienta la pagina si una parte se compone mal y ningun test lo ve
 * (AGENTS.md). El boton de reprocesar llama la server action, que re-verifica el rol en
 * el servidor: esconderlo no es la seguridad.
 */

export interface EntregaVista {
  id: string;
  recibidoEn: string;
  codigoHttp: number;
  motivo: string;
  fuenteNombre: string | null;
  leadId: string | null;
  leadNombre: string | null;
  sobreId: string | null;
  errorSobre: string | null;
  reprocesable: boolean;
}

/** El texto legible de cada motivo del enum `motivo_entrega`. */
const TEXTO_MOTIVO: Record<string, string> = {
  procesado: "Procesado",
  sin_correo: "Sin correo",
  contenido_invalido: "Contenido inválido",
  fallo_ingesta: "Falló la ingesta",
  fuente_no_encontrada: "Fuente no encontrada",
  sin_secreto: "Fuente sin secreto",
  firma_ausente: "Firma ausente",
  firma_invalida: "Firma inválida",
};

/** El tono de cada codigo HTTP: 200 bien, 401/404 mal. Un fallo con firma buena, alerta. */
function tonoDe(entrega: EntregaVista): "exito" | "alerta" | "peligro" {
  if (entrega.codigoHttp !== 200) return "peligro";
  return entrega.motivo === "procesado" ? "exito" : "alerta";
}

export function EntregasWebhook({
  entregas: entregasIniciales,
  titulo,
  programaSlug,
  cursorInicial = null,
}: {
  entregas: EntregaVista[];
  titulo: string;
  /** El slug del programa; ausente = las huérfanas. También enruta "Ver anteriores". */
  programaSlug?: string;
  /** El cursor de la página siguiente, o `null` si estas 25 son todo lo que hay. */
  cursorInicial?: string | null;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  // Las entregas se acumulan en el cliente: "Ver anteriores" agrega las siguientes 25
  // sin recargar. El cursor marca por dónde seguir; `null` oculta el botón (última
  // página). La seguridad no vive aquí: la server action re-verifica el rol (ADR 0025).
  const [entregas, setEntregas] = useState<EntregaVista[]>(entregasIniciales);
  const [cursor, setCursor] = useState<string | null>(cursorInicial);

  function reprocesar(sobreId: string) {
    startTransition(async () => {
      const r = await reprocesarSobreAccion(sobreId);
      if (r.ok) {
        toast.success(`Reprocesado: ${TEXTO_MOTIVO[r.motivo] ?? r.motivo}.`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function verAnteriores() {
    if (!cursor) return;
    startTransition(async () => {
      const r = await cargarMasEntregasAccion(programaSlug ?? null, cursor);
      if (r.ok) {
        setEntregas((previas) => [...previas, ...r.entregas]);
        setCursor(r.cursor);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {entregas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no ha llegado ninguna entrega. Cuando el formulario envíe un lead, aparecerá aquí con
            su código y el lead que trajo.
          </p>
        ) : (
          <div className="divide-y">
            {entregas.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <Badge variant={tonoDe(e)} className="cifra">
                  {e.codigoHttp}
                </Badge>
                <span className="font-medium">{TEXTO_MOTIVO[e.motivo] ?? e.motivo}</span>
                <span className="cifra text-muted-foreground">{fechaHoraEnBogota(e.recibidoEn)}</span>
                {e.fuenteNombre ? (
                  <span className="text-muted-foreground">· {e.fuenteNombre}</span>
                ) : null}
                {e.leadId && programaSlug ? (
                  <Link
                    href={`/p/${programaSlug}/leads/${e.leadId}`}
                    className="text-marca-texto underline-offset-4 hover:underline"
                  >
                    {e.leadNombre ?? "Ver lead"}
                  </Link>
                ) : null}
                {e.errorSobre ? (
                  <span className="text-tono-peligro">— {e.errorSobre}</span>
                ) : null}
                {e.reprocesable && e.sobreId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendiente}
                    onClick={() => reprocesar(e.sobreId!)}
                  >
                    <RotateCcw className="size-3.5" />
                    Reprocesar
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {cursor ? (
          <div className="pt-3">
            <Button size="sm" variant="outline" disabled={pendiente} onClick={verAnteriores}>
              Ver anteriores
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * El selector de programa (por slug en la URL: el programa es frontera y el filtro va
 * por id opaco, nunca por correo) mas el boton de refrescar la conciliacion. Ambos
 * navegan por URL; refrescar solo vuelve a pedir la pagina (la conciliacion corre al
 * abrir, sin cron).
 */
export function SelectorYRefresco({
  programas,
  slugActual,
}: {
  programas: { slug: string; nombre: string }[];
  slugActual: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <select
        value={slugActual}
        onChange={(ev) => router.push(`/ajustes/salud?programa=${encodeURIComponent(ev.target.value)}`)}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Programa"
      >
        {programas.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.nombre}
          </option>
        ))}
      </select>
      <Button size="sm" variant="outline" onClick={() => router.refresh()}>
        <RefreshCw className="size-3.5" />
        Refrescar
      </Button>
    </div>
  );
}
