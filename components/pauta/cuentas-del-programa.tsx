"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  activarCuentaMetaAccion,
  desactivarCuentaMetaAccion,
  vincularCuentaMetaAccion,
  type ResultadoCuentaMeta,
} from "@/app/(app)/p/[programa]/programa/acciones-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CuentaDelPrograma } from "@/lib/catalogo/meta";
import type { CuentaVisibleMeta } from "@/lib/pauta/meta-api";

export function CuentasDelPrograma({
  programId,
  conectada,
  cuentas,
  disponibles,
  errorDeConsulta,
  puedeEditar,
}: {
  programId: string;
  conectada: boolean;
  cuentas: CuentaDelPrograma[];
  disponibles: CuentaVisibleMeta[];
  errorDeConsulta: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [idMeta, setIdMeta] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function correr(accion: () => Promise<ResultadoCuentaMeta>, exito: string) {
    startTransition(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error });
        return;
      }
      toast.success(exito);
      setIdMeta(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!conectada ? (
        <p className="text-sm text-muted-foreground">
          Primero conecta Meta en Integraciones para ver las cuentas disponibles.
        </p>
      ) : null}

      {cuentas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este programa todavía no tiene cuentas de Meta.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Cuenta</th>
                <th className="px-2 py-2 font-medium">ID</th>
                <th className="px-2 py-2 font-medium">Moneda</th>
                <th className="px-2 py-2 font-medium">Zona</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                {puedeEditar ? <th className="px-2 py-2"><span className="sr-only">Acción</span></th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cuentas.map((cuenta) => (
                <tr key={cuenta.id}>
                  <td className="px-2 py-3 font-medium">{cuenta.nombre}</td>
                  <td className="cifra px-2 py-3">{cuenta.idMeta}</td>
                  <td className="cifra px-2 py-3">{cuenta.moneda}</td>
                  <td className="px-2 py-3">
                    <div className="space-y-1">
                      <span>{cuenta.zonaHoraria}</span>
                      {cuenta.zonaDistintaDeBogota ? (
                        <Badge variant="alerta">
                          Zona distinta de Bogotá: el gasto por día quedaría corrido
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Badge variant={cuenta.activo ? "exito" : "neutro"}>
                      {cuenta.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  {puedeEditar ? <td className="px-2 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendiente}
                      onClick={() =>
                        correr(
                          () =>
                            cuenta.activo
                              ? desactivarCuentaMetaAccion(programId, cuenta.id)
                              : activarCuentaMetaAccion(programId, cuenta.id),
                          cuenta.activo ? "Cuenta desactivada" : "Cuenta activada",
                        )
                      }
                    >
                      {cuenta.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeEditar && conectada && errorDeConsulta ? (
        <p className="text-sm text-muted-foreground">
          No se pudo consultar Meta: {errorDeConsulta}. Revisa la conexión de este programa.
        </p>
      ) : puedeEditar && conectada ? (
        disponibles.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={idMeta}
              items={disponibles.map((cuenta) => ({ value: cuenta.idMeta, label: cuenta.nombre }))}
              onValueChange={(valor: string | null) => setIdMeta(valor)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una cuenta visible en Meta" />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map((cuenta) => (
                  <SelectItem key={cuenta.idMeta} value={cuenta.idMeta}>
                    {cuenta.nombre} · {cuenta.idMeta} · {cuenta.moneda}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              disabled={pendiente || !idMeta}
              onClick={() => {
                if (idMeta) correr(() => vincularCuentaMetaAccion(programId, idMeta), "Cuenta vinculada");
              }}
            >
              Vincular
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No quedan cuentas visibles sin vincular.
          </p>
        )
      ) : null}
    </div>
  );
}
