# Login com Google — configuração e funcionamento no Bolão

Este diretório concentra utilitários OAuth relacionados ao Google. O fluxo HTTP principal está em:

- `app/api/auth/google/route.ts` — inicia o login (redirect para `accounts.google.com`).
- `app/api/auth/google/callback/route.ts` — troca o `code` por tokens, lê o perfil, cria ou atualiza o usuário e define o cookie de sessão.

Constantes compartilhadas (escopos e path do callback): `lib/google/oauth-config.ts`.

---

## 1. O que você precisa antes

1. Uma conta no [Google Cloud Console](https://console.cloud.google.com/).
2. O **URL público** do Bolão do Milhão em produção:
   - [https://bolaodomilhao.com.br](https://bolaodomilhao.com.br/) (ápex)
   - [https://www.bolaodomilhao.com.br](https://www.bolaodomilhao.com.br) (www)  
   E, para testes locais, `http://localhost:3000` (ou a porta que você usa).
3. Variáveis no `.env` (veja também `.env.example`):
   - `APP_URL` — **sem barra no final**, deve ser **o mesmo host** em que o Next responde (canônico). Ex.: `https://www.bolaodomilhao.com.br` **ou** `https://bolaodomilhao.com.br` — escolha um e redirecione o outro no DNS/proxy para evitar divergência de cookies.
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

O **Authorized redirect URI** que o servidor monta é **sempre**:

```text
{APP_URL}/api/auth/google/callback
```

Exemplos válidos (cadastre no Google **os dois** hosts de produção se usuários puderem entrar por ápex **e** por www):

- `https://bolaodomilhao.com.br/api/auth/google/callback`
- `https://www.bolaodomilhao.com.br/api/auth/google/callback`
- `http://localhost:3000/api/auth/google/callback` (dev)

---

## 2. Passo a passo no Google Cloud Console

### 2.1 Criar ou escolher um projeto

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/).
2. Menu superior: **Select a project** → **New Project** (ou escolha um projeto existente).
3. Dê um nome (ex.: “Bolão produção”) e crie.

### 2.2 Tela de consentimento (OAuth consent screen)

1. **APIs & Services** → **OAuth consent screen**.
2. Escolha **External** (para contas Google comuns), salvo se você usar Google Workspace e quiser **Internal**.
3. Preencha:
   - **App name** — nome exibido no consentimento.
   - **User support email** e **Developer contact**.
4. Em **Scopes**, o app pede apenas o definido em `GOOGLE_OAUTH_SCOPES` em `lib/google/oauth-config.ts`:
   - `openid`
   - `email`
   - `profile`  
   (na URL de autorização isso vira a string `openid email profile`.)
5. **Test users**: com o app em modo **Testing**, só contas listadas aqui conseguem concluir o login. Para liberar a todos, avance o fluxo de publicação ou verificação conforme as regras do Google.

### 2.3 Criar credenciais OAuth 2.0 (Client ID Web)

1. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
2. **Application type**: **Web application**.
3. **Name**: ex. “Bolão Web”.
4. **Authorized JavaScript origins** (recomendado incluir os dois hosts de produção + localhost):
   - `https://bolaodomilhao.com.br`
   - `https://www.bolaodomilhao.com.br`
   - `http://localhost:3000` (desenvolvimento)
5. **Authorized redirect URIs** — **obrigatório**, uma linha por URL exata (produção ápex + www + dev):
   - `https://bolaodomilhao.com.br/api/auth/google/callback`
   - `https://www.bolaodomilhao.com.br/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
6. Salve. Copie **Client ID** → `GOOGLE_CLIENT_ID` e **Client secret** → `GOOGLE_CLIENT_SECRET`.

### 2.4 Erros comuns

| Sintoma | O que conferir |
|--------|----------------|
| `redirect_uri_mismatch` | O URI no Console deve ser **idêntico** ao montado pelo servidor: `{APP_URL}/api/auth/google/callback` (sem `/` extra no `APP_URL`). Se o usuário abriu `www` mas `APP_URL` é ápex (ou o contrário), cadastre **os dois** redirect URIs acima ou unifique o host no proxy. |
| `google_state` ao voltar | Cookie `bolao_oauth_state` expirou ou domínio/path diferente; teste no mesmo host. |
| `google_token` | `GOOGLE_CLIENT_SECRET` incorreto ou tentativa de reusar o mesmo `code` (não recarregue a URL de callback). |
| Só alguns e-mails entram | Modo **Testing** na tela de consentimento — adicione **Test users**. |

---

## 3. Avatar do usuário (Google)

1. O Google devolve o campo **`picture`** (URL HTTPS da foto).
2. Gravamos em **`users.avatar_url`** (útil como referência e para outros fluxos).
3. O callback também chama **`tryPersistGooglePictureAsAvatarUpload`** em `lib/auth/users.ts`: baixa a imagem com `lib/google/fetch-picture-as-buffer.ts` e grava em **`avatar_upload_filename` / `avatar_upload_data`**, o mesmo pipeline de um upload manual no app.
4. **Ranking** e **Perfil** priorizam o upload quando existe; senão usam o **preset** (`avatar_index` → `app/assets/avatares/{0..4}.png`). Por isso copiar a foto do Google para o upload faz a imagem aparecer nessas telas.
5. Se o usuário **já tiver** arquivo em `avatar_upload_*`, **não** sobrescrevemos com a foto do Google.

---

## 4. Resumo dos arquivos

| Arquivo | Função |
|---------|--------|
| `lib/google/oauth-config.ts` | Escopos e path do callback. |
| `lib/google/fetch-picture-as-buffer.ts` | Download da URL `picture` (timeout, limite de tamanho, detecção de MIME). |
| `lib/google/README.md` | Este guia. |
| `app/api/auth/google/route.ts` | Redirect para autorização Google. |
| `app/api/auth/google/callback/route.ts` | Troca `code`, perfil, usuário no Postgres, sessão, persistência do avatar. |

---

## 5. Variáveis de ambiente (referência)

```env
# Produção: use o host canônico (ex. www OU ápex — um só), alinhado ao deploy
APP_URL=https://www.bolaodomilhao.com.br
# Alternativa canônica: APP_URL=https://bolaodomilhao.com.br

GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Reinicie o processo Node (ou PM2) após alterar `.env`.

---

## 6. Erro `invalid_client` / “client secret is invalid”

O Google devolve isso na **troca do código** (`POST oauth2.googleapis.com/token`), não no redirect. Causas típicas:

1. **`GOOGLE_CLIENT_SECRET` no servidor** não é o do **mesmo** cliente OAuth “Aplicativo da Web” cujo `GOOGLE_CLIENT_ID` está no `.env` (secret antigo após rotação, typo, aspas a mais, secret de outro projeto).
2. **Novo secret** gerado no Console: copie o valor **uma vez**, atualize o `.env` na VM e rode `pm2 restart next-app` (ou o nome do processo).

Confira em [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Credenciais** → seu **ID do cliente OAuth 2.0** (tipo Web) → **Chave secreta do cliente**.
