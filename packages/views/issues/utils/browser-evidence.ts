import type { AgentTask } from "@multica/core/types/agent";

export interface BrowserTimelineItemLike {
  type: "tool_use" | "tool_result" | "thinking" | "text" | "error";
  tool?: string;
  content?: string;
  input?: Record<string, unknown>;
  output?: string;
}

export interface BrowserEvidenceArtifact {
  kind: string;
  path: string;
}

export interface BrowserEvidenceSummary {
  action?: string;
  purpose?: string;
  url?: string;
  gatewayStatus?: string;
  verificationLevel?: string;
  message?: string;
  artifacts: BrowserEvidenceArtifact[];
  source: "task" | "timeline" | "mixed";
}

interface EvidenceState {
  action?: string;
  purpose?: string;
  url?: string;
  gatewayStatus?: string;
  verificationLevel?: string;
  message?: string;
  artifacts: BrowserEvidenceArtifact[];
  artifactKeys: Set<string>;
  urls: Set<string>;
  sawTaskPayload: boolean;
  sawTimelinePayload: boolean;
}

const URL_RE = /https?:\/\/[^\s"'`<>]+/gi;
const ARTIFACT_PATH_RE = /(?:[A-Za-z]:\\[^\s"'`<>]*?\\artifacts\\[^\s"'`<>]+?\.(?:png|jpe?g|webp)|\/[^\s"'`<>]*?\/artifacts\/[^\s"'`<>]+?\.(?:png|jpe?g|webp)|artifacts[\\/][^\s"'`<>]+?\.(?:png|jpe?g|webp))/gi;

export function extractBrowserEvidence(
  task: Pick<AgentTask, "result" | "error">,
  items: BrowserTimelineItemLike[],
): BrowserEvidenceSummary | null {
  const state: EvidenceState = {
    artifacts: [],
    artifactKeys: new Set<string>(),
    urls: new Set<string>(),
    sawTaskPayload: false,
    sawTimelinePayload: false,
  };

  collectUnknown(task.result, state, "task");
  collectUnknown(task.error, state, "task");

  for (const item of items) {
    if (item.tool === "browser.run") {
      state.action ??= "browser.run";
      state.sawTimelinePayload = true;
    }
    collectUnknown(item.input, state, "timeline");
    collectUnknown(item.output, state, "timeline");
    collectUnknown(item.content, state, "timeline");
  }

  const source = resolveSource(state);
  const hasSignal =
    source !== null ||
    state.artifacts.length > 0 ||
    !!state.url ||
    !!state.gatewayStatus ||
    state.action === "browser.run";

  if (!hasSignal) {
    return null;
  }

  return {
    action: state.action,
    purpose: state.purpose,
    url: state.url,
    gatewayStatus: state.gatewayStatus,
    verificationLevel: state.verificationLevel,
    message: state.message,
    artifacts: state.artifacts,
    source: source ?? "timeline",
  };
}

function resolveSource(state: EvidenceState): BrowserEvidenceSummary["source"] | null {
  if (state.sawTaskPayload && state.sawTimelinePayload) return "mixed";
  if (state.sawTaskPayload) return "task";
  if (state.sawTimelinePayload) return "timeline";
  return null;
}

function collectUnknown(value: unknown, state: EvidenceState, source: "task" | "timeline"): void {
  if (value == null) return;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return;

    const parsed = tryParseJSON(trimmed);
    if (parsed !== null) {
      markSource(state, source);
      collectUnknown(parsed, state, source);
      return;
    }

    collectUrlsFromString(trimmed, state);
    collectArtifactsFromString(trimmed, state);
    if (!state.message && /browser/i.test(trimmed) && trimmed.length <= 240) {
      state.message = trimmed;
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 0) markSource(state, source);
    for (const entry of value) {
      collectUnknown(entry, state, source);
    }
    return;
  }

  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if (Object.keys(record).length > 0) {
    markSource(state, source);
  }

  const action = pickString(record.action);
  if (action) state.action ??= action;

  const purpose = pickString(record.purpose);
  if (purpose) state.purpose ??= purpose;

  const url = pickString(record.url) ?? pickString(record.expectedUrl);
  if (url && !state.url) {
    state.url = sanitizeUrl(url);
    if (state.url) state.urls.add(state.url.toLowerCase());
  }

  const gatewayStatus =
    pickString(record.gateway_status) ??
    (action === "browser.run" ? pickString(record.status) : undefined);
  if (gatewayStatus) state.gatewayStatus ??= gatewayStatus;

  const verificationLevel =
    pickString(record.verification_level) ?? pickString(record.verificationLevel);
  if (verificationLevel) state.verificationLevel ??= verificationLevel;

  const message = pickString(record.message);
  if (message && !state.message) state.message = message;

  if (typeof record.lastScreenshot === "string") {
    appendArtifact(state, record.lastScreenshot);
  }

  if (Array.isArray(record.artifacts)) {
    for (const artifact of record.artifacts) {
      if (artifact && typeof artifact === "object") {
        const artifactRecord = artifact as Record<string, unknown>;
        appendArtifact(state, pickString(artifactRecord.path), pickString(artifactRecord.kind));
      } else if (typeof artifact === "string") {
        appendArtifact(state, artifact);
      }
    }
  }

  for (const nested of Object.values(record)) {
    collectUnknown(nested, state, source);
  }
}

function tryParseJSON(value: string): unknown | null {
  if (!/^[\[{]/.test(value)) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function markSource(state: EvidenceState, source: "task" | "timeline"): void {
  if (source === "task") state.sawTaskPayload = true;
  if (source === "timeline") state.sawTimelinePayload = true;
}

function collectUrlsFromString(value: string, state: EvidenceState): void {
  for (const match of value.matchAll(new RegExp(URL_RE.source, "gi"))) {
    const url = sanitizeUrl(match[0]);
    if (!url) continue;
    const key = url.toLowerCase();
    if (state.urls.has(key)) continue;
    state.urls.add(key);
    state.url ??= url;
  }
}

function collectArtifactsFromString(value: string, state: EvidenceState): void {
  for (const match of value.matchAll(new RegExp(ARTIFACT_PATH_RE.source, "gi"))) {
    appendArtifact(state, match[0]);
  }
}

function appendArtifact(state: EvidenceState, rawPath: string | undefined, rawKind?: string): void {
  if (!rawPath) return;
  const path = sanitizePath(rawPath);
  if (!path) return;
  const key = getArtifactKey(path);
  if (state.artifactKeys.has(key)) return;
  state.artifactKeys.add(key);
  state.artifacts.push({
    kind: rawKind?.trim() || "screenshot",
    path,
  });
}

function sanitizeUrl(value: string): string | undefined {
  const cleaned = value.trim().replace(/^[("'`]+|[)"'`,.;]+$/g, "");
  return cleaned || undefined;
}

function sanitizePath(value: string): string | undefined {
  const cleaned = value
    .trim()
    .replace(/^[("'`]+|[)"'`,.;]+$/g, "")
    .replace(/\\\\/g, "\\");
  return cleaned || undefined;
}

function getArtifactKey(path: string): string {
  const normalized = path.toLowerCase().replace(/\\/g, "/");
  const marker = "/artifacts/";
  const idx = normalized.lastIndexOf(marker);
  if (idx >= 0) {
    return normalized.slice(idx + 1);
  }
  if (normalized.startsWith("artifacts/")) {
    return normalized;
  }
  return normalized;
}
