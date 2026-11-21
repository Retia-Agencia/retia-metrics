"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  crearSkuAccion,
  desactivarSkuAccion,
  editarSkuAccion,
  reactivarSkuAccion,
  type ResultadoAccion,
} from "@/app/(app)/p/[programa]/programa/acciones-programa";
import { codigoDeSku } from "@/lib/catalogo/codigo-de-sku";
import { META_LEADS_DIA_POR_DEFECTO } from "@/lib/cohortes-por-defecto";
import { usd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SkuVista {
  sku: {
    id: string;
    nombre: string;
    codigo: string;
    precioListaUsd: string;
    comisionPorcentaje: string | null;
    cuentaComoCupo: boolean;
    activo: boolean;
  };
  codigoCohorte: string;
}

interface BorradorSku {
  nombre: string;
  cohorteN: string;
  precioListaUsd: string;
  comisionPorcentaje: string;
  cuentaComoCupo: boolean;
  fechaInicioVentas: string;
  fechaCierreVentas: string;
  metaCupos: string;
  metaLeadsDia: string;
}

const NUEVO: BorradorSku = {
  nombre: "",
  cohorteN: "",
  precioListaUsd: "",
  comisionPorcentaje: "",
  cuentaComoCupo: false,
  fechaInicioVentas: "",
  fechaCierreVentas: "",
  metaCupos: "",
  metaLeadsDia: String(META_LEADS_DIA_POR_DEFECTO),
};

const claseInput =
  "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function numeroDeCohorte(codigo: string): number {
  return Number(/^C(\d+)$/.exec(codigo)?.[1] ?? 0);
}

function aEntrada(programId: string, borrador: BorradorSku, cohorteNueva: boolean) {
  return {
    programId,
    nombre: borrador.nombre,
    cohorteN: borrador.cohorteN,
    precioListaUsd: borrador.precioListaUsd,
    comisionPorcentaje: borrador.comisionPorcentaje,
    cuentaComoCupo: borrador.cuentaComoCupo,
    ventana: cohorteNueva
      ? {
          fechaInicioVentas: borrador.fechaInicioVentas,
          fechaCierreVentas: borrador.fechaCierreVentas,
          metaCupos: borrador.metaCupos,
          metaLeadsDia: borrador.metaLeadsDia,
        }
      : undefined,
  };
}

export function SkusDelPrograma({
  slug,
  programId,
  skus,
  nombres,
  codigosDeCohorte,
}: {
  slug: string;
  programId: string;
  skus: SkuVista[];
  nombres: string[];
  codigosDeCohorte: string[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<SkuVista | null>(null);
  const [borradorNuevo, setBorradorNuevo] = useState<BorradorSku>(NUEVO);
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);

  const cohortesExistentes = new Set(codigosDeCohorte.map(numeroDeCohorte));
  const n = Number(borradorNuevo.cohorteN);
  const cohorteNueva = Number.isInteger(n) && n > 0 && !cohortesExistentes.has(n);
  const codigo = borradorNuevo.nombre.trim() && n > 0
    ? codigoDeSku(slug, borradorNuevo.nombre, n)
    : null;

  function abrirNuevo(abierto: boolean) {
    setCreando(abierto);
    setErrorNuevo(null);
    if (abierto) setBorradorNuevo(NUEVO);
  }

  function guardarNuevo() {
    setErrorNuevo(null);
    startTransition(async () => {
      const resultado = await crearSkuAccion(slug, aEntrada(programId, borradorNuevo, cohorteNueva));
      if (!resultado.ok) {
        setErrorNuevo(resultado.error);
        return;
      }
      toast.success(
        "heredado" in resultado
          ? `SKU creado. Heredó de ${resultado.heredado.desde}: ${resultado.heredado.metricas.join(", ")}. Corrígelos en Objetivos.`
          : "SKU creado",
      );
      setCreando(false);
      router.refresh();
    });
  }

  function cambiarEstado(accion: () => Promise<ResultadoAccion>, mensaje: string) {
    startTransition(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error });
        return;
      }
      toast.success(mensaje);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={creando} onOpenChange={abrirNuevo}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            Nuevo SKU
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
            <DialogTitle>Nuevo SKU</DialogTitle>
            <DialogDescription>Crea el SKU y, si hace falta, también su cohorte.</DialogDescription>
            <FormularioSku
              borrador={borradorNuevo}
              setBorrador={setBorradorNuevo}
              nombres={nombres}
              cohorteBloqueada={false}
              cohorteNueva={cohorteNueva}
              codigo={codigo}
              error={errorNuevo}
              pendiente={pendiente}
              onCancelar={() => setCreando(false)}
              onGuardar={guardarNuevo}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              {['Nombre', 'Cohorte', 'Código', 'Precio USD', '% comisión', 'Cuenta como cupo', 'Activo'].map((titulo) => (
                <th key={titulo} className="px-3 py-2 font-medium">{titulo}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {skus.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-4 text-muted-foreground">Este programa todavía no tiene SKUs.</td></tr>
            ) : skus.map((fila) => (
              <tr key={fila.sku.id} className={!fila.sku.activo ? "opacity-50" : undefined}>
                <td className="px-3 py-3 font-medium">{fila.sku.nombre}</td>
                <td className="px-3 py-3">{fila.codigoCohorte}</td>
                <td className="px-3 py-3 font-mono text-xs">{fila.sku.codigo}</td>
                <td className="px-3 py-3 whitespace-nowrap">{usd(Number(fila.sku.precioListaUsd))}</td>
                <td className="px-3 py-3">{fila.sku.comisionPorcentaje === null ? "—" : `${Number(fila.sku.comisionPorcentaje)}%`}</td>
                <td className="px-3 py-3">{fila.sku.cuentaComoCupo ? "Sí" : "No"}</td>
                <td className="px-3 py-3"><Badge variant={fila.sku.activo ? "secondary" : "outline"}>{fila.sku.activo ? "Sí" : "No"}</Badge></td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => setEditando(fila)}>Editar</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendiente}
                      onClick={() => cambiarEstado(
                        () => fila.sku.activo ? desactivarSkuAccion(slug, fila.sku.id) : reactivarSkuAccion(slug, fila.sku.id),
                        fila.sku.activo ? "SKU desactivado" : "SKU reactivado",
                      )}
                    >
                      {fila.sku.activo ? "Desactivar" : "Reactivar"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando ? (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) setEditando(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogTitle>Editar SKU</DialogTitle>
            <DialogDescription>La cohorte no cambia al editar un SKU.</DialogDescription>
            <EditarSku fila={editando} slug={slug} programId={programId} pendiente={pendiente} startTransition={startTransition} alCerrar={() => setEditando(null)} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function EditarSku({ fila, slug, programId, pendiente, startTransition, alCerrar }: {
  fila: SkuVista;
  slug: string;
  programId: string;
  pendiente: boolean;
  startTransition: (callback: () => Promise<void>) => void;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<BorradorSku>({
    ...NUEVO,
    nombre: fila.sku.nombre,
    cohorteN: String(numeroDeCohorte(fila.codigoCohorte)),
    precioListaUsd: fila.sku.precioListaUsd,
    comisionPorcentaje: fila.sku.comisionPorcentaje ?? "",
    cuentaComoCupo: fila.sku.cuentaComoCupo,
  });

  return <FormularioSku
    borrador={borrador}
    setBorrador={setBorrador}
    nombres={[]}
    cohorteBloqueada
    cohorteNueva={false}
    codigo={codigoDeSku(slug, borrador.nombre, Number(borrador.cohorteN))}
    error={error}
    pendiente={pendiente}
    onCancelar={alCerrar}
    onGuardar={() => {
      setError(null);
      startTransition(async () => {
        const resultado = await editarSkuAccion(slug, fila.sku.id, aEntrada(programId, borrador, false));
        if (!resultado.ok) {
          setError(resultado.error);
          return;
        }
        toast.success("SKU actualizado");
        alCerrar();
        router.refresh();
      });
    }}
  />;
}

function FormularioSku({ borrador, setBorrador, nombres, cohorteBloqueada, cohorteNueva, codigo, error, pendiente, onCancelar, onGuardar }: {
  borrador: BorradorSku;
  setBorrador: (valor: BorradorSku) => void;
  nombres: string[];
  cohorteBloqueada: boolean;
  cohorteNueva: boolean;
  codigo: string | null;
  error: string | null;
  pendiente: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  const campo = (clave: keyof BorradorSku, valor: string | boolean) => setBorrador({ ...borrador, [clave]: valor });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onGuardar(); }}>
      <label className="space-y-1 text-sm"><span className="text-muted-foreground">Nombre</span><input list={nombres.length ? "nombres-sku" : undefined} value={borrador.nombre} onChange={(e) => campo("nombre", e.target.value)} required maxLength={80} className={claseInput} /></label>
      {nombres.length ? <datalist id="nombres-sku">{nombres.map((nombre) => <option key={nombre} value={nombre} />)}</datalist> : null}
      <label className="space-y-1 text-sm"><span className="text-muted-foreground">Cohorte N</span><input type="number" min={1} value={borrador.cohorteN} onChange={(e) => campo("cohorteN", e.target.value)} readOnly={cohorteBloqueada} required className={claseInput} /></label>
      <label className="space-y-1 text-sm"><span className="text-muted-foreground">Precio de lista USD</span><input inputMode="decimal" value={borrador.precioListaUsd} onChange={(e) => campo("precioListaUsd", e.target.value)} required className={claseInput} /></label>
      <label className="space-y-1 text-sm"><span className="text-muted-foreground">% de comisión</span><input inputMode="decimal" value={borrador.comisionPorcentaje} onChange={(e) => campo("comisionPorcentaje", e.target.value)} required className={claseInput} /></label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={borrador.cuentaComoCupo} onChange={(e) => campo("cuentaComoCupo", e.target.checked)} /> Cuenta como cupo</label>
      {codigo ? <p className="text-sm text-muted-foreground sm:col-span-2">Código: <span className="font-mono">{codigo}</span></p> : null}
      {cohorteNueva ? <>
        <p className="text-sm font-medium sm:col-span-2">La cohorte C{borrador.cohorteN} es nueva: nace con este SKU.</p>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Inicio de ventas</span><input type="date" value={borrador.fechaInicioVentas} onChange={(e) => campo("fechaInicioVentas", e.target.value)} required className={claseInput} /></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Cierre de ventas</span><input type="date" value={borrador.fechaCierreVentas} onChange={(e) => campo("fechaCierreVentas", e.target.value)} required className={claseInput} /></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Meta de cupos</span><input inputMode="numeric" value={borrador.metaCupos} onChange={(e) => campo("metaCupos", e.target.value)} required className={claseInput} /></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Meta de leads/día</span><input inputMode="numeric" value={borrador.metaLeadsDia} onChange={(e) => campo("metaLeadsDia", e.target.value)} required className={claseInput} /></label>
      </> : null}
      {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <DialogFooter className="sm:col-span-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={pendiente}>Guardar</Button>
      </DialogFooter>
    </form>
  );
}
