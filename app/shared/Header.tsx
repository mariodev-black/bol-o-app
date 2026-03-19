import Link from "next/link";
import Image from "next/image";
import { Button } from "@/app/(authenticated)/components/ui/button";
import logo from "@/app/assets/logo.png";

export function Header() {
  return (
    <header className="w-full flex items-center justify-between px-4 sm:px-6 h-14 bg-[#060B18]">
      <Link href="/" className="flex items-center" aria-label="Início">
        <Image src={logo} alt="Bolão do Milhão" height={40} priority />
      </Link>

      <nav className="flex items-center gap-2">
        <Button variant="ghost" asChild className="text-primary hover:text-primary hover:bg-accent">
          <Link href="/login">Entrar</Link>
        </Button>
        <Button asChild>
          <Link href="/cadastrar">Cadastrar</Link>
        </Button>
      </nav>
    </header>
  );
}
