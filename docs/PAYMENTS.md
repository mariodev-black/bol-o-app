# Pagamentos PIX (3xPay)

Gateway ativo: **3xPay** (`https://gateway.3xpay.co`).

## Fluxo

1. `POST /api/deposits/transactions` → `createDepositTransaction()` cria tickets `pending_payment` e chama **cash-in**.
2. Resposta grava `provider_transaction_id`, `pix_qrcode` (`payment_code`) e status **`waiting_payment`** (mesmo que a API retorne `SUCCESS` no topo — isso só indica cash-in criado, não PIX pago).
3. Cliente paga o PIX; 3xPay envia webhook `POST /api/webhooks/threexpay`.
4. `updateTransactionStatusByProviderId()` marca transação/tickets como `paid` e dispara comissão + webhook opcional `PAYMENT_APPROVED_WEBHOOK_URL`.

## Resposta ao criar cash-in (exemplo real)

```json
{
  "status": "SUCCESS",
  "payment": {
    "status": "PENDING",
    "payment_code": "00020101...",
    "transaction_id": "f358c9ca-961d-4abb-b7cf-04032acc67cb"
  },
  "transaction_id": "f358c9ca-961d-4abb-b7cf-04032acc67cb"
}
```

| Campo | Significado no app |
|--------|---------------------|
| `status: SUCCESS` | Cash-in criado (API ok) — **não** é pagamento |
| `payment.status: PENDING` | PIX aguardando pagamento → gravamos `waiting_payment` |
| `payment.payment_code` | Copia e cola PIX |
| `payment.transaction_id` | `provider_transaction_id` no banco |

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

Payload (exemplo quando o PIX é pago):

```json
{
  "transactionId": "e2522acd-c5a7-4da9-930b-faf3fff78c80",
  "transactionStatus": "PAID",
  "transactionType": "CASH_IN",
  "value": "1",
  "externalId": "ticket_<uuid>",
  "e2e_id": "E00416968202605231956k5ZQTqICA0s",
  "debtorAccount": {
    "name": "NOME",
    "document": "14700168420",
    "accountType": "CHECKING"
  }
}
```

**Somente `transactionStatus: PAID`** dispara tickets pagos, comissão de afiliado e redirect no app. Outros status (ex. `PENDING`) retornam HTTP 200 com `ignored: true`.

A API deve responder **HTTP 200** para a 3xPay finalizar o fluxo.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `THREEXPAY_API_KEY` | Header `api_key` |
| `THREEXPAY_API_SECRET` | Header `api_secret` |

Se as credenciais contiverem `$` (formato bcrypt), no `.env` escape cada `$` com `\` (ex. `\$2a\$12\$...`). O Next.js expande `$VAR` e, sem escape, o secret fica vazio.
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

## Debug

```bash
npm run debug:threexpay
```

Mostra o JSON da 3xPay e como cada campo de status é interpretado. Útil se o checkout redirecionar sem pagar.

## Skale (legado)

Transações antigas podem ter `provider = 'skale'`. O endpoint `/api/webhooks/skale` retorna **410** — migre o callback no painel 3xPay.
