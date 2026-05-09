"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, RefreshCcw, Sparkles, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, Issue, MemberWithUser, TimelineEntry } from "@multica/core/types";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { issueListOptions } from "@multica/core/issues/queries";
import { useCreateIssue } from "@multica/core/issues/mutations";
import { canAssignAgent } from "@multica/views/issues/components";
import { Button } from "@multica/ui/components/ui/button";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@multica/ui/components/ui/resizable";
import { toast } from "sonner";
import { ActorAvatar } from "../../common/actor-avatar";
import { PageHeader } from "../../layout/page-header";
import { CommentCard } from "../../issues/components/comment-card";
import { CommentInput } from "../../issues/components/comment-input";
import { DiscussionKickoffDialog } from "../../issues/components/discussion-kickoff-dialog";
import { useIssueTimeline } from "../../issues/hooks/use-issue-timeline";
import { statusConfig } from "../config";
import {
  buildInternalGroupChatIssueDraft,
  isInternalGroupChatIssue,
} from "./internal-group-chat";

function GroupChatThread({
  issue,
  discussionAgents,
}: {
  issue: Issue;
  discussionAgents: Agent[];
}) {
  const user = useAuthStore((s) => s.user);
  const [discussionDialogOpen, setDiscussionDialogOpen] = useState(false);
  const {
    timeline,
    submitComment,
    submitReply,
    editComment,
    deleteComment,
    toggleReaction,
  } = useIssueTimeline(issue.id, user?.id);

  const commentEntries = useMemo(
    () => timeline.filter((entry) => entry.type === "comment"),
    [timeline],
  );

  const topLevelEntries = useMemo(
    () => commentEntries.filter((entry) => !entry.parent_id),
    [commentEntries],
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const entry of commentEntries) {
      if (!entry.parent_id) continue;
      const list = map.get(entry.parent_id) ?? [];
      list.push(entry);
      map.set(entry.parent_id, list);
    }
    return map;
  }, [commentEntries]);

  return (
    <>
      <div className="flex h-full flex-col">
        <PageHeader className="justify-between border-b">
          <div>
            <div className="text-sm font-semibold">内部群聊</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              这里复用共享 issue/comment/@agent 线程。当前工作区所有启用中的 Mortis 智能体都默认已在群里，无需邀请。
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={discussionAgents.length === 0}
            onClick={() => setDiscussionDialogOpen(true)}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            发起代码讨论
          </Button>
        </PageHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {topLevelEntries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 px-6 text-center">
                <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
                <div className="mt-3 text-sm font-medium">群里还没有消息</div>
                <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                  直接发言即可。你可以像在 QQ / Telegram 群里一样说话，智能体默认都在群内，使用 @agent 或 @all 就能把消息路由给对应对象。
                </p>
              </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
              {topLevelEntries.map((entry) => (
                <CommentCard
                  key={entry.id}
                  issueId={issue.id}
                  entry={entry}
                  allReplies={repliesByParent}
                  currentUserId={user?.id}
                  onReply={submitReply}
                  onEdit={editComment}
                  onDelete={deleteComment}
                  onToggleReaction={toggleReaction}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-4">
          <div className="mx-auto w-full max-w-4xl">
            <CommentInput issueId={issue.id} onSubmit={submitComment} />
          </div>
        </div>
      </div>

      <DiscussionKickoffDialog
        open={discussionDialogOpen}
        onOpenChange={setDiscussionDialogOpen}
        issue={issue}
        agents={discussionAgents}
        onSubmit={(content) => submitComment(content)}
      />
    </>
  );
}

export function InternalGroupChatPanel({
  agents,
  members,
  currentUserId,
}: {
  agents: Agent[];
  members: MemberWithUser[];
  currentUserId: string | null;
}) {
  const wsId = useWorkspaceId();
  const { data: issues = [], isLoading } = useQuery(issueListOptions(wsId));
  const createIssue = useCreateIssue();
  const createRequestedRef = useRef(false);

  const liveAgents = useMemo(
    () => agents.filter((agent) => !agent.archived_at),
    [agents],
  );
  const currentMemberRole = members.find((member) => member.user_id === currentUserId)?.role;
  const discussionAgents = useMemo(
    () =>
      liveAgents.filter((agent) =>
        canAssignAgent(agent, currentUserId ?? undefined, currentMemberRole),
      ),
    [currentMemberRole, currentUserId, liveAgents],
  );
  const groupIssue = useMemo(
    () => issues.find((issue) => isInternalGroupChatIssue(issue)) ?? null,
    [issues],
  );

  const requestGroupIssue = useCallback(() => {
    createRequestedRef.current = true;
    createIssue.mutate(buildInternalGroupChatIssueDraft(), {
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "创建内部群聊失败");
      },
    });
  }, [createIssue]);

  useEffect(() => {
    if (isLoading || groupIssue || createIssue.isPending || createRequestedRef.current) {
      return;
    }

    requestGroupIssue();
  }, [createIssue.isPending, groupIssue, isLoading, requestGroupIssue]);

  const handleRetryCreate = () => {
    createRequestedRef.current = false;
    createIssue.reset();
    requestGroupIssue();
  };

  if (isLoading || (!groupIssue && createIssue.isPending)) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader className="border-b">
          <div className="text-sm font-semibold">内部群聊</div>
        </PageHeader>
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!groupIssue) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
        <div className="text-sm font-medium">内部群聊暂时还没建好</div>
        <p className="max-w-md text-xs leading-5 text-muted-foreground">
          群聊页依赖一个共享 issue 线程作为底层消息通道。刚才创建失败了，重试一次即可恢复。
        </p>
        <Button variant="outline" size="sm" onClick={handleRetryCreate}>
          <RefreshCcw className="mr-1.5 h-4 w-4" />
          重新创建共享群聊
        </Button>
      </div>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
      <ResizablePanel id="internal-chat-main" minSize="55%">
        <GroupChatThread issue={groupIssue} discussionAgents={discussionAgents} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="internal-chat-roster" defaultSize={280} minSize={240} maxSize={360}>
        <div className="flex h-full flex-col border-l">
          <PageHeader className="border-b">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>群成员</span>
            </div>
          </PageHeader>
          <div className="overflow-y-auto px-3 py-3">
            <div className="mb-3 rounded-lg border bg-card/60 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              当前工作区的全部启用中智能体都默认视为这个群的成员，无需邀请。你能直接看到它们的状态，也能在聊天里 @ 它们加入讨论。
            </div>
            <div className="space-y-2">
              {liveAgents.map((agent) => {
                const st = statusConfig[agent.status];
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2"
                  >
                    <ActorAvatar actorType="agent" actorId={agent.id} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{agent.name}</div>
                      <div className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${st.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
