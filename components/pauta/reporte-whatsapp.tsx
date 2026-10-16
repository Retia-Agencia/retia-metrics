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

const HORAS = Array.from({ length: 24 }, (_, hora) => hora);
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

interface VistaPrevia {
  dia: string | null;
  cierre: string | null;
  aviso: string | null;
}

export function ReporteWhatsapp({
  programId,
  configuracion,
  metricasDisponibles,
  puedeEditar,
  vistaPrevia,
}: {
  programId: string;
  configuracion: ConfiguracionVisible | null;
  metricasDisponibles: MetricaVisible[];
  puedeEditar: boolean;
  vistaPrevia: VistaPrevia;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [borrador, setBorrador] = useState<EntradaReporteWhatsapp>({
    activo: configuracion?.activo ?? false,
    destino: configuracion?.destino ?? null,
    horas: configuracion?.horas ?? [],
    horaCierre: configuracion?.horaCierre ?? null,
    metricas: configuracion?.metricas ?? [],
  });
  const deshabilitado = pendiente || !puedeEditar;
  const guardada: EntradaReporteWhatsapp = {
    activo: configuracion?.activo ?? false,
    destino: configuracion?.destino ?? null,
    horas: configuracion?.horas ?? [],
    horaCierre: configuracion?.horaCierre ?? null,
    metricas: configuracion?.metricas ?? [],
  };
  const tieneCambios = borrador.activo !== guardada.activo
    || borrador.destino !== guardada.destino
    || borrador.horaCierre !== guardada.horaCierre
    || JSON.stringify(borrador.horas) !== JSON.stringify(guardada.horas)
    || JSON.stringify(borrador.metricas) !== JSON.stringify(guardada.metricas);

  function agregarHora(hora: number) {
    setBorrador((actual) => ({
      ...actual,
      horas: [...new Set([...actual.horas, hora])].sort((a, b) => a - b),
    }));
  }

  function quitarHora(hora: number) {
    setBorrador((actual) => ({
      ...actual,
      horas: actual.horas.filter((valor) => valor !== hora),
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
          <p className="text-muted-foreground">Juanito agrupará los programas que compartan destino.</p>
        </div>
        <Switch
          checked={borrador.activo}
          onCheckedChange={(checked) => setBorrador((actual) => ({ ...actual, activo: checked }))}
          disabled={deshabilitado}
          aria-label="Enviar reporte por WhatsApp"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="grupo-whatsapp" className="font-medium">Grupo de WhatsApp</label>
        <Input
          id="grupo-whatsapp"
          value={borrador.destino ?? ""}
          onChange={(evento) => setBorrador((actual) => ({
            ...actual,
            destino: evento.target.value,
          }))}
          disabled={deshabilitado}
          placeholder="120363000000000000@g.us"
        />
        <p className="text-xs text-muted-foreground">Vacío: el grupo de alertas de Retia.</p>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Horas del día</p>
        <div className="flex flex-wrap gap-2">
          {[...borrador.horas].sort((a, b) => a - b).map((hora) => (
            <Button
              key={hora}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => quitarHora(hora)}
              disabled={deshabilitado}
              aria-label={`Quitar ${String(hora).padStart(2, "0")}:00`}
            >
              <span className="cifra">{String(hora).padStart(2, "0")}:00</span>
              <span aria-hidden="true">×</span>
            </Button>
          ))}
        </div>
        {HORAS.some((hora) => !borrador.horas.includes(hora)) ? (
          <Select
            value={null}
            items={HORAS.filter((hora) => !borrador.horas.includes(hora)).map((hora) => ({
              value: String(hora),
              label: `${String(hora).padStart(2, "0")}:00`,
            }))}
            onValueChange={(valor) => {
              if (valor !== null) agregarHora(Number(valor));
            }}
            disabled={deshabilitado}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Agregar una hora" />
            </SelectTrigger>
            <SelectContent>
              {HORAS.filter((hora) => !borrador.horas.includes(hora)).map((hora) => (
                <SelectItem key={hora} value={String(hora)}>
                  {String(hora).padStart(2, "0")}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

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

      <div className="space-y-3 border-t pt-5">
        <p className="font-medium">Así se vería ahora</p>
        {vistaPrevia.aviso ? (
          <p className="text-muted-foreground">{vistaPrevia.aviso}</p>
        ) : (
          <div className="space-y-3">
            {vistaPrevia.dia ? (
              <pre className="font-sans text-sm whitespace-pre-wrap rounded-md border bg-muted/40 p-3">
                {vistaPrevia.dia}
              </pre>
            ) : null}
            {vistaPrevia.cierre ? (
              <pre className="font-sans text-sm whitespace-pre-wrap rounded-md border bg-muted/40 p-3">
                {vistaPrevia.cierre}
              </pre>
            ) : null}
          </div>
        )}
        {tieneCambios ? (
          <p className="text-xs text-muted-foreground">
            Guarda para ver la vista previa con estos cambios.
          </p>
        ) : null}
      </div>
    </div>
  );
}
