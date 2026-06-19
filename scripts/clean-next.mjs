import { rmSync } from "node:fs";

/** Remove `.next` antes do build — evita validator.ts corrompido (dev + build ao mesmo tempo). */
try {
  rmSync(".next", { recursive: true, force: true });
  console.log("[clean-next] .next removido");
} catch {
  // pasta inexistente
}
