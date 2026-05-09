"use client";

import { MessageSquareText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { agentListOptions, memberListOptions } from "@multica/core/workspace/queries";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { InternalGroupChatPanel } from "./internal-group-chat-panel";

export function InternalGroupChatPage() {
  const currentUser = useAuthStore((s) => s.user);
  const wsId = useWorkspaceId();
  const { data: agents = [], isLoading: agentsLoading } = useQuery(agentListOptions(wsId));
  const { data: members = [], isLoading: membersLoading } = useQuery(memberListOptions(wsId));

  if (agentsLoading || membersLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
            <span>内部群聊</span>
          </div>
        </div>
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <InternalGroupChatPanel
      agents={agents}
      members={members}
      currentUserId={currentUser?.id ?? null}
    />
  );
}
