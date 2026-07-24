# Relatório de Revisão — Compra de Múltiplas Cotas de Bolão

**Data:** 2026-07-20  
**Branch:** `dev`  
**Último commit revisado:** `1455c24`

---

## 1. Resumo

Foi realizada uma revisão completa do fluxo de compra de bolões com múltiplas cotas, cobrindo frontend, API legada, novo endpoint `/api/boloes/comprar`, regras de negócio no backend, criação atômica de tickets e débito de saldo.

A maioria dos cenários críticos foi coberta por análise estática (TypeScript + ESLint) e revisão de código. **Não foi possível executar testes de integração via API** porque a senha do banco local (`bolao_user`) no `.env` ainda está incorreta — o servidor sobe, mas todas as conexões com o Postgres são recusadas com `FATAL: autenticação do tipo senha falhou`.

---

## 2. Validações Estáticas

| Ferramenta | Resultado | Observação |
|---|---|---|
| `npx tsc --noEmit` | ✅ Sem erros | Todo o projeto passou na checagem de tipos. |
| `npx eslint` (arquivos modificados) | ✅ Sem erros/warnings | `app/components/BolaoPurchaseModal.tsx`, `app/components/QuantitySelector.tsx`, `app/api/boloes/comprar/route.ts`, `app/api/deposits/transactions/route.ts`, `lib/payments/transactions.ts`, `lib/boloes/definitions/purchase.ts`, `lib/ticket-shop-flags.ts`. |
| `npx eslint` (projeto inteiro) | ⚠️ Falhas pré-existentes | Erros/warnings em outros arquivos do projeto, não relacionados às alterações desta tarefa. |

---

## 3. Cenários de Teste — Análise de Código

### 3.1 Quantidade de cotas

| Cenário | Status | Como é tratado |
|---|---|---|
| Comprar 1 cota | ✅ | `QuantitySelector` min=1; backend valida `quantity >= 1`. |
| Comprar 2 cotas | ✅ | Desconto progressivo de 5% aplicado no total. |
| Comprar 5 cotas | ✅ | Desconto progressivo de 15% aplicado no total. |
| Comprar 10 cotas | ✅ | Limitado a 20 no frontend e backend. |
| Quantidade mínima | ✅ | Impede valor < 1 no input e no schema. |
| Quantidade máxima | ✅ | Limitado a 20 (ou `maxTicketsPerUser` se menor). |

### 3.2 Saldo

| Cenário | Status | Como é tratado |
|---|---|---|
| Saldo exatamente igual ao total | ✅ | `balance >= totalCents` permite compra. Backend debita o valor exato. |
| Saldo maior | ✅ | Compra permitida; saldo remanescente atualizado. |
| Saldo menor | ✅ | Botão vira "Adicionar saldo"; backend retorna 402 se tentar bypass. |

### 3.3 Atualizações de UI

| Cenário | Status | Observação |
|---|---|---|
| Atualização do total | ✅ | `useMemo` recalcula ao alterar quantidade. |
| Atualização do botão | ✅ | Alterna entre "Carregando…", "Adicionar saldo" e "Comprar agora". |
| Atualização da mensagem | ✅ | Alterna entre sucesso/insuficiência com transições. |
| Atualização da carteira | ✅ | Após compra, chama `refresh()` do `AuthContext`. |
| Atualização de Meus Bolões | ⚠️ Parcial | Tickets são criados corretamente no banco, mas a página `/boloes/tickets` ainda usa dados mockados. |
| Redirecionamento após compra | ✅ | Redireciona para `/tickets/obrigado?tx=...`. |
| Fluxo de adicionar saldo | ✅ | Link para `/carteira` quando saldo insuficiente. |

### 3.4 Robustez

| Cenário | Status | Como é tratado |
|---|---|---|
| Duplo clique | ✅ | Botão desabilitado durante `submitting` + `idempotencyKey` no backend. |
| Race condition no carregamento | ✅ Corrigido | Removido `useEffect` duplicado que carregava config separadamente. |
| Estados de loading | ✅ Corrigido | Botão mostra "Carregando…" enquanto saldo/preço não estão prontos. |
| Tratamento de erros | ✅ | Erros de rede, 402, 403 e 400 exibem mensagem no modal. |
| Compra parcial | ✅ Impedida | Todo o fluxo roda dentro de BEGIN/COMMIT/ROLLBACK. |
| Saldo negativo | ✅ Impedido | `FOR UPDATE` + verificação `amountCents > total` antes do débito. |

---

## 4. Problemas Encontrados e Correções Aplicadas

### 4.1 Mensagem contraditória com saldo suficiente

**Problema:** Quando `walletCheckoutEnabled` era `false`, o modal mostrava "Pagamento com saldo indisponível" mesmo se o usuário tivesse saldo.

**Correção:** Reordenada a lógica do botão para primeiro verificar saldo, depois verificar se o checkout está habilitado.

**Arquivo:** `app/components/BolaoPurchaseModal.tsx`

### 4.2 Cálculo de total sem desconto progressivo

**Problema:** O total exibido no modal era `preço × quantidade`, mas o backend aplica desconto progressivo (5%/10%/15%).

**Correção:** Adicionada função `calculateTotalCents` no frontend que replica a curva de desconto progressivo.

**Arquivo:** `app/components/BolaoPurchaseModal.tsx`

### 4.3 Limite `maxTicketsPerUser` ignorado no envio

**Problema:** `purchaseBodyForItem` limitava a 20, ignorando o limite específico da definição.

**Correção:** Agora usa `resolveMaxQuantity(item)` para clamp no corpo da requisição.

**Arquivo:** `app/components/BolaoPurchaseModal.tsx`

### 4.4 Dupla requisição de config/saldo

**Problema:** Dois `useEffect` carregavam config/saldo de formas diferentes, podendo causar estados inconsistentes.

**Correção:** Removido o `useEffect` de pré-carga separado; config e saldo são carregados unicamente quando o modal abre.

**Arquivo:** `app/components/BolaoPurchaseModal.tsx`

### 4.5 Estado de loading confuso

**Problema:** Enquanto saldo carregava, o botão já mostrava "Adicionar saldo".

**Correção:** Adicionado estado "Carregando…" desabilitado enquanto `balanceCents` ou `priceCents` não estão prontos.

**Arquivo:** `app/components/BolaoPurchaseModal.tsx`

### 4.6 Backend não validava dados cadastrais no pagamento com saldo

**Problema:** `createWalletPurchase` não validava nome, CPF, telefone e e-mail.

**Correção:** Criada `assertBillingUserComplete` compartilhada entre PIX e wallet.

**Arquivo:** `lib/payments/transactions.ts`

### 4.7 `maxTicketsPerUser` sem enforcement no backend

**Problema:** O limite existia no DB mas não era verificado na compra.

**Correção:** Adicionada contagem de tickets existentes do usuário por definição e validação do limite.

**Arquivo:** `lib/payments/transactions.ts`

### 4.8 Limite inconsistente de `dailyByEdition`/`skaleDailyByEdition`

**Problema:** Schema limitava a 5 enquanto frontend permitia 20.

**Correção:** Criada constante `MAX_TICKET_QUANTITY = 20` e aplicada em todos os schemas.

**Arquivo:** `app/api/deposits/transactions/route.ts`

### 4.9 Flags de loja não revalidadas no backend

**Problema:** `TICKETS_EXTRA_ONLY` e `TICKETS_HIDE_DAILY` só eram verificadas no frontend.

**Correção:** Adicionadas funções `isGeneralTicketShopEnabled()` e `isDailyTicketShopEnabled()` e validações em `resolvePurchaseLines`.

**Arquivos:** `lib/ticket-shop-flags.ts`, `lib/payments/transactions.ts`

### 4.10 `startsAt`/`endsAt` ignorados na janela de compra

**Problema:** `isBolaoDefinitionPurchaseOpen` não considerava o período de venda da definição.

**Correção:** Adicionada validação de `startsAt` e `endsAt`.

**Arquivo:** `lib/boloes/definitions/purchase.ts`

### 4.11 Falta de idempotência no checkout

**Problema:** Duplo clique ou retry poderia gerar compras duplicadas.

**Correção:** Adicionado `idempotencyKey` opcional no payload; backend retorna a compra existente se a mesma chave for reenviada.

**Arquivos:** `app/components/BolaoPurchaseModal.tsx`, `app/api/deposits/transactions/route.ts`, `lib/payments/transactions.ts`, `app/api/boloes/comprar/route.ts`

### 4.12 Resposta 402 não atualizava saldo corretamente

**Problema:** Frontend lia `data.purchase?.balanceCents`, mas backend retorna `availableCents` em 402.

**Correção:** Frontend agora lê `availableCents` quando disponível.

**Arquivo:** `app/components/BolaoPurchaseModal.tsx`

---

## 5. Arquivos Modificados

```
app/components/BolaoPurchaseModal.tsx
app/components/QuantitySelector.tsx
app/api/deposits/transactions/route.ts
app/api/boloes/comprar/route.ts        (novo)
lib/payments/transactions.ts
lib/boloes/definitions/purchase.ts
lib/ticket-shop-flags.ts
```

---

## 6. Problema Não Corrigido

### 6.1 Página `/boloes/tickets` usa dados mockados

A tela "Meus Bolões" (`app/(authenticated)/boloes/tickets/page.tsx`) possui um array `TICKETS` fixo no código. Os tickets reais são criados corretamente no banco e estão disponíveis via `/api/tickets/mine` (usado por `MyTicketsWallet`), mas essa página específica não os consome.

**Impacto:** O usuário não vê os tickets recém-comprados ao acessar `/boloes/tickets`.

**Recomendação:** Substituir a lista mockada por uma chamada a `/api/tickets/mine` ou integrar o componente `MyTicketsWallet` já existente.

---

## 7. Impedimento para Testes de Integração

A senha do banco local configurada em `.env` para `DATABASE_PASSWORD` não autentica no Postgres. O servidor Next.js sobe, mas todas as rotinas que acessam o banco falham com:

```
FATAL: autenticação do tipo senha falhou para o usuário "bolao_user"
```

Sem a senha correta, não foi possível:
- Criar/seedear usuário de teste com saldo.
- Testar os endpoints via `curl`/script.
- Validar a criação real de tickets e débito de saldo em ambiente local.

---

## 8. Possíveis Melhorias Futuras

1. **Testes automatizados:** Criar testes unitários/integração para `createWalletPurchase`, `createWalletPurchaseForDefinition` e `resolvePurchaseLines`.
2. **Integração do novo endpoint no modal:** Usar `POST /api/boloes/comprar` para definições do catálogo admin, simplificando o payload.
3. **Tela real de Meus Bolões:** Substituir `/boloes/tickets` por dados reais da API.
4. **Cache de idempotência:** Considerar TTL curto para chaves de idempotência no backend (atualmente permanecem enquanto a transação existir).
5. **Feedback de estoque/disponibilidade:** Exibir quantas cotas ainda restam considerando `maxTicketsPerUser`.
6. **Logging estruturado:** Adicionar logs no endpoint `/api/boloes/comprar` para auditoria.

---

## 9. Conclusão

O fluxo de compra de múltiplas cotas está **funcional e robusto do ponto de vista de código**, com validações reforçadas no frontend e backend, atomicidade no débito/criação de tickets e proteção contra duplo clique.

A única barreira para validação completa em ambiente local é a **senha incorreta do banco de dados**. Assim que a senha for corrigida, recomenda-se executar os cenários de compra listados na seção 3 para validação final.
