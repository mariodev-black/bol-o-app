/** Slide do HomeBannerCarousel (carrossel principal da home). */
export type HomeBanner = {
  id: string;
  alt: string;
  href: string;
  /** Tem imagem própria salva (bytea). Quando true, a imagem é servida por `imageUrl`. */
  hasImage: boolean;
  /** URL pública para servir a imagem (ou null se ainda sem imagem). */
  imageUrl: string | null;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HomeBannerInput = {
  alt?: string;
  href?: string;
  sortOrder?: number;
  enabled?: boolean;
};

/** Card do ProximosBolaoCarousel ("Próximos Bolões"). */
export type HomeBolaoCard = {
  id: string;
  name: string;
  badge: string | null;
  badgeVariant: "primary" | "muted";
  dateText: string | null;
  timeText: string | null;
  prizeLabel: string | null;
  prizeUnit: string | null;
  href: string;
  isPrimary: boolean;
  hasImage: boolean;
  imageUrl: string | null;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HomeBolaoCardInput = {
  name?: string;
  badge?: string | null;
  badgeVariant?: "primary" | "muted";
  dateText?: string | null;
  timeText?: string | null;
  prizeLabel?: string | null;
  prizeUnit?: string | null;
  href?: string;
  isPrimary?: boolean;
  sortOrder?: number;
  enabled?: boolean;
};
