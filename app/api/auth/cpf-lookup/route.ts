import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidCpf, normalizeCpf } from "@/lib/auth/cpf";
import {
  fetchCpfFromBrasilApi,
  mapCpfSexoToGender,
  maskPersonName,
} from "@/lib/auth/cpf-brasil-api";
import { getRegistrationConflicts } from "@/lib/auth/users";

export const runtime = "nodejs";

const bodySchema = z.object({
  cpf: z.string().min(1, "Informe o CPF"),
});

function lookupErrorMessage(
  reason: Exclude<
    Awaited<ReturnType<typeof fetchCpfFromBrasilApi>>,
    { ok: true }
  >["reason"],
): string {
  switch (reason) {
    case "invalid_cpf":
      return "CPF inválido. Verifique os números.";
    case "not_found":
      return "CPF não encontrado na base consultada.";
    case "unauthorized":
    case "missing_key":
      return "Consulta de CPF temporariamente indisponível. Tente novamente em instantes.";
    case "unavailable":
    default:
      return "Não foi possível consultar o CPF agora. Verifique sua conexão e tente de novo.";
  }
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Dados inválidos";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const cpf = normalizeCpf(parsed.data.cpf);
  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: lookupErrorMessage("invalid_cpf") }, { status: 400 });
  }

  try {
    const conflicts = await getRegistrationConflicts("", cpf);
    if (conflicts.cpfTaken) {
      return NextResponse.json(
        { error: "Este CPF já está cadastrado. Faça login ou use outro CPF." },
        { status: 409 },
      );
    }
  } catch (e) {
    console.error("[auth/cpf-lookup] conflicts", e);
    return NextResponse.json(
      { error: "Erro ao validar CPF. Tente novamente." },
      { status: 500 },
    );
  }

  const result = await fetchCpfFromBrasilApi(cpf);
  if (!result.ok) {
    const status =
      result.reason === "invalid_cpf"
        ? 400
        : result.reason === "not_found"
          ? 404
          : 503;
    return NextResponse.json(
      { error: lookupErrorMessage(result.reason) },
      { status },
    );
  }

  const nome = result.data.nome;
  if (nome.length < 2) {
    return NextResponse.json(
      { error: "Não foi possível validar os dados deste CPF." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    verified: true,
    maskedName: maskPersonName(nome),
    suggestedGender: mapCpfSexoToGender(result.data.sexo),
  });
}
