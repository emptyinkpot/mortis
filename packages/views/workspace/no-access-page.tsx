"use client";

import { Button } from "@multica/ui/components/ui/button";
import { paths } from "@multica/core/paths";
import { useNavigation } from "../navigation";

const singleUserMode = Boolean(process.env.NEXT_PUBLIC_AUTO_LOGIN_WORKSPACE_SLUG);

/**
 * Rendered when the workspace slug in the URL does not resolve to a workspace
 * the current user can access. Deliberately doesn't distinguish "workspace
 * doesn't exist" from "workspace exists but I'm not a member" — showing
 * either would let attackers enumerate workspace slugs.
 */
export function NoAccessPage() {
  const nav = useNavigation();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          工作区不可用
        </h1>
        <p className="max-w-md text-muted-foreground">
          当前工作区不存在，或你暂时无权访问。
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => nav.push(paths.root())}>
          {singleUserMode ? "返回 Mortis" : "返回我的工作区"}
        </Button>
      </div>
    </div>
  );
}
