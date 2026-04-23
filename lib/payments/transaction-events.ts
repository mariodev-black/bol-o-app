import { EventEmitter } from "events";

type TransactionEventPayload = {
  transactionId: string;
  status: string;
  pixQrcode: string | null;
  providerTransactionId: string | null;
};

const bus = new EventEmitter();
bus.setMaxListeners(200);

function eventName(transactionId: string): string {
  return `transaction:${transactionId}`;
}

export function publishTransactionEvent(payload: TransactionEventPayload): void {
  bus.emit(eventName(payload.transactionId), payload);
}

export function subscribeTransactionEvent(
  transactionId: string,
  listener: (payload: TransactionEventPayload) => void
): () => void {
  const name = eventName(transactionId);
  bus.on(name, listener);
  return () => bus.off(name, listener);
}

