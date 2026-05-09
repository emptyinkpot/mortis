import { describe, expect, it } from "vitest";
import type { Agent, Issue } from "@multica/core/types";

import { deriveAgentActivityStatus } from "./agent-activity-status";

const baseAgent: Agent = {
  id: "agent-1",
  workspace_id: "ws-1",
  runtime_id: "runtime-1",
  name: "Agent One",
  description: "",
  instructions: "",
  avatar_url: null,
  runtime_mode: "local",
  runtime_config: {},
  custom_env: {},
  custom_args: [],
  custom_env_redacted: false,
  visibility: "workspace",
  status: "idle",
  max_concurrent_tasks: 1,
  owner_id: null,
  skills: [],
  created_at: "2026-04-16T00:00:00Z",
  updated_at: "2026-04-16T00:00:00Z",
  archived_at: null,
  archived_by: null,
};

function makeIssue(
  id: string,
  status: Issue["status"],
  assigneeId = "agent-1",
): Issue {
  return {
    id,
    workspace_id: "ws-1",
    number: 1,
    identifier: `MOR-${id}`,
    title: `Issue ${id}`,
    description: null,
    status,
    priority: "medium",
    assignee_type: "agent",
    assignee_id: assigneeId,
    creator_type: "member",
    creator_id: "user-1",
    parent_issue_id: null,
    project_id: null,
    position: 1,
    due_date: null,
    created_at: "2026-04-16T00:00:00Z",
    updated_at: "2026-04-16T00:00:00Z",
  };
}

describe("deriveAgentActivityStatus", () => {
  it("shows queue empty when an idle agent has no open assigned issues", () => {
    expect(deriveAgentActivityStatus(baseAgent, []).label).toBe("队列为空");
  });

  it("shows pending work when an idle agent still has actionable issues", () => {
    const status = deriveAgentActivityStatus(baseAgent, [
      makeIssue("1", "todo"),
      makeIssue("2", "in_review"),
    ]);

    expect(status.label).toBe("待处理 2 项");
    expect(status.color).toBe("text-info");
  });

  it("shows pending review when only in_review issues remain", () => {
    const status = deriveAgentActivityStatus(baseAgent, [
      makeIssue("1", "in_review"),
      makeIssue("2", "in_review"),
    ]);

    expect(status.label).toBe("待审核 2 项");
  });

  it("shows blocked when only blocked issues remain", () => {
    const status = deriveAgentActivityStatus(baseAgent, [
      makeIssue("1", "blocked"),
    ]);

    expect(status.label).toBe("阻塞 1 项");
  });

  it("preserves non-idle server statuses", () => {
    expect(
      deriveAgentActivityStatus({ ...baseAgent, status: "working" }, []).label,
    ).toBe("正在执行");
    expect(
      deriveAgentActivityStatus({ ...baseAgent, status: "error" }, []).label,
    ).toBe("错误");
  });
});
