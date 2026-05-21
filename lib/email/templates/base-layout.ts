export {
  emailAttention,
  emailBodyText,
  emailCodeBlock,
  emailGreeting,
  emailH1,
  emailPrimaryButton,
  renderEmailShell,
  renderEmailShell as renderEmailLayout,
} from "@/lib/email/templates/email-shell";

export type { EmailShellParams as EmailLayoutParams } from "@/lib/email/templates/email-shell";

import {
  emailBodyText,
  emailPrimaryButton,
} from "@/lib/email/templates/email-shell";

/** @deprecated Use `emailBodyText`. */
export function emailParagraph(html: string): string {
  return emailBodyText(html);
}

export function emailButton(href: string, label: string): string {
  return emailPrimaryButton(href, label);
}
