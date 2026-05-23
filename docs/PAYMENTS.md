# Pagamentos PIX (3xPay)

Gateway ativo: **3xPay** (`https://gateway.3xpay.co`).

## Fluxo

1. `POST /api/deposits/transactions` → `createDepositTransaction()` cria tickets `pending_payment` e chama **cash-in**.
2. Resposta grava `provider_transaction_id`, `pix_qrcode` (`payment_code`) e status `waiting_payment`.
3. Cliente paga o PIX; 3xPay envia webhook `POST /api/webhooks/threexpay`.
4. `updateTransactionStatusByProviderId()` marca transação/tickets como `paid` e dispara comissão + webhook opcional `PAYMENT_APPROVED_WEBHOOK_URL`.

## Criar cash-in

```http
POST https://gateway.3xpay.co/transaction/cash-in
api_key: ...
api_secret: ...
```

```json
{
  "transaction": {
    "amount": 39.9,
    "callback_url": "https://SEU_DOMINIO/api/webhooks/threexpay",
    "external_id": "ticket_<uuid>",
    "debtor": {
      "name": "Nome",
      "document": "12345678901"
    }
  }
}
```

`amount` é em **reais** (o app converte de centavos).

## Webhook (cash-in)

Configure na 3xPay a URL de callback (mesma de `THREEXPAY_CALLBACK_URL`).

Payload:

```json
{
  "transactionId": "uuid",
  "transactionStatus": "PAID",
  "transactionType": "CASH_IN",
  "value": "39.90",
  "externalId": "ticket_<uuid>",
  "e2e_id": "E..."
}
```

A API deve responder **HTTP 200** para a 3xPay finalizar o fluxo.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `THREEXPAY_API_KEY` | Header `api_key` |
| `THREEXPAY_API_SECRET` | Header `api_secret` |
| `THREEXPAY_API_URL` | Padrão `https://gateway.3xpay.co` |
| `THREEXPAY_CALLBACK_URL` | Webhook público (padrão `{APP_URL}/api/webhooks/threexpay`) |
| `THREEXPAY_WEBHOOK_SECRET` | Se definido, exige header `x-webhook-secret` |
| `THREEXPAY_PIX_EXPIRATION_SECONDS` | Expiração do PIX (padrão 86400) |

## Arquivos

| Arquivo | Função |
|---------|--------|
| `lib/payments/threexpay.ts` | Cliente cash-in |
| `lib/payments/gateway.ts` | Provider, URL webhook, conversão centavos → reais |
| `lib/payments/transactions.ts` | Orquestração DB + gateway |
| `app/api/webhooks/threexpay/route.ts` | Webhook 3xPay |

## Skale (legado)

Transações antigas podem ter `provider = 'skale'`. O endpoint `/api/webhooks/skale` retorna **410** — migre o callback no painel 3xPay.
