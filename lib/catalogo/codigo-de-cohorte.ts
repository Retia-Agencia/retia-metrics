export function siguienteCodigoDeCohorte(codigos: string[]): string {
  const mayor = codigos.reduce((maximo, codigo) => {
    const coincidencia = /^C(\d+)$/i.exec(codigo.trim());
    return coincidencia ? Math.max(maximo, Number(coincidencia[1])) : maximo;
  }, 0);

  return `C${mayor + 1}`;
}
