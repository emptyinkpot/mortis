"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import type { Workspace } from "@multica/core/types";
import { useLogout } from "../auth";
import { CreateWorkspaceForm } from "./create-workspace-form";

const singleUserMode = Boolean(process.env.NEXT_PUBLIC_AUTO_LOGIN_WORKSPACE_SLUG);

/**
 * Full-page shell for the "create workspace" transition. Shared between web
 * (Next.js route `/workspaces/new`) and desktop (window-overlay). The
 * top-bar affordances — Back (when dismissable) and Log out — live here
 * so both platforms get identical UX; platform-specific concerns like
 * window-drag region and macOS traffic-light handling stay in each app's
 * shell.
 *
 * `onBack` is optional: caller passes it only when there's somewhere to go
 * back to (user has other workspaces, or the flow was entered from an
 * existing session). On the zero-workspace entry path it's omitted, which
 * hides Back — Log out is then the only escape.
 */
export function NewWorkspacePage({
  onSuccess,
  onBack,
}: {
  onSuccess: (workspace: Workspace) => void;
  onBack?: () => void;
}) {
  const logout = useLogout();

  return (
    <div className="relative flex min-h-svh flex-col bg-background px-6 py-12">
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-12 left-12 text-muted-foreground"
          onClick={onBack}
        >
          <ArrowLeft />
          返回
        </Button>
      )}
      {!singleUserMode && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-12 right-12 text-muted-foreground hover:text-destructive"
          onClick={logout}
        >
          <LogOut />
          退出
        </Button>
      )}

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              {singleUserMode ? "Mortis 已完成预配置" : "欢迎来到 Mortis"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {singleUserMode
                ? "这个私有实例会保持单一受管工作区。"
                : "先创建工作区，再开始使用。"}
            </p>
          </div>
          {!singleUserMode && <CreateWorkspaceForm onSuccess={onSuccess} />}
        </div>
      </div>
    </div>
  );
}
