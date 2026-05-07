import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { listAdminUsers } from "@/lib/admin/users";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const users = await listAdminUsers();

  return (
    <>
      <AdminPageTitle title="Usuários" subtitle="Busque usuários por nome, e-mail ou CPF e ordene por data ou quantidade de cotas." />
      <AdminUsersClient users={users} />
    </>
  );
}
