import type { StaticImageData } from "next/image";
import influ1 from "@/app/assets/influ1.png";
import influ2 from "@/app/assets/influ2.png";
import influ3 from "@/app/assets/influ3.png";

export type HomeInfluencer = {
  handle: string;
  cardImage: StaticImageData;
};

export const HOME_INFLUENCERS: HomeInfluencer[] = [
  {
    handle: "@dandaa.s",
    cardImage: influ2,
  },
  {
    handle: "@theodipiero6",
    cardImage: influ1,
  },
  {
    handle: "@w18walter",
    cardImage: influ3,
  },
];
