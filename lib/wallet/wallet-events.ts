import { EventEmitter } from "node:events";
import { getPool } from "@/lib/db";
import { WALLET_NOTIFY_CHANNEL } from "@/lib/wallet/ledger";

/**
 * Tempo real do saldo. UM cliente PG por processo Node faz `LISTEN wallet_balance`
 * e repassa cada notificação para um EventEmitter em memória. Cada conexão SSE
 * assina o emitter filtrando pelo userId — assim N usuários compartilham 1 única
 * conexão de LISTEN (escala em PM2/VPS sem estourar o pool).
 */
declare global {
  // eslint-disable-next-line no-var
  var __bolaoWalletEvents:
    | { emitter: EventEmitter; started: Promise<void> | null }
    | undefined;
}

function store() {
  if (!globalThis.__bolaoWalletEvents) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0); // muitos assinantes SSE simultâneos
    globalThis.__bolaoWalletEvents = { emitter, started: null };
  }
  return globalThis.__bolaoWalletEvents;
}

function ensureListening(): Promise<void> {
  const s = store();
  if (s.started) return s.started;
  s.started = (async () => {
    const client = await getPool().connect();
    client.on("notification", (msg) => {
      if (msg.channel !== WALLET_NOTIFY_CHANNEL || !msg.payload) return;
      try {
        const data = JSON.parse(msg.payload) as { userId?: string; balanceCents?: number };
        if (data.userId && typeof data.balanceCents === "number") {
          store().emitter.emit(`u:${data.userId}`, data.balanceCents);
        }
      } catch {
        /* payload malformado — ignora */
      }
    });
    client.on("error", (e) => {
      console.error("[wallet-events] listen client error", e);
      // Permite re-início numa próxima assinatura.
      store().started = null;
    });
    // WALLET_NOTIFY_CHANNEL é constante do código (sem input do usuário).
    await client.query(`LISTEN ${WALLET_NOTIFY_CHANNEL}`);
    // Cliente fica vivo durante todo o processo (nunca released).
  })().catch((e) => {
    console.error("[wallet-events] failed to start LISTEN", e);
    store().started = null;
    throw e;
  });
  return s.started;
}

/** Assina o saldo de um usuário. Retorna a função de cancelamento. */
export async function subscribeWalletBalance(
  userId: string,
  cb: (balanceCents: number) => void
): Promise<() => void> {
  await ensureListening();
  const key = `u:${userId.trim()}`;
  store().emitter.on(key, cb);
  return () => {
    store().emitter.off(key, cb);
  };
}
