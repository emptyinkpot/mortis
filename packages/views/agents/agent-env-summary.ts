import { formatRuntimeProvider } from "../runtimes/utils";

const CREDENTIAL_KEY_RE =
  /(?:^|_)(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|TOKEN|SECRET|SECRET_KEY|PASSWORD|DATABASE_URL|DB_URL|REDIS_URL)$/i;
const RELATED_CONFIG_KEY_RE =
  /(?:^|_)(?:BASE_URL|API_BASE|API_HOST|MODEL|ENDPOINT)$/i;

export interface AgentEnvKeySlot {
  key: string;
  fingerprint: string | null;
}

export interface AgentEnvSummary {
  providerLabel: string;
  keySlots: AgentEnvKeySlot[];
  relatedConfigKeys: string[];
  sourceHint: string;
}

export interface AgentEnvPreset {
  key: string;
  label: string;
}

export function buildAgentEnvSummary(
  env: Record<string, string>,
  runtimeProvider?: string | null,
  redacted = false,
): AgentEnvSummary {
  const keys = Object.keys(env).sort((a, b) => a.localeCompare(b));
  const keySlots = keys
    .filter((key) => isCredentialKey(key))
    .map((key) => ({
      key,
      fingerprint: redacted ? null : formatMaskedFingerprint(env[key] ?? ""),
    }));

  const relatedConfigKeys = keys.filter((key) => RELATED_CONFIG_KEY_RE.test(key));
  const providerLabel = runtimeProvider
    ? formatRuntimeProvider(runtimeProvider)
    : "未识别";

  let sourceHint = "未在当前智能体 custom_env 中检测到 API key，当前可能沿用运行宿主已有环境变量。";
  if (keySlots.length === 1) {
    sourceHint = "当前智能体已显式配置 1 个凭据槽位，运行时会优先带着这组 custom_env 启动。";
  } else if (keySlots.length > 1) {
    sourceHint = `当前智能体已显式配置 ${keySlots.length} 个候选凭据槽位，最终生效取决于当前 provider/CLI 的读取规则。`;
  }

  return {
    providerLabel,
    keySlots,
    relatedConfigKeys,
    sourceHint,
  };
}

export function getRecommendedEnvPresets(
  runtimeProvider?: string | null,
): AgentEnvPreset[] {
  const provider = runtimeProvider?.trim().toLowerCase() ?? "";

  if (provider === "claude" || provider === "claude-code") {
    return [
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key" },
      { key: "ANTHROPIC_BASE_URL", label: "Anthropic Base URL" },
    ];
  }

  if (
    provider === "codex" ||
    provider === "openclaw" ||
    provider === "opencode" ||
    provider === "pi"
  ) {
    return [
      { key: "OPENAI_API_KEY", label: "OpenAI API Key" },
      { key: "OPENAI_BASE_URL", label: "OpenAI Base URL" },
    ];
  }

  return [
    { key: "OPENAI_API_KEY", label: "OpenAI API Key" },
    { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key" },
  ];
}

export function isCredentialKey(key: string): boolean {
  return CREDENTIAL_KEY_RE.test(key.trim());
}

export function formatMaskedFingerprint(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 4) {
    return "••••";
  }

  return `••••${trimmed.slice(-4)}`;
}
