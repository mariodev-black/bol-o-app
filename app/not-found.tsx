import type { Metadata } from "next";
import { NotFoundPage } from "@/app/shared/NotFoundPage";

export const metadata: Metadata = {
  title: "Página não encontrada",
  description: "Esta página não existe no Bolão do Milhão.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundPage />;
}
