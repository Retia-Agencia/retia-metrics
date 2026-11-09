function sinBarraFinal(valor: string): string {
  return valor.replace(/\/+$/, "");
}

export function origenDeLaApp(): string {
  return sinBarraFinal(process.env.AUTH_URL ?? "http://localhost:3000");
}

export function urlDelRecurso(): string {
  return `${origenDeLaApp()}/api/mcp`;
}

export const issuer = origenDeLaApp;
