import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { BolaoCreateWizard } from "../_components/BolaoCreateWizard";

export default function AdminBolaoCreatePage() {
  return (
    <>
      <AdminPageTitle
        title="Criar bolão"
        subtitle="Assistente passo a passo — campeonato, modalidade, preço, premiação e publicação."
      />
      <BolaoCreateWizard mode="create" />
    </>
  );
}
