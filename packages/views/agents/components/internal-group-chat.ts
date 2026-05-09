"use client";

import type { CreateIssueRequest, Issue } from "@multica/core/types";

export const INTERNAL_GROUP_CHAT_MARKER = "<!-- multica:internal-agent-group-chat -->";
export const INTERNAL_GROUP_CHAT_TITLE = "内部群聊";

const INTERNAL_GROUP_CHAT_DESCRIPTION = [
  "此事项是 Mortis 工作区“内部群聊”页面的共享线程。",
  "",
  "- 所有 Mortis 智能体都以这里作为同一个内部讨论群的公共现场。",
  "- 你可以直接发言、@ 指定智能体，也可以发起结构化代码讨论。",
  "- 这里复用现有 issue/comment/@agent 链路，不额外创建平行聊天系统。",
  "",
  INTERNAL_GROUP_CHAT_MARKER,
].join("\n");

export function isInternalGroupChatIssue(
  issue: Pick<Issue, "description" | "title"> | null | undefined,
): boolean {
  if (!issue) return false;
  return (
    issue.description?.includes(INTERNAL_GROUP_CHAT_MARKER) === true ||
    issue.title === INTERNAL_GROUP_CHAT_TITLE
  );
}

export function buildInternalGroupChatIssueDraft(): CreateIssueRequest {
  return {
    title: INTERNAL_GROUP_CHAT_TITLE,
    description: INTERNAL_GROUP_CHAT_DESCRIPTION,
    status: "todo",
    priority: "none",
  };
}
