"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TipoIntegracion } from "@/lib/db/schema";
import type { CuentaDelPrograma } from "@/lib/catalogo/meta";
import type { CuentaVisibleMeta } from "@/lib/pauta/meta-api";
import type { ResumenMetaCapi } from "@/lib/meta-capi/resumen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CuentasDelPrograma } from "@/components/pauta/cuentas-del-programa";
import { conectarCalendlyAccion } from "@/app/(app)/p/[programa]/programa/acciones-programa";
import { configurarMetaCapiAccion, guardarIntegracionAccion, guardarRoundRobinAccion, mandarPruebaMetaCapiAccion, probarIntegracionAccion, sincronizarMetaDelProgramaAccion } from "@/app/(app)/p/[programa]/programa/acciones-integraciones";

type ConfigVisible = Record<string, string | boolean | null>;

export type IntegracionVisible = {
  tipo: TipoIntegracion;
  nombre: string;
  campo: string;
  configurada: boolean;
  probadaEn: string | null;
  config: ConfigVisible;
  actualizadaEn: string | null;
  webhookConectado?: boolean;
};

type FuenteExterna = { id: string; nombre: string; proveedor: string | null; tieneSecreto: boolean };

function Config({ config }: { config: ConfigVisible }) {
  const etiquetas: Record<string, string> = {
    cuentaId: "ID de cuenta", cuenta: "Cuenta", alias: "Alias",
    organizacion: "Organización", nombre: "Usuario",
  };
  const valores = Object.entries(config).filter(([clave, valor]) => Boolean(valor) && !["encendido", "ultimaPruebaEn"].includes(clave));
  return valores.length > 0 ? (
    <p className="text-sm text-muted-foreground">
      {valores.map(([clave, valor]) => `${etiquetas[clave] ?? clave}: ${String(valor)}`).join(" · ")}
    </p>
  ) : null;
}

export function IntegracionesDelPrograma({
  programId, integraciones, cuentasMeta, disponiblesMeta, errorMeta, fuentes, hrefCaptacion, roundRobin, resumenCapi,
}: {
  programId: string;
  integraciones: IntegracionVisible[];
  cuentasMeta: CuentaDelPrograma[];
  disponiblesMeta: CuentaVisibleMeta[];
  errorMeta: string | null;
  fuentes: FuenteExterna[];
  hrefCaptacion: string;
  /** El round robin de Calendly del programa (ADR 0098): su URL, la marca de org compartida
   * y si el evento ya quedó resuelto. Llega por props: el cliente no lee la base. */
  roundRobin: { calendlyUrl: string | null; orgCompartida: boolean; configurado: boolean };
  resumenCapi: ResumenMetaCapi;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<TipoIntegracion | null>(null);
  const [valor, setValor] = useState("");
  const capi = integraciones.find((integracion) => integracion.tipo === "meta_capi");
  const [datasetId, setDatasetId] = useState(typeof capi?.config.datasetId === "string" ? capi.config.datasetId : "");
  const [pendiente, startTransition] = useTransition();

  function guardar(tipo: TipoIntegracion) {
    startTransition(async () => {
      const resultado = await guardarIntegracionAccion(programId, tipo, valor, tipo === "meta_capi" ? datasetId : undefined);
      if (!resultado.ok) {
        toast.error("No se pudo conectar", { description: resultado.error });
        return;
      }
      setValor("");
      setEditando(null);
      toast.success("Integración conectada y probada");
      router.refresh();
    });
  }

  function probar(tipo: TipoIntegracion) {
    startTransition(async () => {
      const resultado = await probarIntegracionAccion(programId, tipo);
      if (!resultado.ok) toast.error("La prueba falló", { description: resultado.error });
      else toast.success("Conexión probada");
      router.refresh();
    });
  }

  function conectarWebhook() {
    startTransition(async () => {
      const resultado = await conectarCalendlyAccion(programId);
      if (!resultado.ok) toast.error("No se pudo conectar el webhook", { description: resultado.error });
      else toast.success("Webhook de Calendly conectado");
      router.refresh();
    });
  }

  function sincronizarMeta() {
    startTransition(async () => {
      const resultado = await sincronizarMetaDelProgramaAccion(programId);
      if (!resultado.ok || resultado.estado === "error") {
        toast.error("La sincronización terminó con error", { description: resultado.ok ? resultado.error : resultado.error });
      } else toast.success(`Meta sincronizado: ${resultado.filas} filas de gasto`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {integraciones.map((integracion) => (
        <Card key={integracion.tipo}>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">{integracion.nombre}</CardTitle>
              <Config config={integracion.config} />
            </div>
            <Badge variant={integracion.probadaEn ? "exito" : integracion.configurada ? "alerta" : "neutro"}>
              {integracion.probadaEn ? "Conectada" : integracion.configurada ? "Sin probar" : "Sin conectar"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {integracion.probadaEn ? <p className="text-xs text-muted-foreground">Probada el {integracion.probadaEn}</p> : null}
            {editando === integracion.tipo ? (
              <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); guardar(integracion.tipo); }}>
                {integracion.tipo === "meta_capi" ? (
                  <Input
                    inputMode="numeric" pattern="[0-9]+" required value={datasetId}
                    onChange={(e) => setDatasetId(e.target.value)} placeholder="ID del dataset"
                    aria-label="ID del dataset de Meta"
                  />
                ) : null}
                <input
                  type="password" autoComplete="new-password" required maxLength={500}
                  value={valor} onChange={(e) => setValor(e.target.value)}
                  aria-label={integracion.campo}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button type="submit" size="sm" disabled={pendiente || !valor.trim()}>Guardar y probar</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setValor(""); setEditando(null); }}>Cancelar</Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { setValor(""); setEditando(integracion.tipo); }}>
                  {integracion.configurada ? "Reemplazar" : "Conectar"} {integracion.campo}
                </Button>
                {integracion.configurada && integracion.tipo !== "meta_capi" ? (
                  <Button type="button" size="sm" variant="outline" disabled={pendiente} onClick={() => probar(integracion.tipo)}>
                    Probar
                  </Button>
                ) : null}
              </div>
            )}

            {integracion.tipo === "calendly" ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Badge variant={integracion.webhookConectado ? "exito" : "alerta"}>
                  {integracion.webhookConectado ? "Webhook conectado" : "Webhook sin conectar"}
                </Badge>
                <Button type="button" size="sm" variant="outline" disabled={pendiente || !integracion.configurada} onClick={conectarWebhook}>
                  Conectar webhook
                </Button>
              </div>
            ) : null}

            {integracion.tipo === "calendly" ? (
              <RoundRobinCalendly programId={programId} valores={roundRobin} conectada={integracion.configurada} />
            ) : null}

            {integracion.tipo === "meta" ? (
              <div className="space-y-3 border-t border-border pt-3">
                <CuentasDelPrograma
                  programId={programId} conectada={integracion.configurada}
                  cuentas={cuentasMeta} disponibles={disponiblesMeta}
                  errorDeConsulta={errorMeta} puedeEditar
                />
                <Button type="button" size="sm" disabled={pendiente || !integracion.configurada} onClick={sincronizarMeta}>
                  {pendiente ? "Sincronizando…" : "Sincronizar ahora"}
                </Button>
              </div>
            ) : null}

            {integracion.tipo === "meta_capi" ? (
              <MetaCapi
                programId={programId}
                configurada={integracion.configurada}
                config={integracion.config}
                resumen={resumenCapi}
              />
            ) : null}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader><CardTitle className="text-base">Fuera de esta pestaña</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {fuentes.map((fuente) => (
            <div key={fuente.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{fuente.nombre} · {fuente.proveedor ?? "Webhook"}</span>
              <Badge variant={fuente.tieneSecreto ? "exito" : "alerta"}>
                {fuente.tieneSecreto ? "Firma configurada" : "Sin firma"}
              </Badge>
            </div>
          ))}
          {fuentes.some((fuente) => fuente.proveedor === "form30x") ? (
            <p className="text-muted-foreground">Form30x usa la llave de la compañía, configurada en el servidor.</p>
          ) : null}
          <Link className="font-medium text-marca-texto underline-offset-2 hover:underline" href={hrefCaptacion}>Ir a Captación</Link>
        </CardContent>
      </Card>
    </div>
  );
}

function MetaCapi({
  programId, configurada, config, resumen,
}: {
  programId: string;
  configurada: boolean;
  config: ConfigVisible;
  resumen: ResumenMetaCapi;
}) {
  const router = useRouter();
  const [datasetId, setDatasetId] = useState(typeof config.datasetId === "string" ? config.datasetId : "");
  const [encendido, setEncendido] = useState(config.encendido === true);
  const [codigo, setCodigo] = useState("");
  const [pendiente, startTransition] = useTransition();
  const ultimaPrueba = typeof config.ultimaPruebaEn === "string" ? config.ultimaPruebaEn : null;

  function guardarConfiguracion(siguiente = encendido) {
    startTransition(async () => {
      const resultado = await configurarMetaCapiAccion(programId, { datasetId, encendido: siguiente });
      if (!resultado.ok) {
        setEncendido(config.encendido === true);
        toast.error("No se pudo guardar Meta CAPI", { description: resultado.error });
        return;
      }
      toast.success("Configuración de Meta CAPI guardada");
      router.refresh();
    });
  }

  function probar() {
    startTransition(async () => {
      const resultado = await mandarPruebaMetaCapiAccion(programId, codigo);
      if (!resultado.ok) toast.error("La prueba falló", { description: resultado.error });
      else {
        setCodigo("");
        toast.success("Evento de prueba enviado");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 border-t border-border pt-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="space-y-1">
          <span className="text-sm font-medium">ID del dataset</span>
          <Input inputMode="numeric" pattern="[0-9]+" value={datasetId} onChange={(e) => setDatasetId(e.target.value)} disabled={!configurada || pendiente} />
        </label>
        <Button type="button" size="sm" variant="outline" disabled={!configurada || pendiente || !datasetId.trim()} onClick={() => guardarConfiguracion()}>
          Guardar ID
        </Button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Enviar ventas a Meta</p>
          <p className="text-xs text-muted-foreground">Solo se puede encender después de una prueba exitosa.</p>
        </div>
        <Switch
          checked={encendido}
          onCheckedChange={(checked) => { setEncendido(checked); guardarConfiguracion(checked); }}
          disabled={!configurada || pendiente}
          aria-label="Enviar ventas a Meta"
        />
      </div>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); probar(); }}>
        <label className="space-y-1">
          <span className="text-sm font-medium">Código del evento de prueba</span>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={!configurada || pendiente} placeholder="TEST12345" maxLength={200} />
        </label>
        <Button type="submit" size="sm" disabled={!configurada || pendiente || !codigo.trim()}>Mandar evento de prueba</Button>
        <p className="text-xs text-muted-foreground">
          {ultimaPrueba ? `Última prueba: ${new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(ultimaPrueba))}` : "Todavía no hay una prueba exitosa."}
        </p>
      </form>
      <div className="space-y-2">
        <p className="text-sm font-medium">Últimos 7 días</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="exito">{resumen.enviado} enviados</Badge>
          <Badge variant="alerta">{resumen.fallido} fallidos</Badge>
          <Badge variant="neutro">{resumen.vencido} vencidos</Badge>
          <Badge variant="neutro">{resumen.omitido} omitidos</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{resumen.enviadosConFbc} de {resumen.enviadosTotal} enviados con fbc</p>
      </div>
    </div>
  );
}

/**
 * El round robin de Calendly del programa (ADR 0098, ticket 289): su URL de agenda y la
 * marca de org compartida. Al guardar con URL, el servidor la resuelve a la URI del evento
 * por la API y la guarda; vacía, limpia la configuración. Todo por props: el cliente no lee
 * la base.
 */
function RoundRobinCalendly({
  programId,
  valores,
  conectada,
}: {
  programId: string;
  valores: { calendlyUrl: string | null; orgCompartida: boolean; configurado: boolean };
  conectada: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(valores.calendlyUrl ?? "");
  const [orgCompartida, setOrgCompartida] = useState(valores.orgCompartida);
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const resultado = await guardarRoundRobinAccion(programId, { calendlyUrl: url.trim(), orgCompartida });
      if (!resultado.ok) {
        toast.error("No se pudo guardar el round robin", { description: resultado.error });
        return;
      }
      toast.success("Round robin de Calendly guardado");
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-3 border-t border-border pt-3"
      onSubmit={(e) => { e.preventDefault(); guardar(); }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Round robin</span>
        <Badge variant={valores.configurado ? "exito" : "alerta"}>
          {valores.configurado ? "Configurado" : "Sin configurar"}
        </Badge>
      </div>
      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">URL del round robin</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendly.com/d/…"
          maxLength={500}
          aria-label="URL del round robin"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <span className="block text-xs text-muted-foreground">
          Déjala vacía para quitar el round robin del programa.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={orgCompartida}
          onChange={(e) => setOrgCompartida(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          La organización de Calendly la comparten otros programas
          <span className="block text-xs text-muted-foreground">
            Si se comparte, solo cuentan las citas del round robin y de los eventos personales de los closers.
          </span>
        </span>
      </label>
      <Button type="submit" size="sm" disabled={pendiente || !conectada}>
        {pendiente ? "Guardando…" : "Guardar round robin"}
      </Button>
    </form>
  );
}
