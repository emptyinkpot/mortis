import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Agent } from "@multica/core/types";
import { DiscussionKickoffDialog } from "./discussion-kickoff-dialog";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@multica/ui/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@multica/ui/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (value: string | null, details: unknown) => void;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value, {})}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder ?? ""}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const agents: Agent[] = [
  {
    id: "agent-mod",
    workspace_id: "ws-1",
    runtime_id: "runtime-1",
    name: "Moderator",
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
    created_at: "2026-04-21T00:00:00Z",
    updated_at: "2026-04-21T00:00:00Z",
    archived_at: null,
    archived_by: null,
  },
  {
    id: "agent-arch",
    workspace_id: "ws-1",
    runtime_id: "runtime-2",
    name: "Architect",
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
    created_at: "2026-04-21T00:00:00Z",
    updated_at: "2026-04-21T00:00:00Z",
    archived_at: null,
    archived_by: null,
  },
  {
    id: "agent-critic",
    workspace_id: "ws-1",
    runtime_id: "runtime-3",
    name: "Critic",
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
    created_at: "2026-04-21T00:00:00Z",
    updated_at: "2026-04-21T00:00:00Z",
    archived_at: null,
    archived_by: null,
  },
  {
    id: "agent-impl",
    workspace_id: "ws-1",
    runtime_id: "runtime-4",
    name: "Implementer",
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
    created_at: "2026-04-21T00:00:00Z",
    updated_at: "2026-04-21T00:00:00Z",
    archived_at: null,
    archived_by: null,
  },
];

describe("DiscussionKickoffDialog", () => {
  it("submits a kickoff comment that only mentions the moderator directly", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <DiscussionKickoffDialog
        open
        onOpenChange={onOpenChange}
        issue={{
          identifier: "MUL-77",
          title: "Prototype discussion mode",
          description: "Need a safe multi-agent planning loop.",
          assignee_id: "agent-impl",
          assignee_type: "agent",
        }}
        agents={agents}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Decide the best implementation approach for MUL-77 Prototype discussion mode")).toBeInTheDocument();
    });

    expect(screen.getByText("群聊预演")).toBeInTheDocument();
    expect(screen.getByText("只直接 @ 主持人")).toBeInTheDocument();
    expect(screen.getByText("接力顺序")).toBeInTheDocument();

    const preview = screen.getByTestId("kickoff-preview");
    const previewValue = (preview as HTMLTextAreaElement).value;
    expect(previewValue).toContain("FINAL IMPLEMENTATION PLAN");
    expect(previewValue).toContain("Execution Owner:");

    fireEvent.click(screen.getByRole("button", { name: "发起讨论" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const firstCall = onSubmit.mock.calls[0];
    expect(firstCall).toBeDefined();
    const content = firstCall![0] as string;
    expect(content).toContain("[@Implementer](mention://agent/agent-impl) please start DISCUSSION_MODE for this issue.");
    expect(content).toContain("- Architect: Architect (agent_id: `agent-arch`)");
    expect(content).toContain("- Critic: Critic (agent_id: `agent-critic`)");
    expect(content).not.toContain("[@Architect](mention://agent/agent-arch)");
    expect(content).not.toContain("[@Critic](mention://agent/agent-critic)");
  });
});
