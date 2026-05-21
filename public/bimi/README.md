# BIMI — logo no avatar do Gmail

Arquivo: `logo.svg` (ícone quadrado, símbolo “B” — **não** use o logo horizontal completo).

## Checklist (ordem)

### 1. Publicar o SVG em HTTPS

Após deploy do app:

`https://app.bolaodomilhao.com.br/bimi/logo.svg`

Teste no navegador: a imagem deve abrir sem login.

Valide o formato em: https://bimigroup.org/bimi-generator/

### 2. DMARC no Resend

1. [resend.com](https://resend.com) → **Domains** → `mail.bolaodomilhao.com.br`
2. Siga o guia **DMARC** até ter registro com `p=quarantine` ou `p=reject` e `pct=100`
3. Repita no DNS do domínio **raiz** `bolaodomilhao.com.br` se o Resend pedir

### 3. Certificado (obrigatório no Gmail)

- **VMC** — se a marca está registrada no INPI  
- **CMC** — se a logo é usada há mais de 1 ano  

Emissores: DigiCert, GlobalSign, SSL.com.  
Eles devolvem um arquivo `.pem` hospedado em HTTPS.

### 4. Registro DNS BIMI

No provedor do domínio (onde está o DNS de `mail.bolaodomilhao.com.br`):

| Campo | Valor |
|--------|--------|
| **Nome / Host** | `default._bimi.mail` (ou `default._bimi` conforme o painel) |
| **Tipo** | TXT |
| **Valor** | `v=BIMI1; l=https://app.bolaodomilhao.com.br/bimi/logo.svg; a=https://URL-DO-SEU-CERTIFICADO.pem;` |

Substitua `a=` pela URL do `.pem` que o emissor do certificado fornecer.

### 5. Aguardar

Propagação DNS + aprovação do certificado: **dias a semanas**.  
O Gmail só exibe o avatar com BIMI completo e boa reputação de envio.

---

Mais detalhes: `docs/EMAIL.md` → “Logo no avatar do Gmail”.
