import { describe, expect, it } from "vitest";
import { buildDiscussionKickoffComment } from "./discussion-kickoff";

describe("buildDiscussionKickoffComment", () => {
  it("mentions only the moderator in the kickoff line and includes the roster ids", () => {
    const content = buildDiscussionKickoffComment({
      issue: {
        identifier: "MUL-42",
        title: "Implement discussion mode",
        description: "Need a multi-agent coding discussion flow.",
      },
      moderator: { id: "agent-mod", name: "Moderator" },
      architect: { id: "agent-arch", name: "Architect" },
      critic: { id: "agent-critic", name: "Critic" },
      implementer: { id: "agent-impl", name: "Implementer" },
      maxRounds: 3,
      scope: "Focus on issue comments and mentions.",
    });

    expect(content).toContain(
      "[@Moderator](mention://agent/agent-mod) please start DISCUSSION_MODE for this issue.",
    );
    expect(content).toContain("- Moderator: Moderator (agent_id: `agent-mod`)");
    expect(content).toContain("- Architect: Architect (agent_id: `agent-arch`)");
    expect(content).toContain("- Critic: Critic (agent_id: `agent-critic`)");
    expect(content).toContain("- Implementer: Implementer (agent_id: `agent-impl`)");
    expect(content).toContain("Maximum rounds: 3");
    expect(content).toContain("FINAL IMPLEMENTATION PLAN");
    expect(content).toContain("Execution Owner:");
    expect(content).toContain("Touched Files:");
    expect(content).toContain("Verification:");
  });

  it("falls back to issue-driven defaults when goal and scope are omitted", () => {
    const content = buildDiscussionKickoffComment({
      issue: {
        identifier: "MUL-99",
        title: "Fix runtime drift",
        description: "",
      },
      moderator: { id: "agent-a", name: "Agent A" },
      architect: { id: "agent-b", name: "Agent B" },
      critic: { id: "agent-c", name: "Agent C" },
      implementer: { id: "agent-d", name: "Agent D" },
      maxRounds: 2,
    });

    expect(content).toContain("Decide the best implementation approach for MUL-99 Fix runtime drift");
    expect(content).toContain("Use the repository and issue context linked to this issue only.");
    expect(content).toContain("No additional description was provided in the issue body.");
  });
});
