import { NextResponse } from "next/server";

function token(): string {
  return (process.env.FOOTBALL_API_TOKEN || "").trim();
}

function competitionId(): string {
  return (process.env.FOOTBALL_COMPETITION_ID || "72").trim();
}

export async function GET() {
  const apiToken = token();
  if (!apiToken) {
    return NextResponse.json({ error: "FOOTBALL_API_TOKEN nao configurado" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.api-futebol.com.br/v1/campeonatos/${competitionId()}/tabela`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Falha ao buscar tabela" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
