"use client";

import type { ReactNode } from "react";
import { adminTabBarClass } from "@/app/admin/_components/admin-layout";

export function AdminTabBar({ children }: { children: ReactNode }) {
  return <div className={adminTabBarClass}>{children}</div>;
}
