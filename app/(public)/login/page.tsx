import { Button } from "@/app/(authenticated)/components/ui/button";
import { Input } from "@/app/(authenticated)/components/ui/input";
import { Label } from "@/app/(authenticated)/components/ui/label";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg p-8 bg-card">
        <h1 className="text-2xl font-bold mb-6 text-center text-primary">
          Entrar
        </h1>

        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-primary">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              className="bg-background text-foreground"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-primary">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="bg-background text-foreground"
            />
          </div>

          <Button type="submit" className="mt-2 w-full">
            Entrar
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/cadastrar" className="text-primary font-medium hover:underline">
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  );
}
