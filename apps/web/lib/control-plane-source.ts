import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { pathToFileURL } from "node:url";
import type {
  ControlPlaneCheckStatus,
  ControlPlaneDeploymentView,
  ControlPlaneDomainView,
  ControlPlaneExecutionRoute,
  ControlPlaneHealthCheck,
  ControlPlaneMcpView,
  ControlPlaneOverlayView,
  ControlPlaneServerView,
  ControlPlaneSummary,
} from "@multica/core/types";
import { getSiteUrl } from "./site-url";

type RawRecord = Record<string, unknown>;

interface SharedControlPlaneModule {
  getControlPlanePaths(repoRoot: string): {
    controlPlaneRoot: string;
    serversPath: string;
    mcpRuntimesPath?: string;
    deployTargetsPath: string;
  };
  loadControlPlane(repoRoot: string): {
    servers: RawRecord[];
    agents?: RawRecord[];
    mcpRuntimes?: RawRecord[];
    deployTargets: RawRecord[];
    executionRouting?: {
      dispatcherServerId?: string | null;
      defaultTargetServerId?: string | null;
      fallbackTargetServerIds?: string[];
      rules?: RawRecord[];
    };
  };
  resolveDeployTarget(repoRoot: string, options?: { serverId?: string; targetId?: string }): {
    controlPlane: {
      servers: RawRecord[];
      agents?: RawRecord[];
      mcpRuntimes?: RawRecord[];
      deployTargets: RawRecord[];
      executionRouting?: RawRecord;
    };
    target: RawRecord | null;
    server: RawRecord | null;
  };
  summarizeWorkstationNode(repoRoot: string, controlPlane?: RawRecord | null): {
    status?: string | null;
    warnings?: string[];
    dispatchable?: Record<string, boolean>;
  };
  summarizeControlPlane(controlPlane: RawRecord, options?: {
    server?: RawRecord | null;
    target?: RawRecord | null;
    workstationSummary?: RawRecord | null;
  }): {
    counts?: {
      servers?: number;
      enabledServers?: number;
      deployTargets?: number;
      enabledTargets?: number;
    };
    warnings?: string[];
    executionRouting?: {
      dispatcherServerId?: string | null;
      defaultTargetServerId?: string | null;
      resolvedRules?: RawRecord[];
    };
    sourceRuntimeSplit?: {
      srcRoot?: string | null;
      runtimeRoot?: string | null;
      backupRoot?: string | null;
      mode?: string | null;
      publishStrategy?: string | null;
      buildWorkspace?: string | null;
    };
    workstation?: {
      status?: string | null;
      warnings?: string[];
      dispatchable?: Record<string, boolean>;
    } | null;
  };
}

const DEFAULT_CONTROL_PLANE_ROOTS = [
  process.env.ATRAMENTI_CONTROL_PLANE_REPO_ROOT,
  process.env.MORTIS_CONTROL_PLANE_REPO_ROOT,
  process.env.CONTROL_PLANE_REPO_ROOT,
  "E:\\My Project\\Atramenti-Console",
  "/home/ubuntu/atramenti-console-src",
].filter(Boolean) as string[];

function isControlPlaneRepoRoot(candidate: string): boolean {
  return (
    fs.existsSync(path.join(candidate, "control-plane", "registry", "servers.json")) &&
    fs.existsSync(path.join(candidate, "control-plane", "policy", "deploy-targets.json")) &&
    fs.existsSync(path.join(candidate, "shared", "control-plane.js"))
  );
}

function resolveControlPlaneRepoRoot(): string | null {
  for (const candidate of DEFAULT_CONTROL_PLANE_ROOTS) {
    if (candidate && isControlPlaneRepoRoot(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveGitDir(repoRoot: string): string | null {
  const dotGitPath = path.join(repoRoot, ".git");
  if (!fs.existsSync(dotGitPath)) {
    return null;
  }

  const stat = fs.lstatSync(dotGitPath);
  if (stat.isDirectory()) {
    return dotGitPath;
  }

  try {
    const raw = fs.readFileSync(dotGitPath, "utf-8");
    const match = raw.match(/gitdir:\s*(.+)/i);
    if (!match?.[1]) {
      return null;
    }
    return path.resolve(repoRoot, match[1].trim());
  } catch {
    return null;
  }
}

function normalizeGitRemoteUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const scpStyleMatch = trimmed.match(/^(?:ssh:\/\/)?git@([^/:]+)[:/]([^#]+?)(?:\.git)?$/i);
  if (scpStyleMatch) {
    const [, host, repoPath] = scpStyleMatch;
    if (!host || !repoPath) {
      return trimmed.replace(/\.git$/i, "");
    }
    return `https://${host}/${repoPath.replace(/\.git$/i, "")}`;
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\.git$/i, "").replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed.replace(/\.git$/i, "");
  }
}

function getCanonicalRepoInfo(repoRoot: string): { url: string | null; display: string | null } {
  const declaredRepoUrl = normalizeGitRemoteUrl(
    asString(process.env.MORTIS_CONTROL_PLANE_CANONICAL_REPO_URL)
      ?? asString(process.env.ATRAMENTI_CONTROL_PLANE_CANONICAL_REPO_URL)
      ?? asString(process.env.CONTROL_PLANE_CANONICAL_REPO_URL),
  );
  if (declaredRepoUrl) {
    try {
      const parsed = new URL(declaredRepoUrl);
      const repoPath = parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
      return {
        url: declaredRepoUrl,
        display: repoPath ? `${parsed.hostname}/${repoPath}` : parsed.hostname,
      };
    } catch {
      return { url: declaredRepoUrl, display: declaredRepoUrl };
    }
  }

  const gitDir = resolveGitDir(repoRoot);
  if (!gitDir) {
    return { url: null, display: null };
  }

  const configPath = path.join(gitDir, "config");
  if (!fs.existsSync(configPath)) {
    return { url: null, display: null };
  }

  try {
    const config = fs.readFileSync(configPath, "utf-8");
    const remoteBlocks = Array.from(config.matchAll(/\[remote "([^"]+)"\]([\s\S]*?)(?=\n\[|$)/g));
    const originBlock = remoteBlocks.find((block) => block[1] === "origin") ?? remoteBlocks[0];
    const remoteUrl = originBlock?.[2]?.match(/^\s*url\s*=\s*(.+)$/m)?.[1]?.trim() ?? null;
    const normalizedUrl = normalizeGitRemoteUrl(remoteUrl);
    if (!normalizedUrl) {
      return { url: null, display: null };
    }

    try {
      const parsed = new URL(normalizedUrl);
      const repoPath = parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
      return {
        url: normalizedUrl,
        display: repoPath ? `${parsed.hostname}/${repoPath}` : parsed.hostname,
      };
    } catch {
      return { url: normalizedUrl, display: normalizedUrl };
    }
  } catch {
    return { url: null, display: null };
  }
}

async function loadSharedControlPlaneModule(repoRoot: string): Promise<SharedControlPlaneModule> {
  const moduleUrl = pathToFileURL(path.join(repoRoot, "shared", "control-plane.js")).href;
  const imported = await import(/* webpackIgnore: true */ moduleUrl);
  return (imported.default ?? imported) as SharedControlPlaneModule;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key, asString(raw)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function parseCheckStatus(
  ok: boolean,
  statusCode?: number | null,
  message?: string | null,
): ControlPlaneCheckStatus {
  if (ok) return "healthy";
  if (statusCode && statusCode >= 300 && statusCode < 500) return "degraded";
  if (message?.toLowerCase().includes("timeout")) return "offline";
  return "offline";
}

function aggregateStatus(checks: ControlPlaneHealthCheck[]): ControlPlaneCheckStatus {
  if (checks.length === 0) return "unknown";
  const evaluatedChecks = checks.filter(
    (check) => !(check.status === "unknown" && (check.kind === "derived" || check.kind === "host-local")),
  );
  if (evaluatedChecks.length === 0) return "unknown";
  if (evaluatedChecks.every((check) => check.status === "healthy")) return "healthy";
  if (evaluatedChecks.some((check) => check.status === "healthy")) return "degraded";
  if (evaluatedChecks.some((check) => check.status === "degraded")) return "degraded";
  if (evaluatedChecks.every((check) => check.status === "unknown")) return "unknown";
  return "offline";
}

function isLoopbackHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const normalized = hostname.replace(/^\[(.*)\]$/, "$1").trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

function isProbablyFilePath(target: string): boolean {
  return (
    /^[a-z]:[\\/]/i.test(target) ||
    target.startsWith("/") ||
    target.startsWith("./") ||
    target.startsWith(".\\") ||
    target.startsWith("..\\") ||
    target.startsWith("../")
  );
}

function buildDerivedCheck(
  id: string,
  label: string,
  target: string,
  kind: ControlPlaneHealthCheck["kind"],
  message: string,
): ControlPlaneHealthCheck {
  return {
    id,
    label,
    target,
    kind,
    status: "unknown",
    ok: false,
    message,
    updatedAt: new Date().toISOString(),
  };
}

async function probeHttp(id: string, label: string, target: string): Promise<ControlPlaneHealthCheck> {
  const updatedAt = new Date().toISOString();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = Number(process.env.MORTIS_CONTROL_PLANE_HTTP_TIMEOUT_MS || 25000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const ok = response.status >= 200 && response.status < 400;
    return {
      id,
      label,
      target,
      kind: "http",
      status: parseCheckStatus(ok, response.status),
      ok,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      message: response.statusText || null,
      updatedAt,
    };
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : "HTTP probe failed";
    return {
      id,
      label,
      target,
      kind: "http",
      status: parseCheckStatus(false, null, message),
      ok: false,
      latencyMs: Date.now() - startedAt,
      message,
      updatedAt,
    };
  }
}

type ProbeHttpCache = Map<string, Promise<ControlPlaneHealthCheck>>;

async function probeHttpCached(
  id: string,
  label: string,
  target: string,
  cache?: ProbeHttpCache,
): Promise<ControlPlaneHealthCheck> {
  if (!cache) {
    return probeHttp(id, label, target);
  }

  let cached = cache.get(target);
  if (!cached) {
    cached = probeHttp(id, label, target);
    cache.set(target, cached);
  }

  const result = await cached;
  return {
    ...result,
    id,
    label,
    target,
    updatedAt: new Date().toISOString(),
  };
}

async function probeTcp(id: string, label: string, target: string): Promise<ControlPlaneHealthCheck> {
  const updatedAt = new Date().toISOString();
  const startedAt = Date.now();
  const [host, portText] = target.split(":");
  const port = Number(portText);

  if (!host || !Number.isFinite(port)) {
    return {
      id,
      label,
      target,
      kind: "tcp",
      status: "unknown",
      ok: false,
      message: "Invalid TCP target",
      updatedAt,
    };
  }

  const result = await new Promise<ControlPlaneHealthCheck>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (check: ControlPlaneHealthCheck) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(check);
    };

    socket.setTimeout(2000);
    socket.once("connect", () => {
      finish({
        id,
        label,
        target,
        kind: "tcp",
        status: "healthy",
        ok: true,
        latencyMs: Date.now() - startedAt,
        updatedAt,
      });
    });
    socket.once("timeout", () => {
      finish({
        id,
        label,
        target,
        kind: "tcp",
        status: "offline",
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: "TCP timeout",
        updatedAt,
      });
    });
    socket.once("error", (error) => {
      finish({
        id,
        label,
        target,
        kind: "tcp",
        status: "offline",
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: error.message,
        updatedAt,
      });
    });

    socket.connect(port, host);
  });

  return result;
}

function probeFile(id: string, label: string, target: string): ControlPlaneHealthCheck {
  return buildDerivedCheck(
    id,
    label,
    target,
    "derived",
    "Host-local file path; not probed from container.",
  );
}

function buildExistingFileCheck(id: string, label: string, target: string): ControlPlaneHealthCheck {
  const exists = fs.existsSync(target);
  return {
    id,
    label,
    target,
    kind: "file",
    status: exists ? "healthy" : "offline",
    ok: exists,
    message: exists
      ? "Mounted source path exists in the current control-plane checkout."
      : "Mounted source path is missing from the current control-plane checkout.",
    updatedAt: new Date().toISOString(),
  };
}

async function probeTarget(
  id: string,
  label: string,
  target: string,
  httpCache?: ProbeHttpCache,
): Promise<ControlPlaneHealthCheck> {
  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      if (isLoopbackHost(url.hostname)) {
        return buildDerivedCheck(id, label, target, "host-local", "Host-local URL; not probed from container.");
      }
    } catch {
      return buildDerivedCheck(id, label, target, "derived", "Unparseable URL target.");
    }
    return probeHttpCached(id, label, target, httpCache);
  }
  if (/^[^:]+:\d+$/.test(target)) {
    const [host] = target.split(":");
    if (isLoopbackHost(host)) {
      return buildDerivedCheck(id, label, target, "host-local", "Host-local TCP target; not probed from container.");
    }
    return probeTcp(id, label, target);
  }
  if (isProbablyFilePath(target)) {
    return probeFile(id, label, target);
  }
  return buildDerivedCheck(id, label, target, "derived", "Unrecognized target shape.");
}

async function collectChecks(
  prefix: string,
  record: Record<string, string>,
  httpCache?: ProbeHttpCache,
): Promise<ControlPlaneHealthCheck[]> {
  const entries = Object.entries(record);
  return Promise.all(
    entries.map(([key, target]) =>
      probeTarget(`${prefix}-${key}`, key, target, httpCache)),
  );
}

function mapWorkstationSummaryStatus(status: string | null): ControlPlaneCheckStatus {
  switch (status) {
    case "ready":
      return "healthy";
    case "degraded":
      return "degraded";
    case "missing":
      return "offline";
    default:
      return "unknown";
  }
}

function buildWorkstationSummaryCheck(
  serverId: string,
  workstationSummary?: RawRecord | null,
): ControlPlaneHealthCheck | null {
  if (!workstationSummary) return null;

  const summaryStatus = asString(workstationSummary.status);
  const status = mapWorkstationSummaryStatus(summaryStatus);
  const warnings = Array.isArray(workstationSummary.warnings)
    ? workstationSummary.warnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  let message = "Workstation summary is unavailable.";
  if (summaryStatus === "ready") {
    message = warnings.length > 0
      ? "Workstation summary reports ready with additional warnings."
      : "Workstation summary reports ready for dispatch.";
  } else if (summaryStatus === "degraded") {
    message = warnings.length > 0
      ? "Workstation summary reports degraded with additional warnings."
      : "Workstation summary reports degraded.";
  } else if (summaryStatus === "missing") {
    message = warnings.length > 0
      ? "Workstation summary reports missing with additional warnings."
      : "Workstation summary reports missing local status inputs.";
  }

  return {
    id: `server-${serverId}-workstation-summary`,
    label: "workstationSummary",
    target: "shared/control-plane.js::summarizeWorkstationNode",
    kind: "derived",
    status,
    ok: status === "healthy",
    message,
    updatedAt: new Date().toISOString(),
  };
}

function buildServerAggregateCheck(
  mcpId: string,
  server: ControlPlaneServerView | undefined,
): ControlPlaneHealthCheck {
  if (!server) {
    return {
      id: `mcp-${mcpId}-runtime-host`,
      label: "runtimeHost",
      target: "unknown",
      kind: "derived",
      status: "unknown",
      ok: false,
      message: "Runtime host is not registered in control-plane servers.json.",
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: `mcp-${mcpId}-runtime-host`,
    label: "runtimeHost",
    target: `${server.id} (${server.host})`,
    kind: "derived",
    status: server.aggregateStatus,
    ok: server.aggregateStatus === "healthy",
    message: "Runtime host status is derived from the mapped server checks.",
    updatedAt: new Date().toISOString(),
  };
}

function buildConsumerAgentCheck(
  mcpId: string,
  agent: RawRecord | undefined,
): ControlPlaneHealthCheck {
  if (!agent) {
    return {
      id: `mcp-${mcpId}-consumer-agent`,
      label: "consumerAgent",
      target: "unknown",
      kind: "derived",
      status: "unknown",
      ok: false,
      message: "Consumer agent is not registered in control-plane agents.json.",
      updatedAt: new Date().toISOString(),
    };
  }

  const enabled = agent.enabled !== false;
  return {
    id: `mcp-${mcpId}-consumer-agent`,
    label: "consumerAgent",
    target: asString(agent.id) || "unknown",
    kind: "derived",
    status: enabled ? "healthy" : "offline",
    ok: enabled,
    message: enabled ? "Consumer agent is enabled in control-plane agents.json." : "Consumer agent is disabled in control-plane agents.json.",
    updatedAt: new Date().toISOString(),
  };
}

function routeFromRaw(value: RawRecord): ControlPlaneExecutionRoute {
  return {
    taskClass: asString(value.taskClass) || "unknown",
    ruleId: asString(value.ruleId),
    dispatcherServerId: asString(value.dispatcherServerId),
    targetServerId: asString(value.targetServerId),
    fallbackTargetServerIds: Array.isArray(value.fallbackTargetServerIds)
      ? value.fallbackTargetServerIds.filter((item): item is string => typeof item === "string")
      : [],
    requiredRoles: Array.isArray(value.requiredRoles)
      ? value.requiredRoles.filter((item): item is string => typeof item === "string")
      : [],
    dispatchable: value.dispatchable === true,
    notes: asString(value.notes),
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((item): item is string => typeof item === "string")
      : [],
  };
}

async function buildServerView(
  server: RawRecord,
  options?: { workstationSummary?: RawRecord | null; httpCache?: ProbeHttpCache },
): Promise<ControlPlaneServerView> {
  const serverId = asString(server.id) || "unknown";
  const health = asStringRecord(server.health);
  const checks = await collectChecks(`server-${serverId}`, health, options?.httpCache);
  const workstationSummaryCheck =
    serverId === "windows-workstation-01"
      ? buildWorkstationSummaryCheck(serverId, options?.workstationSummary)
      : null;
  const effectiveChecks = workstationSummaryCheck ? [workstationSummaryCheck, ...checks] : checks;

  return {
    id: serverId,
    name: asString(server.name) || serverId || "Unknown server",
    enabled: server.enabled !== false,
    host: asString(server.host) || "unknown",
    hostname: asString(server.hostname),
    sshUser: asString(server.sshUser),
    sshPort: typeof server.sshPort === "number" ? server.sshPort : null,
    roles: Array.isArray(server.roles)
      ? server.roles.filter((item): item is string => typeof item === "string")
      : [],
    notes: asString(server.notes),
    paths: asStringRecord(server.paths),
    services: asStringRecord(server.services),
    domains: asStringRecord(server.domains),
    checks: effectiveChecks,
    aggregateStatus: aggregateStatus(effectiveChecks),
  };
}

async function buildDeploymentView(
  target: RawRecord,
  options?: { httpCache?: ProbeHttpCache },
): Promise<ControlPlaneDeploymentView> {
  const health = asStringRecord(target.health);
  const checks = await collectChecks(`deployment-${asString(target.id) || "unknown"}`, health, options?.httpCache);
  const publish = (target.publish ?? {}) as RawRecord;

  return {
    id: asString(target.id) || "unknown",
    name: asString(target.name) || asString(target.id) || "Unknown deployment",
    enabled: target.enabled !== false,
    serverId: asString(target.serverId) || "unknown",
    applicationId: asString(target.applicationId),
    promotionGateId: asString(target.promotionGateId),
    mode: asString(target.mode),
    serviceName: asString(target.serviceName),
    notes: asString(target.notes),
    paths: asStringRecord(target.paths),
    publishStrategy: asString(publish.strategy),
    buildWorkspace: asString(publish.buildWorkspace),
    health,
    checks,
    aggregateStatus: aggregateStatus(checks),
  };
}

async function buildDomainViews(
  servers: ControlPlaneServerView[],
  deployments: ControlPlaneDeploymentView[],
  overlays: ControlPlaneSummary["overlays"],
  httpCache?: ProbeHttpCache,
): Promise<ControlPlaneDomainView[]> {
  const entries: ControlPlaneDomainView[] = [];

  for (const server of servers) {
    for (const [key, domain] of Object.entries(server.domains)) {
      const url = `https://${domain}`;
      const checks = [await probeTarget(`domain-${server.id}-${key}`, `${server.name} / ${key}`, url, httpCache)];
      entries.push({
        id: `server-domain-${server.id}-${key}`,
        label: `${server.name} / ${key}`,
        category: "domain",
        ownerType: "server",
        ownerId: server.id,
        domain,
        url,
        checks,
        aggregateStatus: aggregateStatus(checks),
      });
    }
  }

  for (const deployment of deployments) {
    for (const [key, url] of Object.entries(deployment.health)) {
      if (!/^https?:\/\//i.test(url)) continue;
      const checks = [await probeTarget(`entry-${deployment.id}-${key}`, `${deployment.name} / ${key}`, url, httpCache)];
      entries.push({
        id: `deployment-entry-${deployment.id}-${key}`,
        label: `${deployment.name} / ${key}`,
        category: "entrypoint",
        ownerType: "deployment",
        ownerId: deployment.id,
        domain: (() => {
          try {
            return new URL(url).hostname;
          } catch {
            return null;
          }
        })(),
        url,
        checks,
        aggregateStatus: aggregateStatus(checks),
      });
    }
  }

  for (const overlay of [overlays.mortis, overlays.qqBridge]) {
    if (!overlay.primaryUrl) continue;
    entries.push({
      id: `overlay-entry-${overlay.key}`,
      label: overlay.label,
      category: "entrypoint",
      ownerType: "overlay",
      ownerId: overlay.key,
      domain: (() => {
        try {
          return new URL(overlay.primaryUrl || "").hostname;
        } catch {
          return null;
        }
      })(),
      url: overlay.primaryUrl,
      checks: overlay.checks,
      aggregateStatus: overlay.aggregateStatus,
    });
  }

  return entries;
}

function buildMcpViews(
  repoRoot: string,
  mcpEntries: RawRecord[],
  servers: ControlPlaneServerView[],
  agents: RawRecord[],
): ControlPlaneMcpView[] {
  return mcpEntries.map((entry) => {
    const id = asString(entry.id) || "unknown";
    const runtimeServerId = asString(entry.runtimeServerId);
    const consumerAgentId = asString(entry.consumerAgentId);
    const sourcePath = asString(entry.sourcePath);
    const sourceEntrypoint = asString(entry.sourceEntrypoint);
    const runtimeServer = servers.find((server) => server.id === runtimeServerId);
    const consumerAgent = agents.find((agent) => asString(agent.id) === consumerAgentId);
    const resolvedSourcePath = sourcePath ? path.join(repoRoot, sourcePath) : null;
    const resolvedSourceEntrypoint = sourceEntrypoint ? path.join(repoRoot, sourceEntrypoint) : null;

    const checks: ControlPlaneHealthCheck[] = [];
    if (resolvedSourceEntrypoint) {
      checks.push(buildExistingFileCheck(`mcp-${id}-source-entrypoint`, "sourceEntrypoint", resolvedSourceEntrypoint));
    } else if (resolvedSourcePath) {
      checks.push(buildExistingFileCheck(`mcp-${id}-source-root`, "sourceRoot", resolvedSourcePath));
    } else {
      checks.push({
        id: `mcp-${id}-source-entrypoint`,
        label: "sourceEntrypoint",
        target: "unknown",
        kind: "derived",
        status: "unknown",
        ok: false,
        message: "Source path is not declared in control-plane registry/mcp-runtimes.json.",
        updatedAt: new Date().toISOString(),
      });
    }

    checks.push(buildServerAggregateCheck(id, runtimeServer));
    checks.push(buildConsumerAgentCheck(id, consumerAgent));

    return {
      id,
      name: asString(entry.name) || id,
      enabled: entry.enabled !== false,
      category: asString(entry.category),
      sourceRepoRoot: repoRoot,
      sourcePath,
      sourceEntrypoint,
      resolvedSourcePath,
      resolvedSourceEntrypoint,
      runtimeServerId,
      runtimeServerName: runtimeServer?.name ?? null,
      runtimeMode: asString(entry.runtimeMode),
      runtimePath: asString(entry.runtimePath),
      consumerConfigPath: asString(entry.consumerConfigPath),
      consumerAgentId,
      consumerAgentName: asString(consumerAgent?.name),
      statusModel: asString(entry.statusModel),
      notes: asString(entry.notes),
      checks,
      aggregateStatus: aggregateStatus(checks),
    };
  });
}

async function buildMortisOverlay(httpCache?: ProbeHttpCache): Promise<ControlPlaneOverlayView> {
  const siteUrl = getSiteUrl();
  const apiUrl = asString(process.env.REMOTE_API_URL);
  const defaultWorkspaceSlug =
    asString(process.env.NEXT_PUBLIC_AUTO_LOGIN_WORKSPACE_SLUG) ||
    asString(process.env.MULTICA_AUTO_LOGIN_WORKSPACE_SLUG);
  const checks: ControlPlaneHealthCheck[] = [
    await probeHttpCached("mortis-root", "Mortis root", siteUrl, httpCache),
    await probeHttpCached("mortis-login", "Mortis login", `${siteUrl}/login`, httpCache),
  ];

  if (apiUrl) {
    checks.push(await probeHttpCached("mortis-api", "Mortis API", `${apiUrl.replace(/\/$/, "")}/api/config`, httpCache));
  }

  return {
    key: "mortis",
    label: "Mortis 私有栈",
    description: "当前站点、自身 API 与默认工作区入口。",
    primaryUrl: siteUrl,
    defaultWorkspaceSlug,
    checks,
    aggregateStatus: aggregateStatus(checks),
    meta: {
      siteUrl,
      apiUrl,
      defaultWorkspaceSlug,
    },
    warnings: [],
  };
}

async function buildQqOverlay(httpCache?: ProbeHttpCache): Promise<ControlPlaneOverlayView> {
  const publicWebUiUrl =
    asString(process.env.MORTIS_QQ_PUBLIC_WEBUI_URL) ||
    "https://napcat.tengokukk.com/webui/network";
  const webUiUrl = asString(process.env.MORTIS_QQ_WEBUI_URL) || "http://127.0.0.1:16099";
  const oneBotHttpUrl = asString(process.env.MORTIS_QQ_ONEBOT_HTTP_URL) || "http://127.0.0.1:3600";
  const oneBotWsTarget = asString(process.env.MORTIS_QQ_ONEBOT_WS_TARGET) || "127.0.0.1:3601";
  const notifyScript =
    asString(process.env.MORTIS_QQ_NOTIFY_SCRIPT) ||
    (process.platform === "win32"
      ? "E:\\My Project\\Atramenti-Console\\codex\\apps\\mortis-napcat-control\\backend\\host-control\\notify.py"
      : "/home/ubuntu/multica-public-watch/control/notify.py");
  const operatorHelper =
    asString(process.env.MORTIS_QQ_OPERATOR_HELPER) ||
    (process.platform === "win32"
      ? "E:\\My Project\\Atramenti-Console\\codex\\apps\\mortis-napcat-control\\backend\\remote\\send_napcat_group.py"
      : "/home/ubuntu/multica-public-watch/control/send_napcat_group.py");
  const checks: ControlPlaneHealthCheck[] = [
    await probeHttpCached("qq-public-webui", "NapCat public WebUI", publicWebUiUrl, httpCache),
    await probeTarget("qq-webui", "NapCat WebUI", webUiUrl, httpCache),
    await probeTarget("qq-http", "OneBot HTTP", oneBotHttpUrl, httpCache),
    await probeTarget("qq-ws", "OneBot WS", oneBotWsTarget, httpCache),
  ];
  checks.push(probeFile("qq-notify-script", "Notify bridge script", notifyScript));
  checks.push(probeFile("qq-operator-helper", "Mortis QQ operator helper", operatorHelper));

  return {
    key: "qq-bridge",
    label: "QQ 通知链",
    description: "NapCat / OneBot / notify.py 的当前可达性。",
    primaryUrl: publicWebUiUrl,
    checks,
    aggregateStatus: aggregateStatus(checks),
    meta: {
      publicWebUiUrl,
      webUiUrl,
      oneBotHttpUrl,
      oneBotWsTarget,
      notifyScript,
      operatorHelper,
    },
    warnings: [],
  };
}

export async function loadControlPlaneSummary(): Promise<ControlPlaneSummary> {
  const repoRoot = resolveControlPlaneRepoRoot();
  const httpCache: ProbeHttpCache = new Map();
  const [mortisOverlay, qqOverlay] = await Promise.all([
    buildMortisOverlay(httpCache),
    buildQqOverlay(httpCache),
  ]);

  if (!repoRoot) {
    return {
      source: {
        repoRoot: null,
        controlPlaneRoot: null,
        canonicalRepoUrl: null,
        canonicalRepoDisplay: null,
        status: "missing",
        warnings: ["未找到 Atramenti 控制面真源目录，当前只返回 Mortis 自身与 QQ 通知链覆盖。"],
        loadedAt: new Date().toISOString(),
      },
      overview: {
        counts: {
          servers: 0,
        enabledServers: 0,
        deployTargets: 0,
        enabledTargets: 0,
        domains: 2,
        mcps: 0,
      },
        dispatcherServerId: null,
        defaultTargetServerId: null,
        routes: [],
        warnings: ["控制面真源缺失，服务器 / 部署数据未接入。"],
        sourceRuntimeSplit: {
          srcRoot: null,
          runtimeRoot: null,
          backupRoot: null,
          mode: null,
          publishStrategy: null,
          buildWorkspace: null,
        },
        workstation: null,
      },
      servers: [],
      deployments: [],
      domains: await buildDomainViews([], [], { mortis: mortisOverlay, qqBridge: qqOverlay }, httpCache),
      mcps: [],
      overlays: {
        mortis: mortisOverlay,
        qqBridge: qqOverlay,
      },
    };
  }

  const shared = await loadSharedControlPlaneModule(repoRoot);
  const canonicalRepo = getCanonicalRepoInfo(repoRoot);
  const resolved = shared.resolveDeployTarget(repoRoot);
  const workstation = shared.summarizeWorkstationNode(repoRoot, resolved.controlPlane as RawRecord);
  const summary = shared.summarizeControlPlane(resolved.controlPlane as RawRecord, {
    server: resolved.server,
    target: resolved.target,
    workstationSummary: workstation as RawRecord,
  });
  const paths = shared.getControlPlanePaths(repoRoot);

  const serversPromise = Promise.all(
    (resolved.controlPlane.servers || []).map((server) =>
      buildServerView(server, { workstationSummary: workstation as RawRecord | null, httpCache })),
  );
  const deploymentsPromise = Promise.all(
    (resolved.controlPlane.deployTargets || []).map((target) => buildDeploymentView(target, { httpCache })),
  );
  const [servers, deployments] = await Promise.all([serversPromise, deploymentsPromise]);
  const mcps = buildMcpViews(
    repoRoot,
    Array.isArray(resolved.controlPlane.mcpRuntimes) ? resolved.controlPlane.mcpRuntimes : [],
    servers,
    Array.isArray(resolved.controlPlane.agents) ? resolved.controlPlane.agents : [],
  );
  const domains = await buildDomainViews(servers, deployments, {
    mortis: mortisOverlay,
    qqBridge: qqOverlay,
  }, httpCache);

  return {
    source: {
      repoRoot,
      controlPlaneRoot: paths.controlPlaneRoot,
      canonicalRepoUrl: canonicalRepo.url,
      canonicalRepoDisplay: canonicalRepo.display,
      status: "connected",
      warnings: [],
      loadedAt: new Date().toISOString(),
    },
    overview: {
      counts: {
        servers: summary.counts?.servers ?? servers.length,
        enabledServers: summary.counts?.enabledServers ?? servers.filter((item) => item.enabled).length,
        deployTargets: summary.counts?.deployTargets ?? deployments.length,
        enabledTargets: summary.counts?.enabledTargets ?? deployments.filter((item) => item.enabled).length,
        domains: domains.length,
        mcps: mcps.length,
      },
      dispatcherServerId: asString(summary.executionRouting?.dispatcherServerId),
      defaultTargetServerId: asString(summary.executionRouting?.defaultTargetServerId),
      routes: Array.isArray(summary.executionRouting?.resolvedRules)
        ? summary.executionRouting.resolvedRules.map((route) => routeFromRaw(route as RawRecord))
        : [],
      warnings: Array.isArray(summary.warnings)
        ? summary.warnings.filter((item): item is string => typeof item === "string")
        : [],
      sourceRuntimeSplit: {
        srcRoot: asString(summary.sourceRuntimeSplit?.srcRoot),
        runtimeRoot: asString(summary.sourceRuntimeSplit?.runtimeRoot),
        backupRoot: asString(summary.sourceRuntimeSplit?.backupRoot),
        mode: asString(summary.sourceRuntimeSplit?.mode),
        publishStrategy: asString(summary.sourceRuntimeSplit?.publishStrategy),
        buildWorkspace: asString(summary.sourceRuntimeSplit?.buildWorkspace),
      },
      workstation: workstation
        ? {
            status: asString(workstation.status),
            warnings: Array.isArray(workstation.warnings)
              ? workstation.warnings.filter((item): item is string => typeof item === "string")
              : [],
            dispatchable: typeof workstation.dispatchable === "object"
              ? workstation.dispatchable as Record<string, boolean>
              : undefined,
          }
        : null,
    },
    servers,
    deployments,
    domains,
    mcps,
    overlays: {
      mortis: mortisOverlay,
      qqBridge: qqOverlay,
    },
  };
}
