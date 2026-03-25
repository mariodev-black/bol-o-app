# Bolão do Milhão

Aplicação web do **Bolão do Milhão**, um produto de bolão de futebol focado em competições como a **Copa do Mundo**. O usuário participa com **palpites**, acompanha **bolões**, **ranking**, informações de **partidas** e fluxos de **conta** (perfil, indicação, depósitos, saques, tickets).

## O que é este projeto

É um **front-end** em **Next.js (App Router)** com interface em português, tema escuro e layout pensado para **mobile** (barra inferior fixa + navegação lateral). Parte do conteúdo da home é **marketing** (carrossel, como participar, sistema de pontuação, prêmios). Áreas logadas concentram **palpites**, listagem de bolões e telas financeiras.

A autenticação, hoje, é **simplificada para desenvolvimento** (`AuthContext` com `localStorage` opcional); não há middleware de proteção de rotas no repositório — as rotas “autenticadas” são organizadas em grupo de pastas, mas a experiência depende do estado do cliente.

## Stack principal

| Área | Tecnologia |
|------|------------|
| Framework | [Next.js](https://nextjs.org/) 16 (Turbopack no dev/build) |
| UI | [React](https://react.dev/) 19 |
| Estilo | [Tailwind CSS](https://tailwindcss.com/) 4 |
| Componentes | [Radix UI](https://www.radix-ui.com/) (dialog, label, slot), utilitários `class-variance-authority`, `clsx`, `tailwind-merge` |
| Ícones | [Lucide React](https://lucide.dev/) |
| Bandeiras | `country-flag-icons` |
| Linguagem | TypeScript |

## Scripts

```bash
npm install
npm run dev      # desenvolvimento — http://localhost:3000
npm run build    # build de produção
npm run start    # servidor após build
npm run lint     # ESLint (eslint-config-next)
```

## Estrutura de pastas (visão geral)

```
app/
  layout.tsx              # Raiz: fontes (Montserrat, DM Sans), Providers, slot @modal
  providers.tsx           # AuthProvider + SidenavProvider
  page.tsx                # Landing pública (hero, seções, ranking, etc.)
  globals.css
  shared/                 # Componentes globais reutilizáveis
    Header.tsx, NavBottom.tsx, Footer.tsx
    AuthContext.tsx, SidenavContext.tsx
    HeroCarousel, FlagsMarquee, RankingAtual, ...
  (authenticated)/        # Telas “da área logada” (layout com Header + NavBottom)
    boloes/, tickets/, palpites/, perfil/, deposito/, saques/, indique/, ...
  (public)/               # Layout com Footer (disponível para rotas públicas do grupo; a home usa `app/page.tsx` com composição própria)
  (auth)/                 # Login e cadastro (layout próprio)
  @modal/                 # Interceptação de rotas para modais (ex.: login/cadastrar)
  api/
    partidas/route.ts     # Proxy/cache de partidas
    tabela/route.ts       # Proxy/cache de tabela do campeonato
```

Rotas efetivas (exemplos): `/`, `/login`, `/cadastrar`, `/dashboard`, `/boloes`, `/tickets`, `/palpites`, `/perfil`, `/deposito`, `/saques`, `/indique`, `/privacidade`, etc.

## API de futebol

As rotas `GET /api/partidas` e `GET /api/tabela` buscam dados na **API Futebol** (`api.api-futebol.com.br`), com **revalidação** em cache (`revalidate: 300` segundos). Imagens de um CDN permitido estão configuradas em `next.config.ts` (`cdn.api-futebol.com.br`).

**Importante:** o token de autorização está **fixo no código** das rotas de API. Para produção, o ideal é mover para **variável de ambiente** (ex.: `API_FUTEBOL_TOKEN`) e nunca commitar segredos.

## Estado global no cliente

- **Auth** (`app/shared/AuthContext.tsx`): `isLoggedIn`, `login`, `logout`; chave `localStorage` `bolao_logged_in_v1`. (Leitura inicial do `localStorage` pode estar comentada no código — conferir o arquivo para o comportamento atual.)
- **Sidenav** (`app/shared/SidenavContext.tsx`): controle do menu lateral deslizante usado pelo `Header` / `NavBottom`.

## Modais (Next.js)

O segmento paralelo `@modal` junto com interceptação de rotas `(.)login` / `(.)cadastrar` permite abrir login/cadastro como **modal** em certas navegações, mantendo a URL amigável.

## Requisitos

- **Node.js** compatível com Next.js 16 (recomendado: LTS atual).

---

Documentação gerada a partir do estado do repositório; ao evoluir o produto, atualize rotas, variáveis de ambiente e fluxo de autenticação neste arquivo.
