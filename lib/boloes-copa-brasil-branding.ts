/** Identifica nome de campeonato “Copa do Brasil” (API / metadados) para ícone e copy. */
export function isCopaDoBrasilChampionshipTitle(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return n.includes("copa") && n.includes("brasil");
}
