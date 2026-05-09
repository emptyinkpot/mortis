"use client";

import type { Agent, Issue } from "@multica/core/types";

export interface DiscussionKickoffParams {
  issue: Pick<Issue, "identifier" | "title" | "description">;
  moderator: Pick<Agent, "id" | "name">;
  architect: Pick<Agent, "id" | "name">;
  critic: Pick<Agent, "id" | "name">;
  implementer: Pick<Agent, "id" | "name">;
  scope?: string;
  maxRounds: number;
  goal?: string;
}

function agentMention(agent: Pick<Agent, "id" | "name">): string {
  return `[@${agent.name}](mention://agent/${agent.id})`;
}

function roleLine(role: string, agent: Pick<Agent, "id" | "name">): string {
  return `- ${role}: ${agent.name} (agent_id: \`${agent.id}\`)`;
}

function buildFinalPlanTemplate(): string[] {
  return [
    "## Final Plan Template",
    "When the discussion is done, Moderator should close with this exact structure so an execution agent can consume it directly:",
    "```md",
    "FINAL IMPLEMENTATION PLAN",
    "",
    "Chosen Approach:",
    "- <one short paragraph>",
    "",
    "Execution Owner:",
    "- <mention exactly one execution agent in the final comment>",
    "",
    "Touched Files:",
    "- `path/to/file`",
    "",
    "Ordered Steps:",
    "1. <step one>",
    "2. <step two>",
    "",
    "Risks:",
    "- <main regression / uncertainty>",
    "",
    "Verification:",
    "- <tests / checks / manual validation>",
    "```",
  ];
}

export function buildDiscussionKickoffComment({
  issue,
  moderator,
  architect,
  critic,
  implementer,
  scope,
  maxRounds,
  goal,
}: DiscussionKickoffParams): string {
  const normalizedGoal =
    goal?.trim() ||
    `Decide the best implementation approach for ${issue.identifier} ${issue.title}`.trim();
  const normalizedScope = scope?.trim() || "Use the repository and issue context linked to this issue only.";
  const issueSummary = issue.description?.trim()
    ? issue.description.trim().slice(0, 600)
    : "No additional description was provided in the issue body.";

  return [
    `${agentMention(moderator)} please start DISCUSSION_MODE for this issue.`,
    "",
    "## Goal",
    normalizedGoal,
    "",
    "## Scope",
    normalizedScope,
    "",
    "## Issue Snapshot",
    `- Issue: ${issue.identifier}`,
    `- Title: ${issue.title}`,
    `- Summary: ${issueSummary}`,
    "",
    "## Role Roster",
    roleLine("Moderator", moderator),
    roleLine("Architect", architect),
    roleLine("Critic", critic),
    roleLine("Implementer", implementer),
    "",
    "## Protocol",
    `- Maximum rounds: ${maxRounds}`,
    "- This is discussion only. Do not edit code yet unless a later comment explicitly switches to execution mode.",
    "- Moderator owns the thread. Start Round 1, mention the next speaker explicitly, and keep the thread moving.",
    "- Architect proposes the implementation shape, file boundaries, and dependency changes.",
    "- Critic challenges assumptions, points out risks/regressions, and proposes safer alternatives.",
    "- Implementer converts the best option into a concrete file-level execution plan and verification list.",
    "- Every reply should end by either handing off to the next role with an explicit @agent mention or stating that no further input is needed.",
    "- When consensus is reached, Moderator must post a final reply titled `FINAL IMPLEMENTATION PLAN` with: chosen approach, touched files, ordered steps, risks, and tests.",
    "",
    "## Hand-off Rule",
    "- When you mention the next role, use the exact agent IDs from the roster above in `mention://agent/<id>` format.",
    "- If you are not the active hand-off target, wait instead of jumping in again.",
    "",
    "## Success Criteria",
    "- The thread ends with one actionable implementation plan that another agent can execute without re-discovering context.",
    "",
    ...buildFinalPlanTemplate(),
  ].join("\n");
}
