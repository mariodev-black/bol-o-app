import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { BolaoCreateWizard } from "../_components/BolaoCreateWizard";

export default function AdminBolaoCreatePage() {
  return (
    <>
      <AdminPageTitle
        title="Criar bolão"
        subtitle="Nome e logo → valor → campeonatos e jogos → detalhes → publicar."
      />
      <BolaoCreateWizard mode="create" />
    </>
  );
}
