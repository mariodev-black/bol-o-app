import type { StaticImageData } from "next/image";
import avatar0 from "@/app/assets/avatares/0.png";
import avatar1 from "@/app/assets/avatares/1.png";
import avatar2 from "@/app/assets/avatares/2.png";
import avatar3 from "@/app/assets/avatares/3.png";
import avatar4 from "@/app/assets/avatares/4.png";
import { AVATAR_INDEX_MAX, AVATAR_INDEX_MIN, clampAvatarIndex } from "@/lib/auth/avatar-index";

/** Ordem fixa: índice do banco = posição no array. */
export const AVATAR_PRESET_IMAGES: readonly StaticImageData[] = [
  avatar0,
  avatar1,
  avatar2,
  avatar3,
  avatar4,
] as const;

export function getAvatarPresetImage(index: number): StaticImageData {
  const i = clampAvatarIndex(index);
  return AVATAR_PRESET_IMAGES[i]!;
}

export { AVATAR_INDEX_MIN, AVATAR_INDEX_MAX, clampAvatarIndex };
