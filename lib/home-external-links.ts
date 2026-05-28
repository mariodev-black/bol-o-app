/** Links externos da home logada (client-safe via NEXT_PUBLIC_*). */

export function getTelegramChannelUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://t.me/bolaodomilhao";
}

export const HOME_HELP_HREF = "/boloes#boloes-ajuda";
