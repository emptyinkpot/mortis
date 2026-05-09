import { describe, expect, it } from "vitest";

import {
  buildAgentEnvSummary,
  formatMaskedFingerprint,
  getRecommendedEnvPresets,
  isCredentialKey,
} from "./agent-env-summary";

describe("agent env summary helpers", () => {
  it("detects credential-like env keys", () => {
    expect(isCredentialKey("OPENAI_API_KEY")).toBe(true);
    expect(isCredentialKey("ANTHROPIC_ACCESS_TOKEN")).toBe(true);
    expect(isCredentialKey("OPENAI_BASE_URL")).toBe(false);
  });

  it("builds masked fingerprints without leaking the full value", () => {
    expect(formatMaskedFingerprint("sk-proj-1234567890")).toBe("••••7890");
    expect(formatMaskedFingerprint("abcd")).toBe("••••");
    expect(formatMaskedFingerprint("")).toBeNull();
  });

  it("summarizes provider and configured key slots", () => {
    const summary = buildAgentEnvSummary(
      {
        OPENAI_API_KEY: "sk-proj-abcdef123456",
        OPENAI_BASE_URL: "https://relay.example.com/v1",
      },
      "codex",
      false,
    );

    expect(summary.providerLabel).toBe("Codex");
    expect(summary.keySlots).toEqual([
      {
        key: "OPENAI_API_KEY",
        fingerprint: "••••3456",
      },
    ]);
    expect(summary.relatedConfigKeys).toEqual(["OPENAI_BASE_URL"]);
    expect(summary.sourceHint).toContain("显式配置 1 个凭据槽位");
  });

  it("hides fingerprints when the env map is redacted", () => {
    const summary = buildAgentEnvSummary(
      {
        ANTHROPIC_API_KEY: "sk-ant-abcdef123456",
      },
      "claude",
      true,
    );

    expect(summary.providerLabel).toBe("Claude Code");
    expect(summary.keySlots).toEqual([
      {
        key: "ANTHROPIC_API_KEY",
        fingerprint: null,
      },
    ]);
  });

  it("returns codex-oriented presets for codex-like providers", () => {
    expect(getRecommendedEnvPresets("codex")).toEqual([
      { key: "OPENAI_API_KEY", label: "OpenAI API Key" },
      { key: "OPENAI_BASE_URL", label: "OpenAI Base URL" },
    ]);
  });

  it("returns anthropic-oriented presets for claude providers", () => {
    expect(getRecommendedEnvPresets("claude")).toEqual([
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key" },
      { key: "ANTHROPIC_BASE_URL", label: "Anthropic Base URL" },
    ]);
  });
});
