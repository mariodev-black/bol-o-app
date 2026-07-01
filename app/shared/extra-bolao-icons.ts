import type { StaticImageData } from "next/image";
import iconBrasileirao from "@/app/assets/icon-brasileirao.png";
import iconCopaMundo from "@/app/assets/icon-copa-mundo.png";
import iconPremierLeague from "@/app/assets/icon-premier-league.png";
import iconLibertadores from "@/app/assets/icone-libertadores.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import iconeBolaoArtilheiro from "@/app/assets/icone-bolao-artilheiro.png";
import logoAmistoso from "@/app/assets/logo-amistoso.png";
import logoBolaoDiario from "@/app/assets/logo-bolao-diario.png";
import logoSkale from "@/app/assets/skale.png";
import logoSerieB from "@/app/assets/logo-serie-b.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import type {
  CheckoutExtraBolaoIconVariant,
  ExtraBolaoHeroSideVariant,
} from "@/lib/boloes-extra-competition-branding";

export type ExtraBolaoIconVariant =
  | ExtraBolaoHeroSideVariant
  | CheckoutExtraBolaoIconVariant
  | "copa_mundo"
  | "copa"
  | "artilheiros"
  | "daily";

export function extraBolaoIconSrc(
  variant: ExtraBolaoIconVariant,
): StaticImageData | typeof ticketBlue {
  switch (variant) {
    case "copa_mundo":
    case "copa":
      return iconCopaMundo;
    case "artilheiros":
      return iconeBolaoArtilheiro;
    case "daily":
      return logoBolaoDiario;
    case "copa_brasil":
      return iconCopaBrasil;
    case "brasileirao":
      return iconBrasileirao;
    case "serie_b":
      return logoSerieB;
    case "amistosos":
      return logoAmistoso;
    case "skale":
      return logoSkale;
    case "premier_league":
      return iconPremierLeague;
    case "libertadores":
      return iconLibertadores;
    default:
      return ticketBlue;
  }
}

export function isExtraBolaoBrandedIcon(variant: ExtraBolaoIconVariant): boolean {
  return variant !== "generic";
}
