import { NextRequest, NextResponse } from "next/server";
import { ensureEmailCampaignTables } from "@/lib/email/campaign-sends";
import { addEmailUnsubscribe, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descadastro de e-mails promocionais.
 * - POST: one-click (RFC 8058) — o Gmail/Yahoo dispara automaticamente.
 * - GET:  clique do usuário no link do rodapé — descadastra e mostra página.
 */

async function processUnsubscribe(request: NextRequest): Promise<boolean> {
  const email = (request.nextUrl.searchParams.get("e") || "").trim();
  const token = (request.nextUrl.searchParams.get("t") || "").trim();
  if (!email || !token || !email.includes("@")) return false;
  if (!verifyUnsubscribeToken(email, token)) return false;

  await ensureEmailCampaignTables();
  await addEmailUnsubscribe(email, "list_unsubscribe");
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ok = await processUnsubscribe(request);
    // One-click espera 200 mesmo em token inválido (não vaza se o e-mail existe).
    return new NextResponse(ok ? "unsubscribed" : "ignored", { status: 200 });
  } catch (error) {
    console.error("[unsubscribe] POST", error);
    return new NextResponse("error", { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  let ok = false;
  try {
    ok = await processUnsubscribe(request);
  } catch (error) {
    console.error("[unsubscribe] GET", error);
  }

  const title = ok ? "Descadastro confirmado" : "Link inválido";
  const message = ok
    ? "Você não receberá mais e-mails promocionais do Bolão do Milhão."
    : "Não foi possível processar o descadastro. O link pode ter expirado.";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Bolão do Milhão</title></head>
<body style="margin:0;background:#0B0D0C;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#F5F5F5;">
  <div style="max-width:480px;margin:64px auto;padding:32px;background:#141716;border:1px solid #2A2F2C;border-radius:12px;text-align:center;">
    <h1 style="font-size:20px;margin:0 0 12px;color:${ok ? "#B1EB0B" : "#F5F5F5"};">${title}</h1>
    <p style="font-size:14px;line-height:1.6;color:#A3A3A3;margin:0;">${message}</p>
  </div>
</body></html>`;

  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
