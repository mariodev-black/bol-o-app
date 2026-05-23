# PWA e notificações push

## O que está implementado

- **Manifest** (`app/manifest.ts`) — app instalável, ícones em `/pwa/`, `start_url` `/boloes`, tema `#B1EB0B`
- **Service worker** (`public/sw.js`) — recebe push e abre o app ao tocar na notificação
- **Web Push** — inscrições em `push_subscriptions`, envio via `web-push` + VAPID
- **UI** — modal pós-instalação para ativar push, banner no navegador (quem não instalou), página **`/instalar-app`**, registro automático do SW logado
- **Admin** (`/admin/notifications`) — canais independentes:
  - **Sininho** — `user_notifications`
  - **Push PWA** — Web Push para inscritos em `push_subscriptions`
  - **E-mail** — Resend (marketing)
  - Preset **App completo** = sininho + push (padrão)
  - Lógica centralizada em `lib/notifications/admin-dispatch.ts`

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

Ícones em `public/pwa/` (fundo verde `#063D32` + logo branca):

| Arquivo | Uso |
|---------|-----|
| `icon-192.png` / `icon-512.png` | Manifest + Android |
| `apple-touch-icon.png` | iOS “Adicionar à Tela de Início” |
| `icon-maskable-512.png` | Maskable (safe zone) |

Coloque o PNG mestre em `public/pwa/icon-512.png` e rode:

```bash
npm run pwa:icons
```

`background_color` do manifest = `#063D32` (igual aos ícones).
