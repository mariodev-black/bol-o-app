import os from "node:os";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { appendDeployFlowLog, deployLogPath } from "@/lib/deploy/deploy-flow-log";
import { parseGithubWebhookBody } from "@/lib/deploy/parse-github-webhook-body";

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

/** Enfileira o bash; retorna pid do filho ou undefined. */
function queueDeploy(appRoot: string): number | undefined {
  const script = path.join(appRoot, "scripts", "deploy-from-github.sh");
  const child = spawn("bash", [script], {
    detached: true,
    stdio: "ignore",
    cwd: appRoot,
    env: { ...process.env, DEPLOY_APP_ROOT: appRoot },
  });
  const pid = child.pid;
  child.unref();
  return pid;
}

/**
 * Fluxo (tipo Vercel): **git push** na branch → GitHub POST aqui → log + script (pull, npm se precisar, build, pm2).
 *
 * **Onde ver o fluxo no servidor:** `tail -f /root/app/logs/github-deploy.log` (ou `DEPLOY_APP_ROOT/logs/...`).
 * Linhas `[api/webhook]` vêm desta rota; o resto vem do `scripts/deploy-from-github.sh`.
 *
 * **Debug remoto (opcional):** no `.env` defina `DEPLOY_DEBUG_TOKEN=um_segredo` e abra:
 * `GET /api/webhooks/github-deploy?token=um_segredo` — últimas linhas do mesmo log (texto puro).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  const expected = process.env.DEPLOY_DEBUG_TOKEN?.trim();

  if (!expected || !token || token !== expected) {
    return NextResponse.json(
      {
        error: "Use POST (webhook GitHub).",
        hint:
          "Fluxo: commit local não dispara nada → faça git push → GitHub chama este POST. Ver log: tail -f $DEPLOY_APP_ROOT/logs/github-deploy.log",
        debug:
          "Para ler o final do log por HTTP, defina DEPLOY_DEBUG_TOKEN no .env e use GET ?token=...",
      },
      { status: 405 }
    );
  }

  const appRoot = resolveDeployAppRoot();
  const logPath = deployLogPath(appRoot);
  try {
    const raw = await fs.readFile(logPath, "utf8");
    const lines = raw.split("\n");
    const tail = lines.slice(-150).join("\n");
    return new NextResponse(tail || "(log vazio ainda)\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json(
      { error: "Arquivo de log não encontrado ou ilegível", path: logPath },
      { status: 404 }
    );
  }
}

export async function POST(request: Request) {
  const appRoot = resolveDeployAppRoot();
  const buf = Buffer.from(await request.arrayBuffer());
  const contentEncoding = request.headers.get("content-encoding");
  const event = request.headers.get("x-github-event")?.trim() ?? "";

  await appendDeployFlowLog(
    appRoot,
    `POST recebido | X-GitHub-Event="${event || "(vazio)"}" | bodyBytes=${buf.length} | Content-Encoding=${contentEncoding ?? "(vazio)"} | appRoot=${appRoot}`
  );

  if (event === "ping") {
    await appendDeployFlowLog(appRoot, "ping do GitHub → respondendo pong (webhook ativo)");
    return NextResponse.json({ ok: true, message: "pong", step: "ping_ok" });
  }

  if (event !== "push") {
    await appendDeployFlowLog(appRoot, `evento ignorado (não é push): "${event}"`);
    return NextResponse.json({ ok: true, ignored: true, event, step: "ignored_not_push" });
  }

  const parsed = parseGithubWebhookBody(buf, contentEncoding);
  if (!parsed.ok) {
    await appendDeployFlowLog(
      appRoot,
      `corpo JSON inválido | ${parsed.error} | Content-Encoding=${parsed.contentEncoding} | hex48=${parsed.previewHex} | utf8preview=${parsed.previewUtf8.slice(0, 120)}`
    );
    return NextResponse.json(
      {
        error: "JSON inválido",
        step: "bad_json",
        detail: parsed.error,
        contentEncoding: parsed.contentEncoding,
        bodyBytes: buf.length,
      },
      { status: 400 }
    );
  }

  const body = parsed.json;
  const branch = process.env.GITHUB_DEPLOY_BRANCH?.trim() || "main";
  const expectedRef = process.env.GITHUB_DEPLOY_REF?.trim() || `refs/heads/${branch}`;

  if (!deployRefMatches(body.ref, expectedRef)) {
    await appendDeployFlowLog(
      appRoot,
      `push recebido mas branch não é a de deploy | ref payload="${String(body.ref ?? "(undefined)")}" | esperado="${expectedRef}"`
    );
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ref não corresponde à branch de deploy",
      ref: body.ref,
      expectedRef,
      step: "push_skipped_wrong_branch",
    });
  }

  const scriptPath = path.join(appRoot, "scripts", "deploy-from-github.sh");
  await appendDeployFlowLog(
    appRoot,
    `push OK na branch de deploy → enfileirando script | ref=${String(body.ref)} | script=${scriptPath}`
  );

  const pid = queueDeploy(appRoot);
  await appendDeployFlowLog(
    appRoot,
    `script disparado (processo desanexado) | child_pid=${pid ?? "?" } — próximas linhas vêm do bash no mesmo log`
  );

  return NextResponse.json({
    ok: true,
    queued: true,
    ref: body.ref,
    step: "push_queued_script",
    childPid: pid ?? null,
    logFile: deployLogPath(appRoot),
  });
}
