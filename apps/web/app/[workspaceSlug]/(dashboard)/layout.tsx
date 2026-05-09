"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { DashboardLayout } from "@multica/views/layout";
import { MulticaIcon } from "@multica/ui/components/common/multica-icon";
import { SearchTrigger, useSearchStore } from "@multica/views/search";
import { ChatFab } from "@multica/views/chat";
import { useChatStore } from "@multica/core/chat";

const DeferredChatWindow = dynamic(
  () => import("@multica/views/chat").then((mod) => mod.ChatWindow),
  { ssr: false },
);

const DeferredSearchCommand = dynamic(
  () => import("@multica/views/search").then((mod) => mod.SearchCommand),
  { ssr: false },
);

function DashboardChatWindow() {
  const isOpen = useChatStore((s) => s.isOpen);
  return isOpen ? <DeferredChatWindow /> : null;
}

function DashboardSearchCommand() {
  const open = useSearchStore((s) => s.open);
  const setOpen = useSearchStore((s) => s.setOpen);

  useEffect(() => {
    if (open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  return open ? <DeferredSearchCommand /> : null;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      loadingIndicator={<MulticaIcon className="size-6" />}
      searchSlot={<SearchTrigger />}
      extra={<><DashboardSearchCommand /><DashboardChatWindow /><ChatFab /></>}
    >
      {children}
    </DashboardLayout>
  );
}
