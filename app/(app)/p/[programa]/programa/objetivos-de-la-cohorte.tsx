"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { num } from "@/lib/format";
import type {
  AreaDeObjetivo,
  ObjetivoDeCohorte,
} from "@/lib/catalogo/objetivos";
import type {
  MetricaObjetivo,
  SentidoObjetivo,
  DefinicionMetricaObjetivo,
} from "@/lib/objetivos/metricas";
import { colorDeObjetivo, type ColorDeObjetivo } from "@/lib/objetivos/semaforo";
import {
  copiarObjetivosAccion,
  guardarObjetivoAccion,
  quitarObjetivoAccion,
  type ResultadoAccionObjetivo,
} from "./acciones-objetivos";

interface MetricaEditable {
  metrica: MetricaObjetivo;
  nombre: string;
  descripcion: string;
  sentido: SentidoObjetivo;
  unidad: DefinicionMetricaObjetivo["unidad"];
  admiteArea: boolean;
  ofrecida: boolean;
  puedeEditar: boolean;
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

const NOMBRE_COLOR: Record<ColorDeObjetivo, string> = {
  exito: "verde",
  alerta: "amarillo",
  peligro: "rojo",
};

function unidadCorta(unidad: MetricaEditable["unidad"]): string {
  if (unidad === "COP") return "COP";
  if (unidad === "razon") return "×";
  if (unidad === "porcentaje") return "%";
  return "";
}

function valorConUnidad(valor: number, unidad: MetricaEditable["unidad"]): string {
  if (unidad === "COP") return `${num(valor)} COP`;
  if (unidad === "razon") return `${num(valor, 2)} ×`;
  if (unidad === "porcentaje") return `${num(valor, 2)}%`;
  return num(valor, 2);
}

function fraseDeUmbrales(
  definicion: MetricaEditable,
  meta: number,
  aceptable: number | null,
): string {
  const preposicion = definicion.sentido === "menor_es_mejor" ? "hasta" : "desde";
  const verde = `${preposicion} ${valorConUnidad(meta, definicion.unidad)} verde`;
  const amarillo = aceptable === null
    ? null
    : `${preposicion} ${valorConUnidad(aceptable, definicion.unidad)} amarillo`;
  return [verde, amarillo].filter(Boolean).join(" · ");
}

export function ObjetivosDeLaCohorte({
  cohortes,
  objetivos,
  metricas,
  valoresDeHoy,
  puedeCopiar,
}: {
  cohortes: CohorteConObjetivos[];
  objetivos: ObjetivoDeCohorte[];
  metricas: MetricaEditable[];
  valoresDeHoy: Partial<Record<MetricaObjetivo, number | null>>;
  puedeCopiar: boolean;
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
  const hayEditables = metricas.some((metrica) => metrica.puedeEditar);

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
        {puedeCopiar && cohorte && !cohorte.tieneObjetivos && cohorte.anteriorId ? (
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
                <th className="px-2 py-2 font-medium">Umbrales</th>
                {hayEditables ? <th className="px-2 py-2 text-right font-medium">Acciones</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((fila) => {
                const definicion = metricas.find((metrica) => metrica.metrica === fila.metrica);
                return (
                  <tr key={fila.id}>
                    <td className="px-2 py-3 font-medium">{definicion?.nombre ?? fila.metrica}</td>
                    <td className="px-2 py-3">{fila.area ? NOMBRE_AREA[fila.area] : "Total"}</td>
                    <td className="cifra px-2 py-3">
                      {definicion
                        ? fraseDeUmbrales(definicion, fila.meta, fila.aceptable)
                        : `${num(fila.meta, 2)} verde`}
                    </td>
                    {hayEditables ? (
                      <td className="px-2 py-3">
                        {definicion?.puedeEditar ? <div className="flex justify-end gap-2">
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
                        </div> : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hayEditables && cohorte ? (
        <FormularioObjetivo
          key={`${cohorte.id}-${editando?.id ?? `nuevo-${versionFormulario}`}`}
          cohortId={cohorte.id}
          metricas={metricas}
          valoresDeHoy={valoresDeHoy}
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
  valoresDeHoy,
  objetivo,
  pendiente,
  guardar,
  cancelar,
}: {
  cohortId: string;
  metricas: MetricaEditable[];
  valoresDeHoy: Partial<Record<MetricaObjetivo, number | null>>;
  objetivo: ObjetivoDeCohorte | null;
  pendiente: boolean;
  guardar: (input: Parameters<typeof guardarObjetivoAccion>[0]) => void;
  cancelar?: () => void;
}) {
  const ofrecidas = metricas.filter((fila) => fila.ofrecida && fila.puedeEditar);
  const [metrica, setMetrica] = useState<MetricaObjetivo>(
    objetivo?.metrica ?? "costo_por_agenda",
  );
  const [area, setArea] = useState<AreaDeObjetivo | "total">(objetivo?.area ?? "total");
  const [meta, setMeta] = useState(objetivo?.meta.toString() ?? "");
  const [aceptable, setAceptable] = useState(objetivo?.aceptable?.toString() ?? "");
  const definicion = metricas.find((fila) => fila.metrica === metrica) ?? ofrecidas[0];
  const valorDeHoy = valoresDeHoy[metrica];
  const unidad = definicion ? unidadCorta(definicion.unidad) : "";
  const metaNumero = meta.trim() === "" ? Number.NaN : Number(meta);
  const aceptableNumero = aceptable === "" ? null : Number(aceptable);
  const colorHoy = definicion && valorDeHoy !== null && valorDeHoy !== undefined
    && Number.isFinite(metaNumero) && (aceptableNumero === null || Number.isFinite(aceptableNumero))
    ? colorDeObjetivo({ metrica, meta: metaNumero, aceptable: aceptableNumero, valor: valorDeHoy })
    : null;
  const metaEnPlantilla = meta || "[meta]";
  const aceptableEnPlantilla = aceptable || "[aceptable]";
  const sufijoUnidad = unidad ? ` ${unidad}` : "";

  return (
    <form
      className="space-y-3 border-t border-border pt-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar({
          id: objetivo?.id,
          cohortId,
          metrica,
          area: definicion?.admiteArea && area !== "total" ? area : null,
          meta,
          aceptable,
        });
      }}
    >
      <p className="text-sm font-medium">{objetivo ? "Editar objetivo" : "Nuevo objetivo"}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Métrica</span>
          <Select
            value={metrica}
            items={ofrecidas.map((fila) => ({ value: fila.metrica, label: fila.nombre }))}
            onValueChange={(valor) => valor && setMetrica(valor as MetricaObjetivo)}
          >
            <SelectTrigger className="w-full" aria-label="Métrica del objetivo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ofrecidas.map((fila) => <SelectItem key={fila.metrica} value={fila.metrica}>{fila.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        {definicion?.admiteArea ? (
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
        ) : null}
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">🟢 Verde {definicion?.sentido === "menor_es_mejor" ? "hasta" : "desde"}</span>
          <span className="flex items-center gap-2">
            <Input aria-label="Meta del objetivo" inputMode="decimal" required value={meta} onChange={(e) => setMeta(e.target.value)} />
            {unidad ? <span className="cifra text-foreground">{unidad}</span> : null}
          </span>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">🟡 Amarillo {definicion?.sentido === "menor_es_mejor" ? "hasta" : "desde"}</span>
          <span className="flex items-center gap-2">
            <Input aria-label="Valor aceptable del objetivo" inputMode="decimal" value={aceptable} onChange={(e) => setAceptable(e.target.value)} />
            {unidad ? <span className="cifra text-foreground">{unidad}</span> : null}
          </span>
        </label>
      </div>
      {definicion ? (
        <div className="space-y-1 text-sm">
          <p>
            {definicion.sentido === "menor_es_mejor"
              ? `🟢 Verde si cuesta hasta ${metaEnPlantilla}${sufijoUnidad} · 🟡 Amarillo si cuesta hasta ${aceptableEnPlantilla}${sufijoUnidad} · 🔴 Rojo si cuesta más de eso`
              : `🟢 Verde desde ${metaEnPlantilla}${sufijoUnidad} · 🟡 Amarillo desde ${aceptableEnPlantilla}${sufijoUnidad} · 🔴 Rojo por debajo`}
          </p>
          <p className="text-muted-foreground">{definicion.descripcion}</p>
          <p className="text-muted-foreground">
            {valorDeHoy === null || valorDeHoy === undefined
              ? "Sin dato todavía"
              : colorHoy
                ? `Últimos 7 días hábiles: ${valorConUnidad(valorDeHoy, definicion.unidad)} → saldría ${NOMBRE_COLOR[colorHoy]}`
                : "Completa los umbrales para ver el color de hoy."}
          </p>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button>
        {cancelar ? <Button type="button" variant="ghost" size="sm" onClick={cancelar}>Cancelar</Button> : null}
      </div>
    </form>
  );
}
