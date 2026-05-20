import type { StaticImageData } from "next/image";
import iconBrasileirao from "@/app/assets/icon-brasileirao.png";
import iconPremierLeague from "@/app/assets/icon-premier-league.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import type {
  CheckoutExtraBolaoIconVariant,
  ExtraBolaoHeroSideVariant,
} from "@/lib/boloes-extra-competition-branding";

export type ExtraBolaoIconVariant =
  | ExtraBolaoHeroSideVariant
  | CheckoutExtraBolaoIconVariant;

export function extraBolaoIconSrc(
  variant: ExtraBolaoIconVariant,
): StaticImageData | typeof ticketBlue {
  switch (variant) {
    case "copa_brasil":
      return iconCopaBrasil;
    case "brasileirao":
      return iconBrasileirao;
    case "premier_league":
      return iconPremierLeague;
    default:
      return ticketBlue;
  }
}

export function isExtraBolaoBrandedIcon(variant: ExtraBolaoIconVariant): boolean {
  return variant !== "generic";
}
