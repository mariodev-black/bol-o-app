import { Button } from "@/app/(authenticated)/components/ui/button";
import { Input } from "@/app/(authenticated)/components/ui/input";
import { Label } from "@/app/(authenticated)/components/ui/label";
import Link from "next/link";

export default function CadastrarPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg p-8 bg-card">
        <h1 className="text-2xl font-bold mb-6 text-center text-primary">
          Cadastrar
        </h1>

        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome" className="text-primary">Nome</Label>
            <Input
              id="nome"
              type="text"
              placeholder="Seu nome"
              className="bg-background text-foreground"
            />
          </div>

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
            Criar Conta
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
