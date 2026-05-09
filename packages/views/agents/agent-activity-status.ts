import type { Agent, Issue } from "@multica/core/types";

import { statusConfig } from "./config";

export interface AgentActivityStatusDisplay {
  label: string;
  color: string;
  dot: string;
}

function getAssignedOpenIssues(agent: Agent, issues: Issue[]): Issue[] {
  return issues.filter(
    (issue) =>
      issue.assignee_type === "agent" &&
      issue.assignee_id === agent.id &&
      issue.status !== "done" &&
      issue.status !== "cancelled",
  );
}

export function deriveAgentActivityStatus(
  agent: Agent,
  issues: Issue[],
): AgentActivityStatusDisplay {
  if (agent.status === "working") {
    return {
      label: "正在执行",
      color: "text-success",
      dot: "bg-success",
    };
  }

  if (agent.status !== "idle") {
    return statusConfig[agent.status];
  }

  const assignedOpenIssues = getAssignedOpenIssues(agent, issues);
  if (assignedOpenIssues.length === 0) {
    return {
      label: "队列为空",
      color: "text-muted-foreground",
      dot: "bg-muted-foreground",
    };
  }

  const actionableCount = assignedOpenIssues.filter((issue) =>
    ["backlog", "todo", "in_progress"].includes(issue.status),
  ).length;
  const reviewCount = assignedOpenIssues.filter(
    (issue) => issue.status === "in_review",
  ).length;
  const blockedCount = assignedOpenIssues.filter(
    (issue) => issue.status === "blocked",
  ).length;

  if (actionableCount > 0) {
    return {
      label: `待处理 ${assignedOpenIssues.length} 项`,
      color: "text-info",
      dot: "bg-info",
    };
  }

  if (reviewCount > 0) {
    return {
      label: `待审核 ${reviewCount} 项`,
      color: "text-success",
      dot: "bg-success",
    };
  }

  if (blockedCount > 0) {
    return {
      label: `阻塞 ${blockedCount} 项`,
      color: "text-warning",
      dot: "bg-warning",
    };
  }

  return {
    label: `已分配 ${assignedOpenIssues.length} 项`,
    color: "text-info",
    dot: "bg-info",
  };
}
