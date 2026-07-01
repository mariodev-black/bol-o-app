"use client";

import Image, { type StaticImageData } from "next/image";
import type { ActiveBolaoListItem } from "@/app/(authenticated)/boloes/BoloesClient";
import iconCopaMundo from "@/app/assets/icon-copa-mundo.png";
import iconeBolaoArtilheiro from "@/app/assets/icone-bolao-artilheiro.png";
import logoBolaoDiario from "@/app/assets/logo-bolao-diario.png";
import skaleLogo from "@/app/assets/skale.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import { getExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";
import {
  extraBolaoIconSrc,
  type ExtraBolaoIconVariant,
} from "@/app/shared/extra-bolao-icons";

export function resolveBolaoListItemLogoSrc(
  item: ActiveBolaoListItem,
): string | StaticImageData {
  if (item.type === "dynamic") {
    if (item.resolvedLogoUrl) return item.resolvedLogoUrl;
    return extraBolaoIconSrc(
      (item.resolvedIconVariant || "generic") as ExtraBolaoIconVariant,
    ).src;
  }
  if (item.type === "diario") {
    return item.isSkaleDaily ? skaleLogo : logoBolaoDiario;
  }
  if (item.type === "artilheiros") return iconeBolaoArtilheiro;
  if (item.type === "principal") return iconCopaMundo;
  const variant = getExtraBolaoHeroSideVariant(item.championshipId, item.title);
  return variant === "generic" ? ticketBlue : extraBolaoIconSrc(variant);
}

export function BolaoListItemLogo({
  item,
  className,
  width = 72,
  height = 72,
}: {
  item: ActiveBolaoListItem;
  className?: string;
  width?: number;
  height?: number;
}) {
  const logo = resolveBolaoListItemLogoSrc(item);

  if (typeof logo === "string") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className={className} width={width} height={height} loading="lazy" />
    );
  }

  return (
    <Image src={logo} alt="" width={width} height={height} className={className} />
  );
}
