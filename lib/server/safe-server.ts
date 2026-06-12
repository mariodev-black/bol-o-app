import { unstable_rethrow } from "next/navigation";

/**
 * Executa loader de Server Component sem derrubar a rota.
 * Re-lança sinais internos do Next (`redirect`, `notFound`, etc.).
 */
export async function runSafeServerPage<T>(
  label: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[safe-server:${label}]`, error);
    return fallback;
  }
}

export function runSafeServerPageSync<T>(
  label: string,
  loader: () => T,
  fallback: T,
): T {
  try {
    return loader();
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[safe-server:${label}]`, error);
    return fallback;
  }
}
