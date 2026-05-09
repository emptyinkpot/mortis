import type { AgentRuntime, RuntimeUsage } from "@multica/core/types";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "从未在线";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m % 1 < 0.05 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return k % 1 < 0.05 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
  }
  return n.toLocaleString();
}

export function readRuntimeMetadataText(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatRuntimeMode(mode: string): string {
  return mode === "cloud" ? "云端" : mode === "local" ? "本地" : mode;
}

export function formatRuntimeProvider(provider: string): string {
  const normalized = provider.toLowerCase();
  if (normalized === "claude" || normalized === "claude-code") {
    return "Claude Code";
  }
  if (normalized === "codex") {
    return "Codex";
  }
  if (normalized === "pi") {
    return "Pi";
  }
  return provider;
}

export function parseRuntimeIdentity(runtime: AgentRuntime) {
  const match = /\(([^()]+)\)\s*$/.exec(runtime.name);
  const title = match ? runtime.name.slice(0, match.index).trim() : runtime.name.trim();
  const hostHint = match?.[1]?.trim() || null;
  const cliVersion = readRuntimeMetadataText(runtime.metadata, "cli_version");
  const launchedBy = readRuntimeMetadataText(runtime.metadata, "launched_by");
  const environment = runtime.runtime_mode === "cloud" ? "云端运行时" : "本机运行时";

  const summaryParts = [
    hostHint,
    runtime.device_info || null,
    runtime.launch_header || null,
    cliVersion ? `CLI ${cliVersion}` : null,
  ].filter((value): value is string => Boolean(value));

  const summary = Array.from(new Set(summaryParts)).join(" · ");

  return {
    title: title || runtime.name,
    hostHint,
    cliVersion,
    launchedBy,
    environment,
    summary,
  };
}

export interface CodexConfigSummary {
  visible: boolean;
  sourceLabel: string;
  statusLabel: string;
  statusTone: "ok" | "warn" | "missing";
  model: string | null;
  modelProvider: string | null;
  reasoningEffort: string | null;
  approvalPolicy: string | null;
  sandboxMode: string | null;
  configPath: string | null;
  snapshotPath: string | null;
  mcpServers: string[];
  notes: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringFromRecord(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readStringListFromRecord(
  record: Record<string, unknown> | null,
  keys: string[],
): string[] {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim());
    }
    const nested = asRecord(value);
    if (nested) return Object.keys(nested).sort();
  }
  return [];
}

export function parseCodexConfigSummary(runtime: AgentRuntime): CodexConfigSummary | null {
  if (runtime.provider.toLowerCase() !== "codex") return null;

  const metadata = runtime.metadata ?? {};
  const configRecord =
    asRecord(metadata.codex_config) ??
    asRecord(metadata.codex_config_snapshot) ??
    asRecord(metadata.codex_cli_config) ??
    asRecord(metadata.config_snapshot);

  const mcpServers = readStringListFromRecord(configRecord, ["mcp_servers", "mcpServers"]);
  const topLevelMcpServers = readStringListFromRecord(metadata, [
    "mcp_servers",
    "mcpServers",
    "codex_mcp_servers",
  ]);
  const mergedMcpServers = Array.from(new Set([...mcpServers, ...topLevelMcpServers])).sort();
  const configPath =
    readStringFromRecord(configRecord, ["config_path", "configPath"]) ??
    readRuntimeMetadataText(metadata, "codex_config_path") ??
    readRuntimeMetadataText(metadata, "config_path");
  const snapshotPath =
    readStringFromRecord(configRecord, ["snapshot_path", "snapshotPath"]) ??
    readRuntimeMetadataText(metadata, "codex_config_snapshot_path");
  const sourceLabel =
    readStringFromRecord(configRecord, ["source", "sourceLabel"]) ??
    (snapshotPath ? "配置快照" : configPath ? "运行时配置" : "未上报配置");
  const notes = [
    readStringFromRecord(configRecord, ["note", "notes"]),
    readRuntimeMetadataText(metadata, "codex_config_note"),
  ].filter((note): note is string => Boolean(note));

  const visible = Boolean(configRecord || configPath || snapshotPath || mergedMcpServers.length);

  return {
    visible,
    sourceLabel,
    statusLabel: visible ? "已上报" : "未上报",
    statusTone: visible ? "ok" : runtime.status === "online" ? "warn" : "missing",
    model:
      readStringFromRecord(configRecord, ["model"]) ?? readRuntimeMetadataText(metadata, "model"),
    modelProvider:
      readStringFromRecord(configRecord, ["model_provider", "modelProvider"]) ??
      readRuntimeMetadataText(metadata, "model_provider"),
    reasoningEffort:
      readStringFromRecord(configRecord, ["model_reasoning_effort", "reasoningEffort"]) ??
      readRuntimeMetadataText(metadata, "model_reasoning_effort"),
    approvalPolicy:
      readStringFromRecord(configRecord, ["approval_policy", "approvalPolicy"]) ??
      readRuntimeMetadataText(metadata, "approval_policy"),
    sandboxMode:
      readStringFromRecord(configRecord, ["sandbox_mode", "sandboxMode"]) ??
      readRuntimeMetadataText(metadata, "sandbox_mode"),
    configPath,
    snapshotPath,
    mcpServers: mergedMcpServers,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

// Pricing per million tokens (USD)
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-4-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

export function estimateCost(usage: RuntimeUsage): number {
  const model = usage.model;
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    for (const [key, p] of Object.entries(MODEL_PRICING)) {
      if (model.startsWith(key)) {
        pricing = p;
        break;
      }
    }
  }
  if (!pricing) return 0;

  return (
    (usage.input_tokens * pricing.input +
      usage.output_tokens * pricing.output +
      usage.cache_read_tokens * pricing.cacheRead +
      usage.cache_write_tokens * pricing.cacheWrite) /
    1_000_000
  );
}

// ---------------------------------------------------------------------------
// Data aggregation
// ---------------------------------------------------------------------------

export interface DailyTokenData {
  date: string;
  label: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface DailyCostData {
  date: string;
  label: string;
  cost: number;
}

export interface ModelDistribution {
  model: string;
  tokens: number;
  cost: number;
}

export function aggregateByDate(usage: RuntimeUsage[]): {
  dailyTokens: DailyTokenData[];
  dailyCost: DailyCostData[];
  modelDist: ModelDistribution[];
} {
  const dateMap = new Map<string, Omit<DailyTokenData, "label">>();
  const costMap = new Map<string, number>();
  const modelMap = new Map<string, { tokens: number; cost: number }>();

  for (const u of usage) {
    const existing = dateMap.get(u.date) ?? {
      date: u.date,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    };
    existing.input += u.input_tokens;
    existing.output += u.output_tokens;
    existing.cacheRead += u.cache_read_tokens;
    existing.cacheWrite += u.cache_write_tokens;
    dateMap.set(u.date, existing);

    const dayCost = (costMap.get(u.date) ?? 0) + estimateCost(u);
    costMap.set(u.date, dayCost);

    const modelName = u.model || u.provider;
    const m = modelMap.get(modelName) ?? { tokens: 0, cost: 0 };
    m.tokens +=
      u.input_tokens + u.output_tokens + u.cache_read_tokens + u.cache_write_tokens;
    m.cost += estimateCost(u);
    modelMap.set(modelName, m);
  }

  const formatLabel = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const dailyTokens = [...dateMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, label: formatLabel(d.date) }));

  const dailyCost = [...costMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({
      date,
      label: formatLabel(date),
      cost: Math.round(cost * 100) / 100,
    }));

  const modelDist = [...modelMap.entries()]
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.tokens - a.tokens);

  return { dailyTokens, dailyCost, modelDist };
}
