import fs from "node:fs/promises";
import path from "node:path";

const PREFIX = "[deploy-flow]";

/** Uma linha no mesmo arquivo do script: `logs/github-deploy.log` (tail -f num lugar só). */
export async function appendDeployFlowLog(appRoot: string, message: string): Promise<void> {
  const logPath = path.join(appRoot, "logs", "github-deploy.log");
  const line = `[${new Date().toISOString()}] ${PREFIX} ${message}\n`;
  try {
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, line, "utf8");
  } catch (e) {
    console.error(`${PREFIX} falha ao gravar log`, logPath, e);
  }
  console.log(`${PREFIX}`, message);
}

export function deployLogPath(appRoot: string): string {
  return path.join(appRoot, "logs", "github-deploy.log");
}
