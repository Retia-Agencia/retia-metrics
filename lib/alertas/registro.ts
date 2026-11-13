import { num } from "@/lib/format";
import { saludDeFuentes, type SaludDeFuenteConDatos } from "@/lib/queries/salud-fuentes";
import type { Db } from "@/lib/db/tipos";

export type TipoDeAlerta =
  | "fuente_silenciosa"
  | "sobres_con_error"
  | "completos_sin_calidad"
  | "lectura_form30x_vieja"
  | "traza_de_pauta_rota";

type DefinicionDeAlerta = {
  severidad: "critica" | "aviso";
  deFuente(fuente: SaludDeFuenteConDatos, ahora: Date): string | null;
};

const destino = "Revisar en Ajustes › Webhook Health.";
const contexto = (fuente: SaludDeFuenteConDatos) => `${fuente.programaNombre} · ${fuente.nombre}`;

export const REGISTRO_DE_ALERTAS = {
  fuente_silenciosa: {
    severidad: "critica",
    deFuente: (fuente, ahora) => {
      if (!["sin_respuestas", "muerta", "sin_envios"].includes(fuente.estado)) return null;
      const silencio = fuente.ultimo
        ? `lleva ${num(Math.round((ahora.getTime() - fuente.ultimo.getTime()) / 3_600_000))} horas sin envíos`
        : "nunca recibió envíos";
      return `🔴 ${contexto(fuente)}: ${silencio}. ${destino}`;
    },
  },
  sobres_con_error: {
    severidad: "critica",
    deFuente: (fuente) => fuente.sobresPendientes > 0
      ? `🔴 ${contexto(fuente)}: ${fuente.sobresPendientes === 1 ? "1 sobre tiene error" : `${num(fuente.sobresPendientes)} sobres tienen error`}. ${destino}`
      : null,
  },
  completos_sin_calidad: {
    severidad: "aviso",
    deFuente: (fuente) => fuente.sinCalidad > 0
      ? `🟡 ${contexto(fuente)}: ${num(fuente.sinCalidad)} envíos completos llegaron sin calidad. ${destino}`
      : null,
  },
  lectura_form30x_vieja: {
    severidad: "aviso",
    deFuente: (fuente) => fuente.lecturaVieja
      ? `🟡 ${contexto(fuente)}: la lectura de Form30x está desactualizada. ${destino}`
      : null,
  },
  traza_de_pauta_rota: {
    severidad: "aviso",
    deFuente: (fuente) => {
      if (!fuente.trazaRota && !fuente.fbclidRoto) return null;
      const problemas = [
        fuente.trazaRota ? `${num(fuente.pagosSinId)} sin identificador del anuncio` : null,
        fuente.fbclidRoto ? `${num(fuente.pagosSinFbclid)} sin identificador del clic` : null,
      ].filter((problema): problema is string => problema !== null).join(" y ");
      return `🟡 ${contexto(fuente)}: de ${num(fuente.pagos)} envíos pagos, ${problemas}. ${destino}`;
    },
  },
} satisfies Record<TipoDeAlerta, DefinicionDeAlerta>;

export const TIPOS_DE_ALERTA = Object.keys(REGISTRO_DE_ALERTAS) as [TipoDeAlerta, ...TipoDeAlerta[]];

export async function alertasActivas(db: Db, ahora: Date) {
  const fuentes = await saludDeFuentes(db, ahora);
  return fuentes.flatMap((fuente) => {
    return TIPOS_DE_ALERTA.flatMap((tipo) => {
      const definicion = REGISTRO_DE_ALERTAS[tipo];
      const texto = definicion.deFuente(fuente, ahora);
      return texto === null ? [] : [{
        clave: `${tipo}:${fuente.sourceId}`,
        tipo,
        severidad: definicion.severidad,
        texto,
      }];
    });
  }).sort((a, b) => a.clave.localeCompare(b.clave));
}
