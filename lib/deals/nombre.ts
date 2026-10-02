export function nombreDelDeal({
  leadNombre,
  leadEmail,
  programaNombre,
  cohorteCodigo,
}: {
  leadNombre: string | null;
  leadEmail: string;
  programaNombre: string;
  cohorteCodigo: string | null;
}): string {
  return `${leadNombre ?? leadEmail} | ${programaNombre} | ${cohorteCodigo ?? "Sin cohorte"}`;
}
