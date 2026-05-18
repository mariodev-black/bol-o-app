# SEO — Bolão do Milhão

## O que já está no projeto

| Item | Onde |
|------|------|
| Títulos e descrições | `lib/seo/config.ts`, `app/page.tsx`, layouts |
| Open Graph / Twitter | metadata + `app/opengraph-image.tsx` |
| JSON-LD (Google) | `lib/seo/json-ld.tsx` na home |
| FAQ na página | `app/components/HomeFaqSection.tsx` |
| Sitemap | `app/sitemap.xml` → `app/sitemap.ts` |
| Robots | `app/robots.ts` |
| Área logada sem indexação | `app/(authenticated)/layout.tsx` |

## Hosts (vendas vs app)

| Host | Função |
|------|--------|
| `bolaodomilhao.com.br` | LP / vendas (ápex) |
| `www.bolaodomilhao.com.br` | LP / vendas (canonical SEO) |
| `app.bolaodomilhao.com.br` | App (cadastro, bolões, tickets) |

CTAs na LP apontam para `APP_URL`. Rotas de produto no ápex/www redirecionam para o app (`lib/site-domain.ts`, middleware).

## Variáveis de ambiente

```env
SUBDOMAIN_ROUTING_ENABLED=true
SITE_DOMAIN=bolaodomilhao.com.br
NEXT_PUBLIC_SITE_DOMAIN=bolaodomilhao.com.br
MARKETING_URL=https://www.bolaodomilhao.com.br
APP_URL=https://app.bolaodomilhao.com.br
```

O sitemap e o canonical usam `MARKETING_URL` (www).

## Depois do deploy

1. [Google Search Console](https://search.google.com/search-console) — adicionar propriedade `www.bolaodomilhao.com.br`
2. Enviar sitemap: `https://www.bolaodomilhao.com.br/sitemap.xml`
3. Pedir indexação da home
4. Conferir rich results: [Rich Results Test](https://search.google.com/test/rich-results)

## Palavras-chave foco

- bolão do milhão / bolao do milhao  
- bolão da copa / bolão copa 2026  
- palpites copa 2026  
- bolão online com prêmio  

Conteúdo novo (blog, notícias) na home ou em `/blog` ajuda a ranquear mais termos no longo prazo.
