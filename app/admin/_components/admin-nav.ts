import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  Gift,
  Handshake,
  Settings,
  Trophy,
  Ticket,
  Users,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/notifications", label: "Notificações", icon: Bell },
  { href: "/admin/boloes", label: "Bolões", icon: Trophy },
  { href: "/admin/promocoes", label: "Promoções", icon: Gift },
  { href: "/admin/affiliates", label: "Afiliados", icon: Handshake },
  { href: "/admin/palpites", label: "Palpites", icon: ClipboardList },
  { href: "/admin/cotas", label: "Cotas", icon: Ticket },
  { href: "/admin/transactions", label: "Transações", icon: CreditCard },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
];

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
