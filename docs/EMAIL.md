# E-mail e autenticação transacional

## Canais

| Fluxo | Canal | Quando |
|-------|--------|--------|
| Confirmação do cadastro (código 6 dígitos) | **WhatsApp** (SellFlux) | Passo 3 do `/cadastrar` |
| Boas-vindas | **Resend** | Após `POST /api/auth/register` com sucesso |
| Recuperar senha | **Resend** | `/recuperar-senha` (3 passos) |

O Resend **não** envia código de cadastro. Ver `lib/email/policy.ts`.

---

## Variáveis de produção (obrigatórias)

```env
APP_URL=https://app.bolaodomilhao.com.br
RESEND_API_KEY=re_...
EMAIL_FROM="Bolão do Milhão <noreply@mail.bolaodomilhao.com.br>"
REGISTRATION_WHATSAPP_WEBHOOK_URL=https://webhook.sellflux.app/...
```

Opcional: `EMAIL_REPLY_TO`, `REGISTRATION_WHATSAPP_WEBHOOK_SECRET`, `SMS_APP_NAME`.

**SellFlux (WhatsApp cadastro):** no template da automação, use `{{message}}` ou `{{codigo}}` como **texto** (não como número). Se `codigo` for numérico, códigos com zero à esquerda (ex. `042918`) chegam com 5 dígitos no WhatsApp. A API envia `codigo`, `code`, `verification_code` e `message` sempre como string de 6 caracteres.

---

## Resend (painel) — subdomínio

Recomendado usar um **subdomínio** só para e-mail (ex.: `mail.bolaodomilhao.com.br`), não o domínio raiz.

1. Criar API key em [resend.com](https://resend.com).
2. Em **Domains → Add Domain**, informe o subdomínio (`mail.bolaodomilhao.com.br`).
3. Publique os registros DNS (SPF, DKIM, etc.) que o Resend mostrar — no provedor do domínio.
4. Aguarde status **Verified**.
5. `EMAIL_FROM` deve usar esse subdomínio, por exemplo:
   - `noreply@mail.bolaodomilhao.com.br`
   - `contato@mail.bolaodomilhao.com.br`

O prefixo (`noreply`, `contato`) pode ser outro; o que precisa bater é o **subdomínio verificado**.

6. Logo **dentro** do e-mail: anexo inline (CID) no envio; fallback `{APP_URL}/email/logo-email.png`.

---

## Logo no avatar do Gmail (círculo ao lado do remetente)

Esse ícone **não** é configurado no template HTML nem no Resend diretamente. O Gmail (e outros) usam o padrão **BIMI** (*Brand Indicators for Message Identification*): um registro DNS + logo em SVG + certificado.

### O que já ajuda (mas não basta sozinho)

- Domínio `mail.bolaodomilhao.com.br` verificado no Resend (SPF + DKIM).
- `EMAIL_FROM` usando esse subdomínio.
- DMARC básico que o Resend orienta no painel.

Sem BIMI completo, o Gmail mostra o avatar genérico (silhueta azul).

### O que é obrigatório para o logo aparecer no Gmail

| Etapa | O que fazer |
|--------|-------------|
| 1. DMARC forte | TXT em `_dmarc.mail.bolaodomilhao.com.br` (e no domínio raiz) com `p=quarantine` ou `p=reject` e `pct=100`. Ver [DMARC no Resend](https://resend.com/docs/dashboard/domains/dmarc). |
| 2. Logo BIMI | SVG quadrado 1:1, fundo sólido, formato **SVG Tiny P/S**, &lt; 32 KB, em HTTPS (ex.: `https://app.bolaodomilhao.com.br/bimi/logo.svg`). Gerar em [BIMI Group – SVG logo](https://bimigroup.org/creating-bimi-svg-logo-files/). Use versão **ícone** (só o símbolo), não o logo horizontal inteiro. |
| 3. Certificado | **VMC** (marca registrada no INPI) ou **CMC** (logo usado há 1+ ano). Emitido por DigiCert, GlobalSign, SSL.com, etc. (~US$ 1.000+/ano no VMC). |
| 4. DNS BIMI | TXT em `default._bimi.mail.bolaodomilhao.com.br`: `v=BIMI1; l=https://.../logo.svg; a=https://.../certificado.pem;` |
| 5. Propagação | Pode levar **dias ou semanas** após DNS + certificado. O Gmail também exige boa reputação de envio (baixo spam/bounce). |

Guia completo no Resend: [Implementing BIMI](https://resend.com/docs/dashboard/domains/bimi).

### Resumo prático

1. No painel Resend → domínio → configure **DMARC** (`p=quarantine; pct=100`).
2. Crie um **ícone quadrado** da marca (fundo escuro + “B” verde) e converta para SVG Tiny P/S.
3. Publique o `.svg` em URL pública HTTPS no app ou CDN.
4. Compre **VMC** ou **CMC** (se elegível).
5. Adicione o registro `default._bimi` no DNS do subdomínio de envio.
6. Envie volume real e aguarde; teste com [BIMI Inspector](https://bimigroup.org/bimi-generator/).

**Importante:** o logo no corpo do e-mail (CID) e o logo no avatar da caixa de entrada são coisas diferentes — os dois podem (e devem) coexistir.

### Você já colocou o SVG em `public/bimi/logo.svg`

1. **Não** use o `app/assets/logo.svg` horizontal direto — o BIMI exige ícone **quadrado** (o projeto já tem um ícone “B” em `public/bimi/logo.svg`).
2. **Deploy** do app e teste: `https://app.bolaodomilhao.com.br/bimi/logo.svg`
3. **Valide** em https://bimigroup.org/bimi-generator/
4. **DMARC** no Resend (passo obrigatório antes do avatar aparecer).
5. **Certificado** VMC ou CMC → URL do `.pem`
6. **DNS** TXT `default._bimi.mail` com `l=` (logo) e `a=` (certificado)

Checklist resumido: `public/bimi/README.md`.

---

## Banco — recuperação de senha

```bash
npm run db:password-reset
```

Cria `password_reset_codes`. A tabela também é criada no primeiro uso em runtime.

---

## APIs — recuperar senha

| Método | Rota | Uso |
|--------|------|-----|
| POST | `/api/auth/forgot-password/send-code` | Passo 1 — envia código por e-mail |
| POST | `/api/auth/forgot-password/verify-code` | Passo 2 — valida código |
| POST | `/api/auth/forgot-password/reset` | Passo 3 — nova senha |

Regras: código TTL 10 min, até 3 reenvios imediatos (depois espera 5 min), máx. 5 tentativas erradas.

**Verificação de conta:** o código só é gerado e enviado se o e-mail existir em `users`. E-mail inexistente → HTTP 404 com mensagem clara. Se o Resend falhar, o código é removido do banco (não fica código órfão).

---

## Checklist antes do deploy

```bash
npm run build
```

(`db:password-reset` e tabelas de campanha também são criadas no primeiro uso / boot quando necessário.)

Teste manual (Resend):

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/send-test-welcome-email.ts seu@email.com "Nome" --force
npx tsx --tsconfig tsconfig.scripts.json scripts/send-test-password-reset-email.ts seu@email.com "Nome"
```

Fluxo completo:

1. **Cadastro** — código no WhatsApp; após criar conta, e-mail de boas-vindas.
2. **Esqueci senha** — `/recuperar-senha` → e-mail com código → 3 passos → login com `?msg=senha_alterada`.

---

## Campanha — 17ª rodada Brasileirão (23/05/2026)

Disparo único para **todos os e-mails** em `users` (1 envio por e-mail, sem duplicata).

| Item | Valor |
|------|--------|
| Horário | **09:12 BRT** (23/05/2026) |
| Cron Vercel | `12 12 23 5 *` UTC + retomadas `22,32,42,52` no mesmo dia |
| Rota | `GET /api/cron/email-campaign-brasileirao-r17` |
| Dedupe | tabela `email_campaign_sends` (`campaign_id` + e-mail) |

**Boot automático:** ao subir o Node (`instrumentation.ts`), o app cria as tabelas `email_campaign_*` (se faltarem) e valida variáveis de e-mail no log — **não** precisa rodar migration nem `check:email-env` antes do deploy.

Opcional (só diagnóstico local):

```bash
npm run check:email-env
```

Teste (não envia):

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/send-brasileirao-r17-campaign.ts --dry-run
```

Envio manual (ignora horário; **não** reenvia quem já está na tabela):

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/send-brasileirao-r17-campaign.ts --force
```

Cron manual: `GET /api/cron/email-campaign-brasileirao-r17?force=1` com `Authorization: Bearer CRON_SECRET`.

---

## Desenvolvimento local

Sem `RESEND_API_KEY`: e-mails (boas-vindas e senha) aparecem no **log do servidor** (`[email] dev — ...`).

Sem `REGISTRATION_WHATSAPP_WEBHOOK_URL`: código de cadastro no log (`[registration-whatsapp] código para ...`).

O front exibe *Modo desenvolvimento* quando `devMode: true` na resposta da API.
