import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(
    "https://api.api-futebol.com.br/v1/campeonatos/72/tabela",
    {
      headers: {
        Authorization: "Bearer live_21fbe3f95b03a101ba8883edcf6e60",
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
