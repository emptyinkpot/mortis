import { describe, expect, it } from "vitest";
import type { AgentRuntime } from "@multica/core/types";
import { parseCodexConfigSummary } from "./utils";

function makeRuntime(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return {
    id: "runtime-1",
    workspace_id: "workspace-1",
    daemon_id: "daemon-1",
    name: "Codex (NEVERLETMEGO)",
    runtime_mode: "local",
    provider: "codex",
    launch_header: "codex app-server",
    status: "online",
    device_info: "NEVERLETMEGO · codex-cli 0.122.0",
    metadata: {},
    owner_id: "user-1",
    last_seen_at: null,
    created_at: "2026-04-23T00:00:00.000Z",
    updated_at: "2026-04-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseCodexConfigSummary", () => {
  it("returns null for non-Codex runtimes", () => {
    expect(parseCodexConfigSummary(makeRuntime({ provider: "claude" }))).toBeNull();
  });

  it("surfaces a missing config state for Codex runtimes without metadata", () => {
    const summary = parseCodexConfigSummary(makeRuntime({ status: "offline" }));

    expect(summary?.visible).toBe(false);
    expect(summary?.statusLabel).toBe("未上报");
    expect(summary?.statusTone).toBe("missing");
    expect(summary?.mcpServers).toEqual([]);
  });

  it("parses config snapshot metadata and merges MCP server names", () => {
    const summary = parseCodexConfigSummary(
      makeRuntime({
        metadata: {
          codex_config: {
            source: "NEVERLETMEGO ~/.codex/config.toml",
            model: "gpt-5.4",
            model_provider: "crs",
            model_reasoning_effort: "high",
            approval_policy: "never",
            sandbox_mode: "danger-full-access",
            config_path: "C:\\Users\\ASUS-KL\\.codex\\config.toml",
            mcp_servers: {
              "frontend-patterns-mcp": {},
              "github-delivery-mcp": {},
            },
          },
          codex_mcp_servers: ["database-ops-mcp", "frontend-patterns-mcp"],
        },
      }),
    );

    expect(summary?.visible).toBe(true);
    expect(summary?.sourceLabel).toBe("NEVERLETMEGO ~/.codex/config.toml");
    expect(summary?.model).toBe("gpt-5.4");
    expect(summary?.modelProvider).toBe("crs");
    expect(summary?.reasoningEffort).toBe("high");
    expect(summary?.approvalPolicy).toBe("never");
    expect(summary?.sandboxMode).toBe("danger-full-access");
    expect(summary?.mcpServers).toEqual([
      "database-ops-mcp",
      "frontend-patterns-mcp",
      "github-delivery-mcp",
    ]);
  });
});
