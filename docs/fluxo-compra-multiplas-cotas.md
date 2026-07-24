# Fluxo Completo — Compra de Múltiplas Cotas de Bolão

**Objetivo:** Permitir que o usuário compre mais de uma cota de bolão em uma única compra, com cálculo automático de total, validação de saldo e geração correta das cotas.

**Branch:** `dev`  
**Status:** Implementado e enviado para o repositório remoto  
**Último commit:** `2306fee`

---

## 1. O que foi entregue

### Funcionalidades implementadas

- **Seletor de quantidade** no modal de compra (`[-] 1 [+]`)
- **Cálculo automático do total** conforme a quantidade muda
- **Validação de saldo** em tempo real
- **Botão dinâmico**: "Comprar agora" (saldo suficiente) ou "Adicionar saldo" (saldo insuficiente)
- **Compra de múltiplas cotas** no backend, com criação atômica dos tickets
- **Débito automático do saldo** da carteira
- **Atualização da carteira** após a compra
- **Redirecionamento** para tela de sucesso com resumo correto da quantidade
- **Proteção contra duplo clique** com `idempotencyKey`
- **Validações reforçadas no backend** (saldo, limite por usuário, janela de venda, dados cadastrais)

---

## 2. Fluxo do usuário

```
1. Usuário escolhe o bolão
   ↓
2. Clica em "Comprar cota"
   ↓
3. Modal abre mostrando:
   - Valor da cota
   - Saldo da carteira
   - Seletor de quantidade
   - Total atualizado
   - Mensagem de saldo suficiente/insuficiente
   ↓
4. Usuário escolhe a quantidade
   ↓
5. Sistema recalcula total e valida saldo
   ↓
6. Usuário clica em "Comprar agora"
   ↓
7. Backend valida tudo novamente e executa:
   - Débito do saldo
   - Criação das N cotas
   - Vinculação ao usuário
   - Atualização do histórico
   ↓
8. Usuário é redirecionado para tela de sucesso
   ↓
9. Tela de sucesso exibe a quantidade correta de cotas compradas
```

---

## 3. Arquivos criados

| Arquivo | Descrição |
|---|---|
| `app/components/QuantitySelector.tsx` | Componente reutilizável de seleção de quantidade (`[-] 1 [+]`) |
| `app/api/boloes/comprar/route.ts` | Novo endpoint backend que recebe `{ bolaoId, quantidade }` e processa a compra |
| `scripts/seed-test-wallet-balance.ts` | Script para adicionar saldo na conta de teste local |
| `docs/relatorio-revisao-compra-boloes.md` | Relatório técnico da revisão completa |

## 4. Arquivos modificados

| Arquivo | Descrição |
|---|---|
| `app/components/BolaoPurchaseModal.tsx` | Modal de compra refatorado para suportar quantidade, total, saldo e botão dinâmico |
| `app/api/deposits/transactions/route.ts` | API legada ajustada para `idempotencyKey` e limites de quantidade |
| `lib/payments/transactions.ts` | Funções de compra com saldo reforçadas com validações e idempotência |
| `lib/boloes/definitions/purchase.ts` | Validação de `startsAt`/`endsAt` na janela de compra |
| `lib/ticket-shop-flags.ts` | Helpers para validar flags de loja no backend |
| `.env` | `WALLET_CHECKOUT_ENABLED=true` no ambiente de dev |

---

## 5. Commits enviados para a `dev`

```
dfb6091 fix: habilita checkout com saldo e adiciona guarda no modal de compra
89e8557 chore: adiciona script de seed de saldo para usuário de teste
a069999 feat: compra de multiplas cotas no modal de bolao
5ae2866 fix: reforca regras de negocio da compra de boloes
9ed106b feat: endpoint backend para compra de multiplas cotas por bolaoId
1455c24 fix: remove dupla requisicao de config e melhora estados de loading no modal
a83203f docs: adiciona relatorio de revisao da compra de boloes
2306fee fix: passa quantidade correta para tela de obrigado
```

---

## 6. Validações técnicas

| Verificação | Resultado |
|---|---|
| TypeScript (`npx tsc --noEmit`) | ✅ Sem erros |
| ESLint nos arquivos modificados | ✅ Sem erros |
| Atomicidade da compra | ✅ BEGIN / COMMIT / ROLLBACK |
| Idempotência | ✅ `idempotencyKey` no backend |
| Revalidação no servidor | ✅ Toda regra validada novamente no backend |

---

## 7. Como testar

### 7.1 Localmente

```bash
npm install
npm run dev
```

Acessar: `http://localhost:3000`

### 7.2 Conta de teste

- **Email:** `teste@bolao.com`
- **Senha:** `Teste@2026`

### 7.3 Adicionar saldo na conta de teste

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/seed-test-wallet-balance.ts 100.00
```

### 7.4 Cenários de teste recomendados

- Comprar 1 cota
- Comprar 2 cotas
- Comprar 5 cotas
- Comprar 10 cotas
- Saldo exatamente igual ao total
- Saldo maior que o total
- Saldo menor que o total
- Tentar duplo clique no botão de compra

---

## 8. Problemas conhecidos / Pendentes

| Item | Descrição | Prioridade |
|---|---|---|
| Tela "Meus Bolões" (`/boloes/tickets`) | Ainda usa dados mockados. Os tickets reais são criados no banco, mas essa página não os exibe ainda. | Média |
| Senha do banco local | A senha do `.env` para `bolao_user` não está autenticando no Postgres local. Impede testes de integração completos no ambiente local. | Alta (ambiente) |
| ESLint do projeto inteiro | Existem erros e warnings pré-existentes em outros arquivos, não relacionados a esta entrega. | Baixa |

---

## 9. Próximos passos sugeridos

1. Corrigir a senha do banco local para permitir testes de integração completos.
2. Integrar dados reais na tela `/boloes/tickets` (Meus Bolões).
3. Executar testes manuais dos cenários listados na seção 7.4.
4. Promover a `dev` para `main` quando validado.

---

## 10. Resumo para o chefe

> Foi implementada a compra de múltiplas cotas de bolão. O usuário pode selecionar a quantidade, o total é recalculado automaticamente, o saldo é validado e o backend cria todas as cotas de forma atômica. Todas as regras de negócio são revalidadas no servidor. A entrega está na branch `dev`, com TypeScript e ESLint validados nos arquivos alterados.
