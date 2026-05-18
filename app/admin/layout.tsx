import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildPageMetadata({
  title: "Administração",
  description: "Painel administrativo.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
