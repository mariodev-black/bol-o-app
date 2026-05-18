"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useProductHref } from "@/app/shared/useProductHref";

type ProductLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Link interno que no www aponta para o host do app (`APP_URL`). */
export function ProductLink({ href, ...rest }: ProductLinkProps) {
  return <Link href={useProductHref(href)} {...rest} />;
}
