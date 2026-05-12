import os from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deployRefMatches(payloadRef: unknown, expectedRef: string): boolean {
  if (typeof payloadRef !== "string") return false;
  return payloadRef === expectedRef;
}

/** Pasta do clone no servidor (ex.: /root/app). Se vazio, usa process.cwd() do Node/PM2. */
function resolveDeployAppRoot(): string {
  const raw = process.env.DEPLOY_APP_ROOT?.trim();
  if (!raw) return process.cwd();
  if (raw.startsWith("~/")) return path.join(os.homedir(), raw.slice(2));
  if (raw === "~") return os.homedir();
  return raw;
}

function queueDeploy(): void {
  const appRoot = resolveDeployAppRoot();
  const script = path.join(appRoot, "scripts", "deploy-from-github.sh");
  const child = spawn("bash", [script], {
    detached: true,
    stdio: "ignore",
    cwd: appRoot,
    env: { ...process.env, DEPLOY_APP_ROOT: appRoot },
  });
  child.unref();
}

/**
 * Webhook GitHub: eventos `ping` (teste) e `push` na branch configurada.
 * Configure em GitHub: Settings → Webhooks → Payload URL …/api/webhooks/github-deploy
 * Content type: application/json · apenas "push".
 *
 * Sem verificação de assinatura: qualquer POST bem-formado pode enfileirar deploy.
 * Proteja na rede (IP GitHub, nginx, firewall) se a URL for pública.
 *
 * Deploy em processo desanexado em DEPLOY_APP_ROOT: git fetch/reset, npm ci, build, pm2 restart all.
 */
export function GET() {
  return NextResponse.json({ error: "Use POST (webhook do GitHub)" }, { status: 405 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const event = request.headers.get("x-github-event")?.trim() ?? "";

  if (event === "ping") {
    return NextResponse.json({ ok: true, message: "pong" });
  }

  if (event !== "push") {
    return NextResponse.json({ ok: true, ignored: true, event });
  }

  let body: { ref?: string } = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as typeof body) : {};
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const branch = process.env.GITHUB_DEPLOY_BRANCH?.trim() || "main";
  const expectedRef = process.env.GITHUB_DEPLOY_REF?.trim() || `refs/heads/${branch}`;

  if (!deployRefMatches(body.ref, expectedRef)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ref não corresponde à branch de deploy",
      ref: body.ref,
      expectedRef,
    });
  }

  queueDeploy();
  return NextResponse.json({ ok: true, queued: true, ref: body.ref });
}
