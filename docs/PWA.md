# PWA e notificações push

## O que está implementado

- **Manifest** (`app/manifest.ts`) — app instalável, ícones em `/pwa/`, `start_url` `/palpites`, tema `#B1EB0B`
- **Service worker** (`public/sw.js`) — recebe push e abre o app ao tocar na notificação
- **Web Push** — inscrições em `push_subscriptions`, envio via `web-push` + VAPID
- **UI** — banner “Ativar notificações”, passo no sheet de instalar app, registro automático do SW logado
- **Admin** — disparos com canal **App** também enviam push para quem ativou (além do sininho)

## Variáveis de ambiente

Gere as chaves:

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/generate-vapid-keys.ts
```

No `.env` (e na Vercel):

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contato@bolaodomilhao.com.br
```

## Banco

```bash
npm run db:notifications
```

Inclui `scripts/sql/20260525-push-subscriptions.sql`.

## Teste local

1. `npm run dev` com HTTPS ou Chrome em `localhost` (push exige contexto seguro).
2. Login no app → “Ativar notificações” ou sheet **Instalar app**.
3. Admin → Notificações → canal **App** → enviar para seu usuário.
4. Deve aparecer: sininho + notificação do sistema (se inscrito).

## iOS

Push Web só funciona com o site **adicionado à Tela de Início** (iOS 16.4+). Use o fluxo do `InstallAppSheet`.

## Ícones PWA

Arquivos em `public/pwa/icon-192.png` e `icon-512.png`. Substitua por PNGs quadrados oficiais quando tiver arte final.
