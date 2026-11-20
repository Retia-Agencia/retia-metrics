export const CLAVES_DE_PASO = [
  "datos",
  "calendly",
  "fuente_principal",
  "equipo",
  "cohorte_activa",
  "plataforma_pago",
  "cuenta_meta",
] as const;

export type ClaveDePaso = (typeof CLAVES_DE_PASO)[number];

export const SECCIONES_DE_LA_FICHA = ["programa", "ventas", "integraciones"] as const;

export type SeccionDeLaFicha = (typeof SECCIONES_DE_LA_FICHA)[number];

export const SECCION_VIEJA_DE_LA_FICHA: Readonly<Record<string, SeccionDeLaFicha>> = {
  general: "programa",
  equipo: "programa",
  captacion: "integraciones",
};

export function seccionDeLaFicha(valor: string | undefined): string | undefined {
  return valor === undefined ? undefined : (SECCION_VIEJA_DE_LA_FICHA[valor] ?? valor);
}

export type HechosDeConfiguracion = {
  pagoRapidoDefinido: boolean;
  tieneTokenCalendly: boolean;
  tieneFuentePrincipal: boolean;
  webhookCalendlyConectado: boolean;
  miembrosActivos: number;
  tieneCohorteActiva: boolean;
  plataformasDePago: number;
  cuentasMeta: number;
};

export const PASOS_DE_CONFIGURACION: Record<
  ClaveDePaso,
  {
    titulo: string;
    explicacion: string;
    exigidoParaActivar: boolean;
    seccion: SeccionDeLaFicha;
    hecho: (h: HechosDeConfiguracion) => boolean;
  }
> = {
  datos: {
    titulo: "Datos comerciales",
    explicacion: "El corte de pago rápido.",
    exigidoParaActivar: false,
    seccion: "programa",
    hecho: (h) => h.pagoRapidoDefinido,
  },
  calendly: {
    titulo: "Calendly",
    explicacion: "El token y los avisos en vivo, para que el CRM vea cada cita y la cuelgue de su persona.",
    exigidoParaActivar: true,
    seccion: "integraciones",
    hecho: (h) => h.tieneTokenCalendly && h.webhookCalendlyConectado,
  },
  fuente_principal: {
    titulo: "Formulario principal",
    explicacion: "El formulario al que llevan todos los links de captación.",
    exigidoParaActivar: true,
    seccion: "integraciones",
    hecho: (h) => h.tieneFuentePrincipal,
  },
  equipo: {
    titulo: "Equipo",
    explicacion: "Quién recibe y trabaja los deals.",
    exigidoParaActivar: false,
    seccion: "programa",
    hecho: (h) => h.miembrosActivos > 0,
  },
  cohorte_activa: {
    titulo: "Cohorte activa",
    explicacion: "La cohorte que se está vendiendo y su meta.",
    exigidoParaActivar: false,
    seccion: "ventas",
    hecho: (h) => h.tieneCohorteActiva,
  },
  plataforma_pago: {
    titulo: "Plataforma de pago",
    explicacion: "Con qué se cobran los abonos.",
    exigidoParaActivar: false,
    seccion: "ventas",
    hecho: (h) => h.plataformasDePago > 0,
  },
  cuenta_meta: {
    titulo: "Cuenta de Meta",
    explicacion: "Para leer el gasto de pauta y el ROAS.",
    exigidoParaActivar: false,
    seccion: "integraciones",
    hecho: (h) => h.cuentasMeta > 0,
  },
};

export type PasoVisible = {
  clave: ClaveDePaso;
  titulo: string;
  explicacion: string;
  exigidoParaActivar: boolean;
  seccion: SeccionDeLaFicha;
  hecho: boolean;
};

export function pasosDeConfiguracion(h: HechosDeConfiguracion): PasoVisible[] {
  return CLAVES_DE_PASO.map((clave) => {
    const paso = PASOS_DE_CONFIGURACION[clave];
    return { clave, ...paso, hecho: paso.hecho(h) };
  });
}

export function pasosPendientes(
  h: HechosDeConfiguracion,
  { soloExigidos }: { soloExigidos: boolean },
): PasoVisible[] {
  return pasosDeConfiguracion(h).filter(
    (paso) => !paso.hecho && (!soloExigidos || paso.exigidoParaActivar),
  );
}

export function mensajeDeActivacionBloqueada(pendientes: PasoVisible[]): string {
  return `Todavía no se puede activar el programa. Falta: ${pendientes.map((paso) => paso.titulo).join(" y ")}.`;
}
