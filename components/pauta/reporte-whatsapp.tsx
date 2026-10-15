"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  guardarReporteWhatsappAccion,
  type ResultadoAccionReporte,
} from "@/app/(app)/p/[programa]/programa/acciones-reporte-whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  EntradaReporteWhatsapp,
  MetricaDelReporte,
} from "@/lib/catalogo/reportes-whatsapp";

const HORAS = Array.from({ length: 14 }, (_, indice) => indice + 6);
const SIN_RESUMEN = "sin_resumen";

interface MetricaVisible {
  metrica: MetricaDelReporte;
  nombre: string;
  tieneUmbral: boolean;
}

interface ConfiguracionVisible {
  activo: boolean;
  destino: string | null;
  horas: number[];
  horaCierre: number | null;
  metricas: MetricaDelReporte[];
}

export function ReporteWhatsapp({
  programId,
  configuracion,
  metricasDisponibles,
  puedeEditar,
}: {
  programId: string;
  configuracion: ConfiguracionVisible | null;
  metricasDisponibles: MetricaVisible[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [borrador, setBorrador] = useState<EntradaReporteWhatsapp>({
    activo: configuracion?.activo ?? false,
    destino: configuracion?.destino ?? "",
    horas: configuracion?.horas ?? [],
    horaCierre: configuracion?.horaCierre ?? null,
    metricas: configuracion?.metricas ?? [],
  });
  const deshabilitado = pendiente || !puedeEditar;

  function alternarHora(hora: number, marcada: boolean) {
    setBorrador((actual) => ({
      ...actual,
      horas: marcada
        ? [...actual.horas, hora].sort((a, b) => Number(a) - Number(b))
        : actual.horas.filter((valor) => Number(valor) !== hora),
    }));
  }

  function alternarMetrica(metrica: MetricaDelReporte, marcada: boolean) {
    setBorrador((actual) => ({
      ...actual,
      metricas: marcada
        ? [...actual.metricas, metrica]
        : actual.metricas.filter((valor) => valor !== metrica),
    }));
  }

  function guardar() {
    startTransition(async () => {
      const resultado: ResultadoAccionReporte = await guardarReporteWhatsappAccion(programId, borrador);
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error });
        return;
      }
      toast.success("Reporte guardado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Enviar reporte</p>
          <p className="text-muted-foreground">Juanito enviará cada programa por separado.</p>
        </div>
        <Switch
          checked={borrador.activo}
          onCheckedChange={(checked) => setBorrador((actual) => ({ ...actual, activo: checked }))}
          disabled={deshabilitado}
          aria-label="Enviar reporte por WhatsApp"
        />
      </div>

      <label className="block space-y-1.5">
        <span className="font-medium">Grupo de WhatsApp</span>
        <Input
          value={borrador.destino ?? ""}
          onChange={(event) => setBorrador((actual) => ({ ...actual, destino: event.target.value }))}
          placeholder="1203…@g.us"
          disabled={deshabilitado}
        />
        <span className="block text-xs text-muted-foreground">
          Pega el id que entrega /grupos de Juanito.
        </span>
      </label>

      <fieldset disabled={deshabilitado} className="space-y-2">
        <legend className="font-medium">Horas del día</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {HORAS.map((hora) => (
            <label key={hora} className="flex items-center gap-2 rounded-lg border border-border px-2 py-2">
              <input
                type="checkbox"
                checked={borrador.horas.some((valor) => Number(valor) === hora)}
                onChange={(event) => alternarHora(hora, event.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="cifra">{String(hora).padStart(2, "0")}:00</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <p className="font-medium">Resumen de cierre</p>
        <Select
          value={borrador.horaCierre === null ? SIN_RESUMEN : String(borrador.horaCierre)}
          items={[
            { value: SIN_RESUMEN, label: "Sin resumen" },
            ...HORAS.map((hora) => ({ value: String(hora), label: `${String(hora).padStart(2, "0")}:00` })),
          ]}
          onValueChange={(valor) => setBorrador((actual) => ({
            ...actual,
            horaCierre: valor === SIN_RESUMEN || valor === null ? null : Number(valor),
          }))}
          disabled={deshabilitado}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_RESUMEN}>Sin resumen</SelectItem>
            {HORAS.map((hora) => (
              <SelectItem key={hora} value={String(hora)}>
                {String(hora).padStart(2, "0")}:00
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <p className="font-medium">Métricas</p>
        {metricasDisponibles.map((metrica) => (
          <div key={metrica.metrica} className="flex items-start justify-between gap-4">
            <div>
              <p>{metrica.nombre}</p>
              {!metrica.tieneUmbral ? (
                <p className="text-xs text-muted-foreground">
                  Sin umbral en la cohorte activa: cárgalo en Ventas
                </p>
              ) : null}
            </div>
            <Switch
              checked={borrador.metricas.includes(metrica.metrica)}
              onCheckedChange={(checked) => alternarMetrica(metrica.metrica, checked)}
              disabled={deshabilitado || !metrica.tieneUmbral}
              aria-label={`Incluir ${metrica.nombre}`}
            />
          </div>
        ))}
      </div>

      {puedeEditar ? (
        <div className="flex justify-end">
          <Button type="button" onClick={guardar} disabled={pendiente}>Guardar reporte</Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Solo quien administra puede cambiar esta configuración.</p>
      )}
    </div>
  );
}
