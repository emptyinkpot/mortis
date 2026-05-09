import { describe, expect, it } from "vitest";
import type { Agent, NapcatAccount } from "@multica/core/types";
import {
  buildNapcatQqAvatarUrl,
  formatNapcatAccountAvatarLabel,
  formatNapcatAccountOptionLabel,
  formatNapcatAccountSummary,
  formatNapcatBinding,
  getNapcatAccountSlotLabel,
  NAPCAT_ACCOUNT_ENV_KEY,
  resolveBoundNapcatAccount,
} from "./napcat";

const baseAgent: Agent = {
  id: "agent-1",
  workspace_id: "ws-1",
  runtime_id: "runtime-1",
  name: "NapCat Group Operator",
  description: "",
  instructions: "",
  avatar_url: null,
  runtime_mode: "cloud",
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
};

const accounts: NapcatAccount[] = [
  {
    key: "qq-1",
    label: "qq-1",
    description: "Primary QQ slot",
    qq_name: "Display Name 1",
    qq_uin: "2264869713",
    enabled: true,
    env: {
      NAPCAT_API_URL: "http://127.0.0.1:3001",
    },
  },
  {
    key: "qq-2",
    label: "qq-2",
    description: "Secondary QQ slot",
    qq_name: "",
    qq_uin: "123456789",
    enabled: true,
    env: {
      NAPCAT_API_URL: "http://127.0.0.1:3002",
    },
  },
];

describe("napcat agent binding helpers", () => {
  it("prefers the explicit account key from custom env", () => {
    const agent: Agent = {
      ...baseAgent,
      custom_env: {
        [NAPCAT_ACCOUNT_ENV_KEY]: "qq-2",
        NAPCAT_API_URL: "http://127.0.0.1:3001",
      },
    };

    expect(resolveBoundNapcatAccount(agent, accounts)?.key).toBe("qq-2");
  });

  it("falls back to matching managed env when no explicit key is present", () => {
    const agent: Agent = {
      ...baseAgent,
      custom_env: {
        NAPCAT_API_URL: "http://127.0.0.1:3001",
      },
    };

    expect(resolveBoundNapcatAccount(agent, accounts)?.key).toBe("qq-1");
  });

  it("formats the binding label with slot and QQ number", () => {
    expect(formatNapcatBinding(accounts[0]!)).toBe("绑定：Display Name 1 · qq-1 · 2264869713");
    expect(formatNapcatBinding(null)).toBe("未绑定 QQ");
  });

  it("formats shared account display labels consistently", () => {
    expect(getNapcatAccountSlotLabel(accounts[0]!)).toBe("qq-1");
    expect(getNapcatAccountSlotLabel(accounts[1]!)).toBe("");
    expect(formatNapcatAccountAvatarLabel(accounts[0]!)).toBe("Display Name 1 · QQ 2264869713");
    expect(formatNapcatAccountOptionLabel(accounts[0]!)).toBe("Display Name 1 · qq-1 (2264869713)");
    expect(formatNapcatAccountOptionLabel(accounts[1]!)).toBe("qq-2 (123456789)");
    expect(formatNapcatAccountSummary(accounts[0]!)).toBe(
      "名称 Display Name 1 · QQ 2264869713 · HTTP http://127.0.0.1:3001",
    );
  });

  it("builds the QQ avatar URL only when a QQ number exists", () => {
    expect(buildNapcatQqAvatarUrl("2264869713")).toBe(
      "https://q1.qlogo.cn/g?b=qq&nk=2264869713&s=100",
    );
    expect(buildNapcatQqAvatarUrl("")).toBeNull();
  });
});
