/** Apelido público exibido no ranking. Regras: ≤20 chars, trim, sem palavrão. */

export const NICKNAME_MAX_LENGTH = 20;

/** Remove acentos e baixa caixa — para detecção de palavrão. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Palavras curtas/siglas — só bloqueia como palavra inteira (evita falso positivo). */
const PROFANITY_WHOLE_WORD = [
  "cu", "fdp", "krl", "pqp", "pnc", "tnc", "vsf", "vtnc", "vtmnc",
];

/** Termos ofensivos — bloqueia como substring (após normalizar). */
const PROFANITY_SUBSTRING = [
  "caralho", "carai", "porra", "merda", "bosta", "cacete",
  "puta", "puto", "putaria", "piranha", "vagabund", "vadia",
  "buceta", "boceta", "xoxota", "xereca", "pepeca",
  "viado", "viadinho", "viadagem", "bicha", "traveco", "sapatao",
  "arrombado", "corno", "cornn", "escroto", "babaca", "otario",
  "desgraca", "filhadaputa", "filhodaputa", "fdputa",
  "foder", "fodase", "fudido", "fudida", "fodac", "fodao",
  "cuzao", "cuzinho", "rola", "pinto", "penis", "pica",
  "estupr", "pedofil", "racist", "nazis", "hitler",
  "retardad", "mongoloid", "aborto",
];

function containsProfanity(value: string): boolean {
  const norm = normalize(value);
  const collapsed = norm.replace(/[^a-z0-9]/g, "");
  for (const term of PROFANITY_SUBSTRING) {
    if (norm.includes(term) || collapsed.includes(term)) return true;
  }
  const words = norm.split(/[^a-z0-9]+/).filter(Boolean);
  for (const w of words) {
    if (PROFANITY_WHOLE_WORD.includes(w)) return true;
  }
  return false;
}

export type NicknameResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Valida/normaliza o nickname.
 * - trim + colapsa espaços internos
 * - vazio ⇒ null (usa o nome do cadastro)
 * - > 20 chars ⇒ erro
 * - palavrão ⇒ erro
 */
export function sanitizeNickname(raw: unknown): NicknameResult {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "Nickname inválido." };
  }
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed === "") return { ok: true, value: null };
  if (collapsed.length > NICKNAME_MAX_LENGTH) {
    return { ok: false, error: `O nickname deve ter no máximo ${NICKNAME_MAX_LENGTH} caracteres.` };
  }
  if (containsProfanity(collapsed)) {
    return { ok: false, error: "Esse nickname contém palavras não permitidas." };
  }
  return { ok: true, value: collapsed };
}
