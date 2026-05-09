"use client";

import React from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Globe,
  LayoutDashboard,
  RefreshCw,
  Rocket,
  Server,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { controlPlaneSummaryOptions } from "@multica/core/control-plane";
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
import { useCurrentWorkspace } from "@multica/core/paths";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { cn } from "@multica/ui/lib/utils";
import { PageHeader } from "../../layout/page-header";

export type ControlPlaneView = "overview" | "servers" | "deployments" | "domains";

const statusLabel: Record<ControlPlaneCheckStatus, string> = {
  healthy: "健康",
  degraded: "降级",
  offline: "离线",
  unknown: "未知",
};

const statusClassName: Record<ControlPlaneCheckStatus, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  degraded: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  offline: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  unknown: "bg-muted text-muted-foreground",
};

const statusTextClassName: Record<ControlPlaneCheckStatus, string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  degraded: "text-amber-600 dark:text-amber-400",
  offline: "text-rose-600 dark:text-rose-400",
  unknown: "text-muted-foreground",
};

const statusFillClassName: Record<ControlPlaneCheckStatus, string> = {
  healthy: "bg-emerald-500/80",
  degraded: "bg-amber-500/80",
  offline: "bg-rose-500/80",
  unknown: "bg-slate-400/70 dark:bg-slate-500/70",
};

const controlPlaneLabelMap: Record<string, string> = {
  "Repo Root": "仓库根",
  "Control Plane Root": "控制面根目录",
  Dispatcher: "派发节点",
  Target: "目标节点",
  Fallback: "回退节点",
  Host: "主机",
  URL: "地址",
  HTTP: "HTTP",
  TCP: "TCP",
  FILE: "文件",
  DERIVED: "推导",
  "Mortis Overlay": "Mortis 外层接入",
  "QQ Overlay": "QQ 外层接入",
  "Mortis root": "Mortis 首页",
  "Mortis login": "Mortis 登录页",
  "NapCat public WebUI": "NapCat 公网 WebUI",
  sourceEntrypoint: "挂载源码入口",
  sourceRoot: "挂载源码目录",
  runtimeHost: "运行宿主",
  consumerAgent: "消费代理",
  "HOST-LOCAL": "主机本地",
  publicConsoleSummary: "公网控制台摘要",
  localConsoleSummary: "本地控制台摘要",
  publicConsoleRoot: "公网控制台首页",
  publicConsoleSummaryDirect: "公网控制台摘要直连",
  publicUrl: "公网地址",
  localUrl: "本地地址",
  publicBaseUrl: "公网基础地址",
  publicDirectUrl: "公网直连地址",
  sshProbe: "SSH 探测",
  localSshListener: "本地 SSH 监听",
  workstationSummary: "工作站摘要",
  reverseBridgeHealth: "本地 bridge 健康",
  reverseBridgeWorkstation: "本地 bridge 工作站摘要",
  reverseTunnelSupervisor: "反向隧道守护",
  "session-stdio": "本机会话内按需 stdio",
  "source-entrypoint-plus-runtime-host": "以挂载源码入口存在 + 宿主可用性判定",
};

const controlPlaneWarningMap: Record<string, string> = {
  "ssh-autoconnect status file is missing.": "缺少 ssh-autoconnect 状态文件。",
  "key-guard-local-bridge status file is missing.": "缺少 key-guard-local-bridge 状态文件。",
  "Windows workstation is not currently dispatchable for local-file.": "Windows 工作站当前无法承接 local-file 任务。",
  "Windows workstation is not currently dispatchable for local-config.": "Windows 工作站当前无法承接 local-config 任务。",
  "Windows workstation is not currently dispatchable for desktop-bound.": "Windows 工作站当前无法承接 desktop-bound 任务。",
  "Desktop-bound tasks still assume the Windows interactive session is present; add a viewer/session heartbeat before treating this as fully verified.":
    "desktop-bound 任务仍默认依赖 Windows 交互会话；在把它视作完全已验证之前，还需要单独补一个 viewer / session heartbeat。",
};

const controlPlaneMessageMap: Record<string, string> = {
  "Host-local URL; not probed from container.": "主机本地 URL，当前仅按派生信息展示，不在 Mortis 容器内直探。",
  "Host-local TCP target; not probed from container.": "主机本地 TCP 目标，当前仅按派生信息展示，不在 Mortis 容器内直探。",
  "Host-local file path; not probed from container.": "主机本地文件路径，当前仅按派生信息展示，不在 Mortis 容器内直探。",
  "Unrecognized target shape.": "目标形态无法归类，当前按派生项展示。",
  "Unparseable URL target.": "URL 无法解析，当前按派生项展示。",
  "Workstation summary is unavailable.": "工作站摘要当前不可用。",
  "Workstation summary reports ready for dispatch.": "工作站摘要显示已就绪，可承接派发。",
  "Workstation summary reports ready with additional warnings.": "工作站摘要显示已就绪，但仍有额外告警待收口。",
  "Workstation summary reports degraded.": "工作站摘要显示为降级。",
  "Workstation summary reports degraded with additional warnings.": "工作站摘要显示为降级，且仍有额外告警待收口。",
  "Workstation summary reports missing local status inputs.": "工作站摘要缺少本地状态输入。",
  "Workstation summary reports missing with additional warnings.": "工作站摘要缺少本地状态输入，且仍有额外告警待收口。",
  "Mounted source path exists in the current control-plane checkout.": "当前控制面挂载 checkout 中已找到这条源码路径。",
  "Mounted source path is missing from the current control-plane checkout.": "当前控制面挂载 checkout 中未找到这条源码路径。",
  "Runtime host is not registered in control-plane servers.json.": "control-plane 的 servers.json 中还没有登记这条 MCP 的运行宿主。",
  "Consumer agent is not registered in control-plane agents.json.": "control-plane 的 agents.json 中还没有登记这条 MCP 的消费代理。",
  "Consumer agent is enabled in control-plane agents.json.": "control-plane 的 agents.json 中已登记并启用这条 MCP 的消费代理。",
  "Consumer agent is disabled in control-plane agents.json.": "control-plane 的 agents.json 中已登记这条 MCP 的消费代理，但当前是禁用状态。",
  "Runtime host status is derived from the mapped server checks.": "运行宿主状态直接继承自对应 server 卡片里的健康检查汇总。",
};

const controlPlaneNoteMap: Record<string, string> = {
  "Primary cloud node for Atramenti Console. This is the deployed control plane, dispatcher, and public UI entry. Official external domain: console.tengokukk.com.":
    "Atramenti Console 的主云节点；当前承担已部署控制面、派发器和公网 UI 入口。官方外部域名：console.tengokukk.com。",
  "Primary cloud node for Atramenti Console. This is the deployed control plane, dispatcher, and public UI entry. The console is confirmed as an ubuntu user-level systemd service, and the official external domain is console.tengokukk.com.":
    "Atramenti Console 的主云节点；当前承担已部署控制面、派发器和公网 UI 入口。控制台已确认由 ubuntu 用户级 systemd 托管，对外正式域名为 console.tengokukk.com。",
  "Runtime-heavy worker node for mirrored workspaces and portable MCP workloads. Current blocker: TCP opens on port 22 but SSH banner times out, so login needs to be restored before it can be trusted as the main worker.":
    "面向镜像工作区和便携 MCP 负载的运行时重节点。当前阻塞点：22 端口 TCP 可达，但 SSH 横幅超时，需要先恢复登录能力，才能把它当作主工作节点。",
  "Runtime-heavy worker node for mirrored workspaces and portable MCP workloads. As of 2026-04-19, root SSH is restorable again, but the intended non-root operations account and worker service contract still need to be normalized.":
    "面向镜像工作区和便携 MCP 负载的运行时重节点。到 2026-04-19 为止，root SSH 已恢复可登录，但预期的非 root 运维账号与 worker 服务契约仍待规范。",
  "Lightweight lab / jump node for experiments, low-priority verification, and backup assistance. The SSH aliases and lab service name are now part of the static control-plane registry.":
    "轻量实验 / 跳板节点，用于实验、低优先级验证与备援协助。SSH 别名与 lab 服务名已纳入静态 control-plane registry。",
  "Elastic Smoothcloud GPU instance for burst inference and temporary heavy workloads. The platform domain and known service names are tracked here, but direct SSH auth still depends on platform-side credentials.":
    "Smoothcloud 弹性 GPU 实例，用于突发推理与临时重负载任务。平台域名和已知服务名已记录在案，但直接 SSH 认证仍依赖平台侧凭据。",
  "Primary execution node for tasks that must touch the real Windows workstation: local files, editor-bound tasks, local config writes, browser/UI actions, and desktop-only tooling. It should be dispatched by the control plane instead of being treated as a passive bridge.":
    "需要接触真实 Windows 工作站的任务主执行节点：本地文件、编辑器绑定任务、本地配置写入、浏览器/UI 操作和桌面专属工具，都应由控制面主动派发到这里，而不是把它当作被动桥接机。",
  "Current conversation carrier / session host only. It is registered here so the manual no longer has a server-side source gap, but it must not be treated as an active business node or execution-routing target unless re-promoted explicitly.":
    "当前仅作为对话承载 / session host 记录在册；纳入 registry 只是为了补齐服务器资产映射，不应被视为活跃业务节点或 execution-routing 目标，除非后续明确重新晋升。",
  "Build in srcRoot, then publish to runtimeRoot so runtime stays clean and multiple servers can share one deploy contract.":
    "先在 srcRoot 构建，再发布到 runtimeRoot，这样运行目录能保持干净，也方便多台服务器共享同一套部署约定。",
};

function formatControlPlaneText(value: string | null | undefined): string {
  if (!value) return "--";
  return controlPlaneLabelMap[value] ?? controlPlaneWarningMap[value] ?? controlPlaneNoteMap[value] ?? controlPlaneMessageMap[value] ?? value;
}

function formatOwnerType(value: string): string {
  if (value === "server") return "服务器";
  if (value === "deployment") return "部署目标";
  if (value === "overlay") return "外层接入";
  return value;
}

function aggregateWarnings(summary: ControlPlaneSummary): string[] {
  return [
    ...summary.source.warnings,
    ...summary.overview.warnings,
    ...summary.overlays.mortis.warnings,
    ...summary.overlays.qqBridge.warnings,
    ...(summary.overview.workstation?.warnings ?? []),
  ];
}

function mergeStatuses(statuses: ControlPlaneCheckStatus[]): ControlPlaneCheckStatus {
  if (statuses.some((status) => status === "offline")) return "offline";
  if (statuses.some((status) => status === "degraded")) return "degraded";
  if (statuses.some((status) => status === "unknown")) return "unknown";
  return "healthy";
}

function StatusBadge({ status }: { status: ControlPlaneCheckStatus | "connected" | "missing" }) {
  if (status === "connected") {
    return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">已接入</Badge>;
  }
  if (status === "missing") {
    return <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 dark:text-rose-400">缺失</Badge>;
  }
  return (
    <Badge variant="secondary" className={statusClassName[status]}>
      {statusLabel[status]}
    </Badge>
  );
}

function OverviewStripItem({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "status";
}) {
  return (
    <div className="flex min-w-[108px] flex-col gap-0.5 border-l border-border/60 pl-3 first:min-w-[92px] first:border-l-0 first:pl-0">
      <div className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tracking-tight", tone === "status" && "font-medium")}>{value}</div>
      {hint ? <div className="truncate text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

type OverviewResourceKind = "server" | "deployment" | "domain" | "overlay" | "mcp";

type OverviewResourceSummary = {
  id: string;
  kind: OverviewResourceKind;
  label: string;
  detail: string | null;
  status: ControlPlaneCheckStatus;
};

const overviewResourceKindLabel: Record<OverviewResourceKind, string> = {
  server: "服务器",
  deployment: "部署",
  domain: "域名 / 入口",
  overlay: "外层接入",
  mcp: "MCP",
};

function getOverviewStatusDistribution(summary: ControlPlaneSummary) {
  const counts: Record<ControlPlaneCheckStatus, number> = {
    healthy: 0,
    degraded: 0,
    offline: 0,
    unknown: 0,
  };
  const resources = [
    ...summary.servers,
    ...summary.deployments,
    ...summary.domains,
    ...summary.mcps,
    summary.overlays.mortis,
    summary.overlays.qqBridge,
  ];

  for (const resource of resources) {
    counts[resource.aggregateStatus] += 1;
  }

  return { counts, total: resources.length };
}

function getOverviewResourceSummaries(summary: ControlPlaneSummary): OverviewResourceSummary[] {
  return [
    ...summary.servers.map((server) => ({
      id: `server:${server.id}`,
      kind: "server" as const,
      label: server.name,
      detail: [server.host, server.roles.length > 0 ? server.roles.join(" / ") : null].filter(Boolean).join(" · ") || null,
      status: server.aggregateStatus,
    })),
    ...summary.deployments.map((deployment) => ({
      id: `deployment:${deployment.id}`,
      kind: "deployment" as const,
      label: deployment.name,
      detail: [deployment.serverId, deployment.serviceName ?? null].filter(Boolean).join(" · ") || null,
      status: deployment.aggregateStatus,
    })),
    ...summary.domains.map((domain) => ({
      id: `domain:${domain.id}`,
      kind: "domain" as const,
      label: domain.label,
      detail: domain.url,
      status: domain.aggregateStatus,
    })),
    ...summary.mcps.map((mcp) => ({
      id: `mcp:${mcp.id}`,
      kind: "mcp" as const,
      label: mcp.name,
      detail: [mcp.runtimeServerName ?? mcp.runtimeServerId, mcp.runtimeMode ? formatControlPlaneText(mcp.runtimeMode) : null].filter(Boolean).join(" · ") || null,
      status: mcp.aggregateStatus,
    })),
    {
      id: `overlay:${summary.overlays.mortis.key}`,
      kind: "overlay" as const,
      label: summary.overlays.mortis.label,
      detail: summary.overlays.mortis.primaryUrl ?? (summary.overlays.mortis.description ? formatControlPlaneText(summary.overlays.mortis.description) : null),
      status: summary.overlays.mortis.aggregateStatus,
    },
    {
      id: `overlay:${summary.overlays.qqBridge.key}`,
      kind: "overlay" as const,
      label: summary.overlays.qqBridge.label,
      detail: summary.overlays.qqBridge.primaryUrl ?? (summary.overlays.qqBridge.description ? formatControlPlaneText(summary.overlays.qqBridge.description) : null),
      status: summary.overlays.qqBridge.aggregateStatus,
    },
  ];
}

function CompactStatusDistributionBar({
  counts,
  total,
  activeStatus,
  onToggle,
  onClear,
}: {
  counts: Record<ControlPlaneCheckStatus, number>;
  total: number;
  activeStatus: ControlPlaneCheckStatus | null;
  onToggle: (status: ControlPlaneCheckStatus) => void;
  onClear: () => void;
}) {
  if (total === 0) return null;

  const order: ControlPlaneCheckStatus[] = ["offline", "degraded", "unknown", "healthy"];

  return (
    <div className="flex min-w-[240px] flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex h-1.5 min-w-[160px] flex-1 overflow-hidden rounded-full bg-muted">
        {order.map((status) => {
          const count = counts[status];
          if (count === 0) return null;
          return (
            <button
              type="button"
              key={status}
              onClick={() => onToggle(status)}
              aria-pressed={activeStatus === status}
              className={cn(
                "h-full transition-opacity hover:opacity-90",
                statusFillClassName[status],
                activeStatus && activeStatus !== status && "opacity-35",
              )}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${statusLabel[status]} ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {order.map((status) => {
          const count = counts[status];
          const disabled = count === 0;
          return (
            <button
              type="button"
              key={status}
              disabled={disabled}
              onClick={() => onToggle(status)}
              aria-pressed={activeStatus === status}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors",
                !disabled && "hover:bg-muted/80",
                activeStatus === status && "bg-muted text-foreground",
                disabled && "cursor-default opacity-45",
              )}
            >
            <span className={cn("h-1.5 w-1.5 rounded-full", statusFillClassName[status])} />
            <span>
              {statusLabel[status]} {count}
            </span>
            </button>
          );
        })}
        {activeStatus ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            清空
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OverviewFilterResults({
  summary,
  activeStatus,
  onClear,
}: {
  summary: ControlPlaneSummary;
  activeStatus: ControlPlaneCheckStatus | null;
  onClear: () => void;
}) {
  if (!activeStatus) return null;

  const resources = getOverviewResourceSummaries(summary).filter((resource) => resource.status === activeStatus);

  return (
    <section className="space-y-2 border-b pb-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">状态筛选结果</div>
          <div className="mt-1 text-sm">
            当前只看 <span className={statusTextClassName[activeStatus]}>{statusLabel[activeStatus]}</span> · {resources.length} 项
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          清空筛选
        </Button>
      </div>
      <div className="divide-y">
        {resources.map((resource) => (
          <div key={resource.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium">{resource.label}</div>
                <Badge variant="outline">{overviewResourceKindLabel[resource.kind]}</Badge>
              </div>
              {resource.detail ? <div className="mt-1 break-all text-xs text-muted-foreground">{resource.detail}</div> : null}
            </div>
            <StatusBadge status={resource.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
      <Server className="h-9 w-9 text-muted-foreground/30" />
      <div className="mt-3 text-sm font-medium">{title}</div>
      <div className="mt-1 max-w-xl text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

function WarningPanel({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" />
        当前仍有待收口风险
        <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700/80 dark:text-amber-200">
          {warnings.length}
        </span>
      </div>
      <ul className="mt-2 divide-y text-xs text-muted-foreground">
        {warnings.map((warning) => (
          <li key={warning} className="py-2 first:pt-0 last:pb-0">
            {formatControlPlaneText(warning)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineCode({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">--</span>;
  return <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{value}</code>;
}

function CheckList({ checks }: { checks: ControlPlaneHealthCheck[] }) {
  if (checks.length === 0) {
    return <div className="text-xs text-muted-foreground">暂无健康检查项</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1.3fr)_auto_auto] gap-3 border-b px-0 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>检查项</span>
        <span>类型</span>
        <span>延迟</span>
      </div>
      {checks.map((check) => (
        <div
          key={check.id}
          className="grid grid-cols-[minmax(0,1.3fr)_auto_auto] gap-3 border-b px-0 py-2.5 text-sm last:border-b-0"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{formatControlPlaneText(check.label)}</span>
              <StatusBadge status={check.status} />
            </div>
            <div className="mt-1 break-all text-xs text-muted-foreground">{check.target}</div>
            {check.message ? (
              <div className="mt-1 text-xs text-muted-foreground">{formatControlPlaneText(check.message)}</div>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">{formatControlPlaneText(check.kind.toUpperCase())}</div>
          <div className="text-right text-xs text-muted-foreground">{check.latencyMs != null ? `${check.latencyMs} ms` : "--"}</div>
        </div>
      ))}
    </div>
  );
}

function FactTable({
  items,
  columns = 2,
  compact = false,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
  columns?: 2 | 3;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-x-4 gap-y-2", columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
      {items.map((item) => (
        <div key={item.label} className={cn("py-1", compact && "py-0.5")}>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
          <div className={cn("mt-1 text-sm leading-6", compact && "leading-5")}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function CompactPathList({ paths }: { paths: Record<string, string> }) {
  const entries = Object.entries(paths);
  if (entries.length === 0) return <span className="text-sm text-muted-foreground">暂无路径映射</span>;
  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 text-sm leading-5">
          <span className="text-muted-foreground">{key}</span>
          <span className="break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}

function getNotePreview(note: string) {
  const normalized = note.replace(/\s+/g, " ").trim();
  if (normalized.length <= 36) return normalized;

  const sentenceStop = normalized.search(/[。！？!?；;]/);
  if (sentenceStop >= 0 && sentenceStop < 36) {
    return normalized.slice(0, sentenceStop + 1);
  }

  return `${normalized.slice(0, 36)}…`;
}

function SecondaryNote({ note }: { note: string | null | undefined }) {
  if (!note) return <span className="text-sm text-muted-foreground">--</span>;

  const text = formatControlPlaneText(note);
  const preview = getNotePreview(text);

  return (
    <details className="group text-sm text-muted-foreground">
      <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
        <span>备注</span>
        <span className="ml-2 text-xs normal-case tracking-normal text-muted-foreground">{preview}</span>
      </summary>
      <div className="mt-2 border-l border-border/60 pl-3 text-sm leading-6 text-muted-foreground">{text}</div>
    </details>
  );
}

function SourceCard({ summary }: { summary: ControlPlaneSummary }) {
  const split = summary.overview.sourceRuntimeSplit;
  const canonicalRepo = summary.source.canonicalRepoUrl ?? summary.source.canonicalRepoDisplay ?? "--";
  return (
    <SectionCard
      title="控制面真源"
      description="当前读取的 canonical repo、挂载 checkout 与运行边界。"
      action={<StatusBadge status={summary.source.status} />}
    >
      <div className="divide-y">
        <div className="grid gap-x-4 gap-y-2 py-2 md:grid-cols-4">
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Canonical Repo</div>
            <div className="mt-1 break-all text-sm leading-5">{canonicalRepo}</div>
          </div>
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">挂载仓库根</div>
            <div className="mt-1 break-all text-sm leading-5">{summary.source.repoRoot ?? "--"}</div>
          </div>
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{formatControlPlaneText("Control Plane Root")}</div>
            <div className="mt-1 break-all text-sm leading-5">{summary.source.controlPlaneRoot ?? "--"}</div>
          </div>
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">发布策略</div>
            <div className="mt-1 text-sm leading-5">{split.publishStrategy ?? "--"}</div>
          </div>
        </div>
        <div className="grid gap-x-4 gap-y-2 py-2 md:grid-cols-3">
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">部署源码根</div>
            <div className="mt-1 break-all text-sm leading-5">{split.srcRoot ?? "--"}</div>
          </div>
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">运行根</div>
            <div className="mt-1 break-all text-sm leading-5">{split.runtimeRoot ?? "--"}</div>
          </div>
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">构建工作区</div>
            <div className="mt-1 break-all text-sm leading-5">{split.buildWorkspace ?? "--"}</div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function RouteList({ routes }: { routes: ControlPlaneExecutionRoute[] }) {
  if (routes.length === 0) {
    return <EmptyState title="还没有执行路由" description="execution-routing 还没有解析出任务分流规则。" />;
  }

  return (
    <SectionCard title="执行路由" description="展示不同任务类型会落到哪台机器执行。">
      <div>
        {routes.map((route) => (
          <div key={`${route.taskClass}-${route.ruleId ?? "default"}`} className="border-b py-3 last:border-b-0">
            <div className="grid gap-2 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium">{route.taskClass}</div>
                <Badge variant="outline">{route.ruleId ?? "default"}</Badge>
              </div>
              <Badge variant="secondary" className={route.dispatchable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}>
                {route.dispatchable ? "可调度" : "未就绪"}
              </Badge>
              <div className="grid gap-x-4 gap-y-2 md:grid-cols-3">
                <div className="py-0.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{formatControlPlaneText("Dispatcher")}</div>
                  <div className="mt-1"><InlineCode value={route.dispatcherServerId} /></div>
                </div>
                <div className="py-0.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{formatControlPlaneText("Target")}</div>
                  <div className="mt-1"><InlineCode value={route.targetServerId} /></div>
                </div>
                <div className="py-0.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{formatControlPlaneText("Fallback")}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {route.fallbackTargetServerIds.length > 0 ? route.fallbackTargetServerIds.map((item) => <InlineCode key={item} value={item} />) : <span className="text-sm text-muted-foreground">--</span>}
                  </div>
                </div>
              </div>
            </div>
            {route.warnings.length > 0 ? (
              <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                {route.warnings.map((warning) => (
                  <div key={warning}>- {formatControlPlaneText(warning)}</div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function OverlayCard({ overlay }: { overlay: ControlPlaneOverlayView }) {
  return (
    <div className="border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">{overlay.label}</div>
        <StatusBadge status={overlay.aggregateStatus} />
      </div>
      {overlay.description ? (
        <p className="mt-2 text-xs text-muted-foreground">{overlay.description}</p>
      ) : null}
      <div className="mt-2">
        <FactTable
          compact
          items={[
            ...(overlay.primaryUrl
              ? [{
                  label: "入口",
                  value: (
                    <a href={overlay.primaryUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 hover:text-primary">
                      <span className="truncate">{overlay.primaryUrl}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ),
                }]
              : []),
            ...(overlay.defaultWorkspaceSlug ? [{ label: "默认工作区", value: <InlineCode value={overlay.defaultWorkspaceSlug} /> }] : []),
          ]}
        />
      </div>
      <div className="mt-3">
        <CheckList checks={overlay.checks} />
      </div>
    </div>
  );
}

function ServerCard({ server }: { server: ControlPlaneServerView }) {
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold">{server.name}</div>
        <StatusBadge status={server.aggregateStatus} />
        <Badge variant="outline">{server.enabled ? "启用" : "禁用"}</Badge>
        <InlineCode value={server.id} />
      </div>

      <div className="mt-3">
        <div className="grid gap-x-6 gap-y-3 xl:grid-cols-[180px_280px_1fr_1.1fr]">
          <FactTable compact items={[
            { label: formatControlPlaneText("Host"), value: server.host },
            { label: "服务 / 域名", value: `${Object.keys(server.services).length} 服务 · ${Object.keys(server.domains).length} 域名` },
          ]} />
          <FactTable compact items={[
            { label: "SSH", value: `${server.sshUser ?? "--"}@${server.hostname ?? server.host}:${server.sshPort ?? "--"}` },
            {
              label: "角色",
              value: server.roles.length > 0 ? <div className="flex flex-wrap gap-1">{server.roles.map((role) => <Badge key={role} variant="outline">{role}</Badge>)}</div> : <span className="text-sm text-muted-foreground">--</span>,
            },
          ]} />
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">路径映射</div>
            <div className="mt-1">
              <CompactPathList paths={server.paths} />
            </div>
          </div>
          <div className="py-0.5">
            <SecondaryNote note={server.notes} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">健康检查</div>
        <CheckList checks={server.checks} />
      </div>
    </div>
  );
}

function DeploymentCard({ deployment }: { deployment: ControlPlaneDeploymentView }) {
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold">{deployment.name}</div>
        <StatusBadge status={deployment.aggregateStatus} />
        <Badge variant="outline">{deployment.enabled ? "启用" : "禁用"}</Badge>
        <InlineCode value={deployment.id} />
      </div>

      <div className="mt-3">
        <div className="grid gap-x-6 gap-y-3 xl:grid-cols-[180px_220px_1fr_1.1fr]">
          <FactTable compact items={[
            { label: "目标服务器", value: deployment.serverId },
            { label: "应用 ID", value: deployment.applicationId ?? "--" },
          ]} />
          <FactTable compact items={[
            { label: "服务名", value: deployment.serviceName ?? "--" },
            { label: "发布策略", value: deployment.publishStrategy ?? deployment.mode ?? "--" },
          ]} />
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">路径映射</div>
            <div className="mt-1">
              <CompactPathList paths={deployment.paths} />
            </div>
          </div>
          <div className="py-0.5">
            <SecondaryNote note={deployment.notes} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">健康检查</div>
        <CheckList checks={deployment.checks} />
      </div>
    </div>
  );
}

function DomainCard({ domain }: { domain: ControlPlaneDomainView }) {
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold">{domain.label}</div>
        <StatusBadge status={domain.aggregateStatus} />
        <Badge variant="outline">{domain.category === "entrypoint" ? "入口" : "域名"}</Badge>
      </div>

      <div className="mt-3">
        <div className="grid gap-x-6 gap-y-3 xl:grid-cols-[minmax(0,1.5fr)_220px_220px]">
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{formatControlPlaneText("URL")}</div>
            <div className="mt-1 text-sm leading-5">
              <a href={domain.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 hover:text-primary">
                <span className="truncate">{domain.url}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>
          </div>
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">归属</div>
            <div className="mt-1 text-sm leading-5">{formatOwnerType(domain.ownerType)} / {domain.ownerId}</div>
          </div>
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">域名</div>
            <div className="mt-1 text-sm leading-5">{domain.domain ? <InlineCode value={domain.domain} /> : "--"}</div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <CheckList checks={domain.checks} />
      </div>
    </div>
  );
}

function McpCard({
  mcp,
  canonicalRepo,
}: {
  mcp: ControlPlaneMcpView;
  canonicalRepo: string | null | undefined;
}) {
  const mountedSource = mcp.resolvedSourceEntrypoint ?? mcp.resolvedSourcePath ?? null;
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold">{mcp.name}</div>
        <StatusBadge status={mcp.aggregateStatus} />
        <Badge variant="outline">{mcp.enabled ? "启用" : "禁用"}</Badge>
        {mcp.category ? <Badge variant="outline">{mcp.category}</Badge> : null}
        <InlineCode value={mcp.id} />
      </div>

      <div className="mt-3">
        <div className="grid gap-x-6 gap-y-3 xl:grid-cols-[220px_240px_1fr_1fr]">
          <FactTable compact items={[
            { label: "运行节点", value: mcp.runtimeServerName ?? mcp.runtimeServerId ?? "--" },
            { label: "运行模式", value: mcp.runtimeMode ? formatControlPlaneText(mcp.runtimeMode) : "--" },
          ]} />
          <FactTable compact items={[
            { label: "消费代理", value: mcp.consumerAgentName ?? mcp.consumerAgentId ?? "--" },
            { label: "状态判定", value: mcp.statusModel ? formatControlPlaneText(mcp.statusModel) : "--" },
          ]} />
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">源码映射</div>
            <div className="mt-1 space-y-1 text-sm leading-5">
              {canonicalRepo ? <div className="break-all"><span className="text-muted-foreground">Canonical Repo</span> · {canonicalRepo}</div> : null}
              {mcp.sourcePath ? <div><span className="text-muted-foreground">Repo</span> · {mcp.sourcePath}</div> : null}
              {mountedSource ? <div className="break-all"><span className="text-muted-foreground">Mounted</span> · {mountedSource}</div> : null}
            </div>
          </div>
          <div className="py-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">运行位置</div>
            <div className="mt-1 space-y-1 text-sm leading-5">
              {mcp.runtimePath ? <div className="break-all"><span className="text-muted-foreground">Entrypoint</span> · {mcp.runtimePath}</div> : null}
              {mcp.consumerConfigPath ? <div className="break-all"><span className="text-muted-foreground">Config</span> · {mcp.consumerConfigPath}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">状态检查</div>
        <CheckList checks={mcp.checks} />
      </div>

      <div className="mt-3">
        <SecondaryNote note={mcp.notes} />
      </div>
    </div>
  );
}

function McpPanel({ summary }: { summary: ControlPlaneSummary }) {
  if (summary.mcps.length === 0) {
    return (
      <EmptyState
        title="还没有 MCP 运行图谱"
        description="控制面真源里尚未登记需要在 Mortis 中展示的 MCP runtime/source 映射。"
      />
    );
  }

  return (
    <SectionCard
      title="MCP 运行图谱"
      description="说明这些 MCP 跑在哪台机器、源码真源在仓库哪里，以及 Mortis 当前如何判定它们可用。"
      action={(
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Boxes className="h-3.5 w-3.5" />
          <span>{summary.mcps.length} 项</span>
        </div>
      )}
    >
      <div className="divide-y">
        {summary.mcps.map((mcp) => (
          <McpCard
            key={mcp.id}
            mcp={mcp}
            canonicalRepo={summary.source.canonicalRepoUrl ?? summary.source.canonicalRepoDisplay}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function OverviewStatusBar({ summary, warningCount }: { summary: ControlPlaneSummary; warningCount: number }) {
  const [activeStatus, setActiveStatus] = React.useState<ControlPlaneCheckStatus | null>(null);
  const overlayStatus = mergeStatuses([
    summary.overlays.mortis.aggregateStatus,
    summary.overlays.qqBridge.aggregateStatus,
  ]);
  const statusDistribution = getOverviewStatusDistribution(summary);
  const handleToggleStatus = (status: ControlPlaneCheckStatus) => {
    setActiveStatus((current) => (current === status ? null : status));
  };

  return (
    <div className="border-b pb-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        <OverviewStripItem label="服务器" value={summary.overview.counts.servers} hint={`启用 ${summary.overview.counts.enabledServers}`} />
        <OverviewStripItem label="部署目标" value={summary.overview.counts.deployTargets} hint={`启用 ${summary.overview.counts.enabledTargets}`} />
        <OverviewStripItem label="域名 / 入口" value={summary.overview.counts.domains} />
        <OverviewStripItem label="重点 MCP" value={summary.overview.counts.mcps} hint="运行与源码映射" />
        <OverviewStripItem label="执行路由" value={summary.overview.routes.length} />
        <OverviewStripItem
          label="外层接入"
          value={<span className={statusTextClassName[overlayStatus]}>{statusLabel[overlayStatus]}</span>}
          hint="Mortis / QQ"
          tone="status"
        />
        <OverviewStripItem
          label="待收口"
          value={<span className={warningCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>{warningCount}</span>}
          hint={warningCount > 0 ? "风险项" : "当前无新增"}
          tone="status"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-2.5">
        <div className="min-w-[108px]">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">资源状态</div>
          <div className="mt-1 text-xs text-muted-foreground">{statusDistribution.total} 个观测对象</div>
        </div>
        <CompactStatusDistributionBar
          counts={statusDistribution.counts}
          total={statusDistribution.total}
          activeStatus={activeStatus}
          onToggle={handleToggleStatus}
          onClear={() => setActiveStatus(null)}
        />
      </div>
      <div className="mt-3">
        <OverviewFilterResults summary={summary} activeStatus={activeStatus} onClear={() => setActiveStatus(null)} />
      </div>
    </div>
  );
}

function OverviewPanel({ summary }: { summary: ControlPlaneSummary }) {
  return (
    <div className="space-y-4">
      <SourceCard summary={summary} />
      <RouteList routes={summary.overview.routes} />
      <McpPanel summary={summary} />

      <SectionCard title="外层接入状态" description="Mortis 自身和 QQ bridge 当前在控制面中的观测摘要。">
        <div className="divide-y">
          <OverlayCard overlay={summary.overlays.mortis} />
          <OverlayCard overlay={summary.overlays.qqBridge} />
        </div>
      </SectionCard>
    </div>
  );
}

function ServersPanel({ summary }: { summary: ControlPlaneSummary }) {
  if (summary.servers.length === 0) {
    return <EmptyState title="还没有服务器视图" description="控制面真源里尚未解析出 server inventory，或当前真源未接入。" />;
  }
  const activeServers = summary.servers.filter((server) => server.enabled);
  const parkedServers = summary.servers.filter((server) => !server.enabled);
  const [parkedOpen, setParkedOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <SectionCard
        title="活跃服务器"
        description="默认先看当前参与执行与对外承载的节点。"
        action={(
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            <span>{activeServers.length} 台</span>
          </div>
        )}
      >
        <div className="divide-y">
          {activeServers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      </SectionCard>

      {parkedServers.length > 0 ? (
        <SectionCard
          title="停放资产 / Inventory"
          description="disabled 资产保留登记，但默认折叠，避免抢占活跃节点主视图。"
          action={(
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParkedOpen((current) => !current)}
            >
              <ChevronRight className={cn("mr-1 h-3.5 w-3.5 transition-transform", parkedOpen && "rotate-90")} />
              {parkedOpen ? "收起" : "展开"} {parkedServers.length} 项
            </Button>
          )}
        >
          {parkedOpen ? (
            <div className="divide-y">
              {parkedServers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              当前已隐藏 {parkedServers.length} 个 disabled 资产；需要排查或重新启用时再展开查看。
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}

function DeploymentsPanel({ summary }: { summary: ControlPlaneSummary }) {
  if (summary.deployments.length === 0) {
    return <EmptyState title="还没有部署目标视图" description="deploy-targets 已有 summary 类型和 API，但页面还没有读到可展示的目标，或真源仍未接入。" />;
  }
  return (
    <div className="divide-y">
      {summary.deployments.map((deployment) => (
        <DeploymentCard key={deployment.id} deployment={deployment} />
      ))}
    </div>
  );
}

function DomainsPanel({ summary }: { summary: ControlPlaneSummary }) {
  if (summary.domains.length === 0) {
    return <EmptyState title="还没有域名 / 入口视图" description="域名聚合需要同时依赖 server.domains、deployment.health 和 overlay 入口。" />;
  }
  return (
    <div className="divide-y">
      {summary.domains.map((domain) => (
        <DomainCard key={domain.id} domain={domain} />
      ))}
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap gap-3 border-b pb-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-24 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}

export function ControlPlanePage({ view }: { view: ControlPlaneView }) {
  const workspace = useCurrentWorkspace();
  const { data: summary, isLoading, isFetching, error, refetch } = useQuery(controlPlaneSummaryOptions());

  const navItems: Array<{
    key: ControlPlaneView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: "overview", label: "总览", icon: LayoutDashboard },
    { key: "servers", label: "服务器", icon: Server },
    { key: "deployments", label: "部署", icon: Rocket },
    { key: "domains", label: "域名", icon: Globe },
  ];

  const current = navItems.find((item) => item.key === view) ?? navItems[0]!;
  const warnings = summary ? aggregateWarnings(summary) : [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="justify-between px-5">
        <div className="flex min-w-0 items-center gap-2">
          <current.icon className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium">{current.label}</div>
            <div className="text-xs text-muted-foreground">
              {workspace?.name ?? "Mortis"} · Atramenti 控制面接入
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary ? <StatusBadge status={summary.source.status} /> : null}
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", isFetching && "animate-spin")} />
            刷新
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <LoadingPanel />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5">
            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                控制面 summary 加载失败：{error instanceof Error ? error.message : "unknown error"}
              </div>
            ) : null}

            {summary && view === "overview" ? <OverviewStatusBar summary={summary} warningCount={warnings.length} /> : null}

            {summary ? <WarningPanel warnings={warnings} /> : null}

            {summary ? (
              <>
                {view === "overview" ? <OverviewPanel summary={summary} /> : null}
                {view === "servers" ? <ServersPanel summary={summary} /> : null}
                {view === "deployments" ? <DeploymentsPanel summary={summary} /> : null}
                {view === "domains" ? <DomainsPanel summary={summary} /> : null}
              </>
            ) : (
              <EmptyState title="控制面 summary 暂不可用" description="API 返回为空，先确认 /api/control-plane/summary 在当前环境已经挂上。" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
