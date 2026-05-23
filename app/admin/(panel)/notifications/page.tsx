import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { AdminNotificationsClient } from "@/app/admin/(panel)/notifications/AdminNotificationsClient";
import {
  countBroadcastEligibleUsers,
  listAdminBroadcastHistory,
} from "@/lib/notifications/admin-broadcast";

export default async function AdminNotificationsPage() {
  const [eligibleUsers, history] = await Promise.all([
    countBroadcastEligibleUsers(),
    listAdminBroadcastHistory(50),
  ]);

  return (
    <>
      <AdminPageTitle
        title="Notificações"
        subtitle="Dispare avisos no sininho do app, por e-mail ou nos dois canais — para todos ou usuários selecionados."
      />
      <AdminNotificationsClient eligibleUsers={eligibleUsers} initialHistory={history} />
    </>
  );
}
