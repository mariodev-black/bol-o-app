import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getBolaoDefinitionById } from "@/lib/boloes/definitions/repository";
import { notFound } from "next/navigation";
import { BolaoCreateWizard } from "../../_components/BolaoCreateWizard";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminBolaoEditPage({ params }: PageProps) {
  const { id } = await params;
  const definition = await getBolaoDefinitionById(id);
  if (!definition) notFound();

  return (
    <>
      <AdminPageTitle
        title="Editar bolão"
        subtitle={definition.displayName}
      />
      <BolaoCreateWizard mode="edit" definitionId={id} initialDefinition={definition} />
    </>
  );
}
