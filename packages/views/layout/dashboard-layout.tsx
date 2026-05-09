"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useModalStore } from "@multica/core/modals";
import { SidebarProvider, SidebarInset } from "@multica/ui/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { DashboardGuard } from "./dashboard-guard";

const DeferredModalRegistry = dynamic(
  () => import("../modals/registry").then((mod) => mod.ModalRegistry),
  { ssr: false },
);

function DashboardModalRegistry() {
  const modal = useModalStore((s) => s.modal);
  return modal ? <DeferredModalRegistry /> : null;
}

interface DashboardLayoutProps {
  children: ReactNode;
  /** Rendered inside SidebarInset (e.g. ChatWindow, ChatFab — absolute-positioned overlays) */
  extra?: ReactNode;
  /** Rendered inside sidebar header as a search trigger */
  searchSlot?: ReactNode;
  /** Loading indicator */
  loadingIndicator?: ReactNode;
}

export function DashboardLayout({
  children,
  extra,
  searchSlot,
  loadingIndicator,
}: DashboardLayoutProps) {
  return (
    <DashboardGuard
      loadingFallback={
        <div className="flex h-svh items-center justify-center">
          {loadingIndicator}
        </div>
      }
    >
      <SidebarProvider className="h-svh">
        <AppSidebar searchSlot={searchSlot} />
        <SidebarInset className="relative overflow-hidden">
          {children}
          <DashboardModalRegistry />
          {extra}
        </SidebarInset>
      </SidebarProvider>
    </DashboardGuard>
  );
}
