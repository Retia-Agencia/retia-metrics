"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monto, num } from "@/lib/format";
import type {
  AreaDeObjetivo,
  MonedaDeObjetivo,
  ObjetivoDeCohorte,
} from "@/lib/catalogo/objetivos";
import type { MetricaObjetivo } from "@/lib/objetivos/metricas";
import {
  copiarObjetivosAccion,
  guardarObjetivoAccion,
  quitarObjetivoAccion,
  type ResultadoAccionObjetivo,
} from "./acciones-objetivos";

interface MetricaEditable {
  metrica: MetricaObjetivo;
  nombre: string;
  esCosto: boolean;
}

export interface CohorteConObjetivos {
  id: string;
  codigo: string;
  estado: "activo" | "futuro" | "cerrado";
  cuposSinAsignar: number;
  tieneObjetivos: boolean;
  anteriorId: string | null;
}

const NOMBRE_AREA: Record<AreaDeObjetivo, string> = {
  paid: "Paid",
  organico: "Orgánico",
  referidos: "Referidos",
};

const ITEMS_AREA = [
  { value: "total", label: "Total" },
  { value: "paid", label: "Paid" },
  { value: "organico", label: "Orgánico" },
  { value: "referidos", label: "Referidos" },
];

const ITEMS_MONEDA = [
  { value: "COP", label: "COP" },
  { value: "USD", label: "USD" },
];

export function ObjetivosDeLaCohorte({
  cohortes,
  objetivos,
  metricas,
  editable,
}: {
  cohortes: CohorteConObjetivos[];
  objetivos: ObjetivoDeCohorte[];
  metricas: MetricaEditable[];
  editable: boolean;
}) {
  const predeterminada = cohortes.find((cohorte) => cohorte.estado === "activo")?.id ?? cohortes[0]?.id ?? "";
  const [cohortId, setCohortId] = useState(predeterminada);
  const [editando, setEditando] = useState<ObjetivoDeCohorte | null>(null);
  const [versionFormulario, setVersionFormulario] = useState(0);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();
  const cohorte = cohortes.find((fila) => fila.id === cohortId) ?? null;
  const filas = useMemo(
    () => objetivos.filter((fila) => fila.cohortId === cohortId && fila.activo),
    [cohortId, objetivos],
  );

  function ejecutar(
    accion: () => Promise<ResultadoAccionObjetivo>,
    mensaje: string,
    alCompletar?: () => void,
  ) {
    startTransition(async () => {
      const resultado = await accion();
      if (resultado.ok) {
        toast.success(mensaje);
        setEditando(null);
        alCompletar?.();
        router.refresh();
      } else {
        toast.error("No se pudo completar", { description: resultado.error });
      }
    });
  }

  if (cohortes.length === 0) {
    return <p className="text-sm text-muted-foreground">Crea una cohorte antes de definir sus objetivos.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Cohorte</span>
          <Select
            value={cohortId}
            items={cohortes.map((fila) => ({
              value: fila.id,
              label: `${fila.codigo}${fila.estado === "activo" ? " · Activa" : ""}`,
            }))}
            onValueChange={(valor) => {
              if (valor) {
                setCohortId(valor);
                setEditando(null);
              }
            }}
          >
            <SelectTrigger className="w-56" aria-label="Cohorte de los objetivos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cohortes.map((fila) => (
                <SelectItem key={fila.id} value={fila.id}>
                  {fila.codigo}{fila.estado === "activo" ? " · Activa" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {editable && cohorte && !cohorte.tieneObjetivos && cohorte.anteriorId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendiente}
            onClick={() =>
              ejecutar(
                () => copiarObjetivosAccion({ desdeCohorteId: cohorte.anteriorId!, haciaCohorteId: cohorte.id }),
                "Objetivos copiados",
              )
            }
          >
            Copiar de la cohorte anterior
          </Button>
        ) : null}
      </div>

      {cohorte ? (
        <p className="text-sm">
          <span className="font-medium cifra">Sin asignar: {num(cohorte.cuposSinAsignar)}</span> cupos
        </p>
      ) : null}

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta cohorte todavía no tiene objetivos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Métrica</th>
                <th className="px-2 py-2 font-medium">Área</th>
                <th className="px-2 py-2 text-right font-medium">Meta</th>
                <th className="px-2 py-2 text-right font-medium">Aceptable</th>
                <th className="px-2 py-2 font-medium">Moneda</th>
                {editable ? <th className="px-2 py-2 text-right font-medium">Acciones</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((fila) => {
                const definicion = metricas.find((metrica) => metrica.metrica === fila.metrica);
                const mostrar = (valor: number) => {
                  if (fila.moneda) return monto(valor, fila.moneda);
                  if (fila.metrica === "cupos" || fila.metrica === "agendas_por_dia") return num(valor);
                  return num(valor, 2);
                };
                return (
                  <tr key={fila.id}>
                    <td className="px-2 py-3 font-medium">{definicion?.nombre ?? fila.metrica}</td>
                    <td className="px-2 py-3">{fila.area ? NOMBRE_AREA[fila.area] : "Total"}</td>
                    <td className="cifra px-2 py-3 text-right">{mostrar(fila.meta)}</td>
                    <td className="cifra px-2 py-3 text-right">
                      {fila.aceptable === null ? "—" : mostrar(fila.aceptable)}
                    </td>
                    <td className="px-2 py-3">{fila.moneda ?? "—"}</td>
                    {editable ? (
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditando(fila)}>
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pendiente}
                            onClick={() => ejecutar(() => quitarObjetivoAccion(fila.id), "Objetivo quitado")}
                          >
                            Quitar
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editable && cohorte ? (
        <FormularioObjetivo
          key={`${cohorte.id}-${editando?.id ?? `nuevo-${versionFormulario}`}`}
          cohortId={cohorte.id}
          metricas={metricas}
          objetivo={editando}
          pendiente={pendiente}
          cancelar={editando ? () => setEditando(null) : undefined}
          guardar={(input) =>
            ejecutar(
              () => guardarObjetivoAccion(input),
              editando ? "Objetivo actualizado" : "Objetivo creado",
              editando ? undefined : () => setVersionFormulario((version) => version + 1),
            )
          }
        />
      ) : null}
    </div>
  );
}

function FormularioObjetivo({
  cohortId,
  metricas,
  objetivo,
  pendiente,
  guardar,
  cancelar,
}: {
  cohortId: string;
  metricas: MetricaEditable[];
  objetivo: ObjetivoDeCohorte | null;
  pendiente: boolean;
  guardar: (input: Parameters<typeof guardarObjetivoAccion>[0]) => void;
  cancelar?: () => void;
}) {
  const [metrica, setMetrica] = useState<MetricaObjetivo>(objetivo?.metrica ?? "costo_por_agenda");
  const [area, setArea] = useState<AreaDeObjetivo | "total">(objetivo?.area ?? "total");
  const [meta, setMeta] = useState(objetivo?.meta.toString() ?? "");
  const [aceptable, setAceptable] = useState(objetivo?.aceptable?.toString() ?? "");
  const [moneda, setMoneda] = useState<MonedaDeObjetivo>(objetivo?.moneda ?? "COP");
  const esCosto = metricas.find((fila) => fila.metrica === metrica)?.esCosto ?? false;

  return (
    <form
      className="space-y-3 border-t border-border pt-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar({
          id: objetivo?.id,
          cohortId,
          metrica,
          area: area === "total" ? null : area,
          meta,
          aceptable,
          moneda: esCosto ? moneda : null,
        });
      }}
    >
      <p className="text-sm font-medium">{objetivo ? "Editar objetivo" : "Nuevo objetivo"}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Métrica</span>
          <Select
            value={metrica}
            items={metricas.map((fila) => ({ value: fila.metrica, label: fila.nombre }))}
            onValueChange={(valor) => valor && setMetrica(valor as MetricaObjetivo)}
          >
            <SelectTrigger className="w-full" aria-label="Métrica del objetivo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {metricas.map((fila) => <SelectItem key={fila.metrica} value={fila.metrica}>{fila.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Área</span>
          <Select
            value={area}
            items={ITEMS_AREA}
            onValueChange={(valor) => valor && setArea(valor as AreaDeObjetivo | "total")}
          >
            <SelectTrigger className="w-full" aria-label="Área del objetivo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Total</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="organico">Orgánico</SelectItem>
              <SelectItem value="referidos">Referidos</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Meta</span>
          <Input aria-label="Meta del objetivo" inputMode="decimal" required value={meta} onChange={(e) => setMeta(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Aceptable</span>
          <Input aria-label="Valor aceptable del objetivo" inputMode="decimal" value={aceptable} onChange={(e) => setAceptable(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Moneda</span>
          <Select
            value={moneda}
            items={ITEMS_MONEDA}
            disabled={!esCosto}
            onValueChange={(valor) => valor && setMoneda(valor as MonedaDeObjetivo)}
          >
            <SelectTrigger className="w-full" aria-label="Moneda del objetivo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COP">COP</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button>
        {cancelar ? <Button type="button" variant="ghost" size="sm" onClick={cancelar}>Cancelar</Button> : null}
      </div>
    </form>
  );
}
