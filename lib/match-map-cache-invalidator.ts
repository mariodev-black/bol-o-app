/** Evita ciclo matches-cache ↔ football-api: quem mantém o mapa em RAM registra o invalidador aqui. */
type InvalidateFn = () => void;
let invalidateFn: InvalidateFn | null = null;

export function registerMatchMapMemoryInvalidate(fn: InvalidateFn): void {
  invalidateFn = fn;
}

export function invalidateMatchMapMemoryAfterDbWrite(): void {
  invalidateFn?.();
}
