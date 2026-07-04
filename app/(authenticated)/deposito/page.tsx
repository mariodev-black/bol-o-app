import { redirect } from "next/navigation";

/**
 * No modelo de carteira, "depositar" = adicionar saldo, que vive em /carteira.
 * Esta rota antiga (compra de cota avulsa rotulada "Depositar") passa a
 * redirecionar para a Central Financeira.
 */
export default function DepositoPage() {
  redirect("/carteira");
}
