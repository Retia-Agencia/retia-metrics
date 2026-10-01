"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  crearEstadoLlegadaAccion,
  desactivarEstadoLlegadaAccion,
  editarEstadoLlegadaAccion,
  reactivarEstadoLlegadaAccion,
  type ResultadoEstadoLlegadaAccion,
} from "@/app/(app)/ajustes/fuentes/estados-llegada-acciones";
import type { EstadoLlegadaVista, ValorSinEstado } from "@/lib/queries/estados-llegada";

/**
 * Los Estados de llegada de cada programa (ticket 117, ADR 0061): qué valor de la variable
 * `estado` del formulario abre un deal, en qué etapa y con qué prioridad. Un valor nuevo del
 * formulario se configura aquí, sin tocar código; y los valores que llegaron sin fila se
 * listan abajo para crearla de un clic.
 */

type Etapa = EstadoLlegadaVista["etapaEntrada"];
type Prioridad = EstadoLlegadaVista["prioridad"];

interface Borrador {
  id: string | null;
  programId: string;
  valor: string;
  etapaEntrada: Etapa;
  prioridad: Prioridad;
  alertaMinutos: string;
}

const ETIQUETA_ETAPA: Record<Exclude<Etapa, null>, string> = {
  pendiente_setteo: "Pendiente Setteo",
  agendado: "Agendado",
};

const claseControl =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export interface ProgramaEstadosVista {
  id: string;
  nombre: string;
}

export function EstadosLlegadaAdmin({
  programas,
  estados,
  sinFila,
}: {
  programas: ProgramaEstadosVista[];
  estados: EstadoLlegadaVista[];
  sinFila: ValorSinEstado[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const vacio = (programId = programas[0]?.id ?? ""): Borrador => ({
    id: null,
    programId,
    valor: "",
    etapaEntrada: "pendiente_setteo",
    prioridad: "normal",
    alertaMinutos: "",
  });
  const [borrador, setBorrador] = useState<Borrador>(() => vacio());

  function correr(accion: () => Promise<ResultadoEstadoLlegadaAccion>, mensaje: string, limpiar = false) {
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error });
        return;
      }
      toast.success(mensaje);
      if (limpiar) setBorrador(vacio(borrador.programId));
      router.refresh();
    });
  }

  function editar(e: EstadoLlegadaVista) {
    setBorrador({
      id: e.id,
      programId: e.programId,
      valor: e.valor,
      etapaEntrada: e.etapaEntrada,
      prioridad: e.prioridad,
      alertaMinutos: e.alertaMinutos === null ? "" : String(e.alertaMinutos),
    });
    document.getElementById("formulario-estado-llegada")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function desdeValor(v: ValorSinEstado) {
    setBorrador({ ...vacio(v.programId), valor: v.valor });
    document.getElementById("formulario-estado-llegada")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const minutos = borrador.alertaMinutos.trim();
  const entrada = {
    programId: borrador.programId,
    valor: borrador.valor,
    etapaEntrada: borrador.etapaEntrada,
    prioridad: borrador.prioridad,
    alertaMinutos: minutos === "" ? null : Number(minutos),
  };
  const nombreDe = new Map(programas.map((p) => [p.id, p.nombre]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estados de llegada</CardTitle>
        <p className="text-sm text-muted-foreground">
          Qué valor de la variable <code>estado</code> del formulario abre un deal, en qué etapa y con qué prioridad.
          Un envío con un valor que no está aquí entra como lead sin deal y se cuenta como “sin estado”.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          id="formulario-estado-llegada"
          className="grid gap-3 md:scroll-mt-28 md:grid-cols-2 lg:grid-cols-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            correr(
              () => (borrador.id ? editarEstadoLlegadaAccion(borrador.id, entrada) : crearEstadoLlegadaAccion(entrada)),
              borrador.id ? "Estado actualizado" : "Estado creado",
              true,
            );
          }}
        >
          <Campo etiqueta="Programa">
            <select
              className={claseControl}
              required
              disabled={borrador.id !== null}
              value={borrador.programId}
              onChange={(e) => setBorrador({ ...borrador, programId: e.target.value })}
            >
              {programas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Valor (como lo manda el formulario)">
            <input
              className={claseControl}
              required
              maxLength={80}
              value={borrador.valor}
              onChange={(e) => setBorrador({ ...borrador, valor: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Etapa de entrada">
            <select
              className={claseControl}
              value={borrador.etapaEntrada ?? ""}
              onChange={(e) => setBorrador({ ...borrador, etapaEntrada: (e.target.value || null) as Etapa })}
            >
              {Object.entries(ETIQUETA_ETAPA).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
              <option value="">No abre deal</option>
            </select>
          </Campo>
          <Campo etiqueta="Prioridad">
            <select
              className={claseControl}
              value={borrador.prioridad}
              onChange={(e) => setBorrador({ ...borrador, prioridad: e.target.value as Prioridad })}
            >
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
            </select>
          </Campo>
          <Campo etiqueta="Urgente a los (minutos, vacío = nunca)">
            <input
              className={claseControl}
              type="number"
              inputMode="numeric"
              min={1}
              max={10080}
              step={1}
              value={borrador.alertaMinutos}
              onChange={(e) => setBorrador({ ...borrador, alertaMinutos: e.target.value })}
            />
          </Campo>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={pendiente || programas.length === 0}>
              <Plus className="size-4" />
              {borrador.id ? "Guardar" : "Crear"}
            </Button>
            {borrador.id ? (
              <Button type="button" variant="outline" onClick={() => setBorrador(vacio(borrador.programId))}>
                <X className="size-4" />
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>

        <div className="overflow-x-auto">
          {estados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún programa tiene Estados de llegada: ningún envío abrirá deal hasta crear el primero.
            </p>
          ) : (
            <table className="w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2">Programa</th>
                  <th className="pb-2">Valor</th>
                  <th className="pb-2">Etapa de entrada</th>
                  <th className="pb-2">Prioridad</th>
                  <th className="pb-2 text-right">Urgente a los</th>
                  <th className="pb-2 text-right">Envíos</th>
                  <th className="pb-2">Estado</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {estados.map((e) => (
                  <tr key={e.id}>
                    <td className="py-3">{nombreDe.get(e.programId) ?? "—"}</td>
                    <td className="font-medium">
                      <code>{e.valor}</code>
                    </td>
                    <td>{e.etapaEntrada ? ETIQUETA_ETAPA[e.etapaEntrada] : "No abre deal"}</td>
                    <td>
                      {e.prioridad === "alta" ? <Badge variant="alerta">Alta</Badge> : <Badge variant="neutro">Normal</Badge>}
                    </td>
                    <td className="cifra text-right">{e.alertaMinutos === null ? "—" : `${e.alertaMinutos} min`}</td>
                    <td className="cifra text-right">{e.envios}</td>
                    <td>
                      <Badge variant={e.activo ? "exito" : "neutro"}>{e.activo ? "Activo" : "Inactivo"}</Badge>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => editar(e)}>
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendiente}
                          onClick={() =>
                            correr(
                              () => (e.activo ? desactivarEstadoLlegadaAccion(e.id) : reactivarEstadoLlegadaAccion(e.id)),
                              e.activo ? "Estado desactivado" : "Estado reactivado",
                            )
                          }
                        >
                          <RotateCcw className="size-4" />
                          {e.activo ? "Desactivar" : "Reactivar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {sinFila.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Valores sin Estado de llegada</h3>
            <p className="text-sm text-muted-foreground">
              El formulario los mandó y el programa no los tiene (o están inactivos): esos envíos no abrieron deal.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2">Programa</th>
                    <th className="pb-2">Valor</th>
                    <th className="pb-2 text-right">Envíos</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sinFila.map((v) => {
                    const inactivoId = v.inactivoId;
                    return (
                      <tr key={`${v.programId}:${v.valor}`}>
                        <td className="py-3">{v.programa}</td>
                        <td className="font-medium">
                          <code>{v.valor}</code>
                        </td>
                        <td className="cifra text-right">{v.envios}</td>
                        <td className="text-right">
                          {inactivoId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pendiente}
                              onClick={() => correr(() => reactivarEstadoLlegadaAccion(inactivoId), "Estado reactivado")}
                            >
                              Reactivar
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => desdeValor(v)}>
                              Crear Estado
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}
