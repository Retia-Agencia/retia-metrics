import { Enlace } from "@/components/enlace";
import { Pestanas, type GrupoDePestanas } from "@/components/layout/pestanas";
import { TablaLlamadasDelDia } from "@/components/mi-espacio/tabla-llamadas-del-dia";
import { PendientesDeMiDia } from "@/components/mi-espacio/pendientes-de-mi-dia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/format";
import type { DatosDeMiEspacio } from "@/lib/mi-espacio/cargar-datos";
import type { TipoDePendiente } from "@/lib/mi-espacio/pendientes";
import { origenDeLaPagina } from "@/lib/navegacion/volver";

type DatosMiDia = NonNullable<Extract<DatosDeMiEspacio["deSeccion"], { id: "mi-dia" }>>["datos"];

export function TabMiDia({ slug, datos }: { slug: string; datos: DatosMiDia }) {
  const base = { tab: "mi-dia", programa: slug };
  const href = (cambios: Record<string, string | undefined>) => {
    const params = new URLSearchParams({
      ...base,
      rango: datos.rango,
      ...(datos.soloSinConfirmar ? { conf: "sin" } : {}),
      orden: datos.orden,
      dir: datos.dir,
      ...(datos.tipoPendiente ? { tipo: datos.tipoPendiente } : {}),
    });
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor == null) params.delete(clave);
      else params.set(clave, valor);
    }
    return `/mi-espacio?${params.toString()}`;
  };
  const grupos: GrupoDePestanas[] = [{
    pestanas: [
      { id: "hoy", etiqueta: "Hoy", descripcion: "Llamadas de hoy.", href: href({ rango: "hoy" }) },
      { id: "manana", etiqueta: "Mañana", descripcion: "Llamadas de mañana.", href: href({ rango: "manana" }) },
      { id: "semana", etiqueta: "Esta semana", descripcion: "Llamadas de hoy y los próximos seis días.", href: href({ rango: "semana" }) },
    ],
  }];
  const hrefOrden = (orden: "hora" | "lead" | "estado") => href({
    orden,
    dir: datos.orden === orden && datos.dir === "asc" ? "desc" : "asc",
  });
  const busquedaOrigen = {
    ...base,
    rango: datos.rango,
    ...(datos.soloSinConfirmar ? { conf: "sin" } : {}),
    orden: datos.orden,
    dir: datos.dir,
    ...(datos.tipoPendiente ? { tipo: datos.tipoPendiente } : {}),
  };
  const origen = origenDeLaPagina("/mi-espacio", busquedaOrigen);
  const resumen = [
    { etiqueta: "Llamadas hoy", valor: num(datos.resumen.llamadasHoy) },
    { etiqueta: "Confirmadas", valor: `${num(datos.resumen.confirmadas)} de ${num(datos.resumen.llamadasHoy)}` },
    { etiqueta: "Vencidos", valor: num(datos.resumen.vencidos) },
    { etiqueta: "Para hoy", valor: num(datos.resumen.paraHoy) },
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="resumen-mi-dia">
        <h2 id="resumen-mi-dia" className="font-heading text-lg font-semibold">Resumen</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {resumen.map((item) => (
            <Card key={item.etiqueta} size="sm">
              <CardHeader><CardTitle>{item.etiqueta}</CardTitle></CardHeader>
              <CardContent className="cifra text-2xl font-semibold">{item.valor}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="llamadas-mi-dia">
        <h2 id="llamadas-mi-dia" className="font-heading text-lg font-semibold">Mis llamadas</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Pestanas grupos={grupos} activa={datos.rango} etiqueta="Rango de llamadas" />
          <Enlace
            precarga="navegacion"
            href={href({ conf: datos.soloSinConfirmar ? undefined : "sin" })}
            aria-current={datos.soloSinConfirmar ? "page" : undefined}
            className={datos.soloSinConfirmar
              ? "rounded-lg bg-marca-suave px-3 py-1.5 text-sm font-medium text-marca"
              : "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"}
          >
            Solo sin confirmar
          </Enlace>
        </div>
        <TablaLlamadasDelDia
          key={`${slug}:${datos.rango}:${datos.soloSinConfirmar}:${datos.orden}:${datos.dir}`}
          llamadas={datos.filas}
          programaSlug={slug}
          motivosReagenda={datos.motivosReagenda}
          ahora={datos.ahora}
          hrefOrden={{ hora: hrefOrden("hora"), lead: hrefOrden("lead"), estado: hrefOrden("estado") }}
          orden={datos.orden}
          dir={datos.dir}
          origen={origen}
        />
      </section>

      <PendientesDeMiDia
        filas={datos.pendientes}
        tipoActivo={datos.tipoPendiente}
        programaSlug={slug}
        origen={origen}
        hrefDeTipo={(tipo: TipoDePendiente | null) => href({ tipo: tipo ?? undefined })}
      />
    </div>
  );
}
