"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  Cloud,
  Copy,
  Cpu,
  FileSliders,
  Laptop,
  ShieldUser,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { AgentRuntime } from "@multica/core/types";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { memberListOptions } from "@multica/core/workspace/queries";
import { useDeleteRuntime } from "@multica/core/runtimes/mutations";
import { Button } from "@multica/ui/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import {
  formatLastSeen,
  formatRuntimeMode,
  formatRuntimeProvider,
  parseCodexConfigSummary,
  parseRuntimeIdentity,
} from "../utils";
import { StatusBadge } from "./shared";
import { ProviderLogo } from "./provider-logo";
import { PingSection } from "./ping-section";
import { UpdateSection } from "./update-section";
import { UsageSection } from "./usage-section";

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function DetailCard({
  label,
  value,
  mono,
  action,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </div>
          <div
            className={`mt-1 break-all text-sm text-foreground ${
              mono ? "font-mono text-xs leading-5" : ""
            }`}
          >
            {value}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background/80 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function RuntimePill({ tone, children }: { tone: "ok" | "warn" | "missing"; children: ReactNode }) {
  const toneClass = {
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    missing: "border-muted-foreground/25 bg-muted/50 text-muted-foreground",
  }[tone];

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function CodexConfigPanel({ runtime }: { runtime: AgentRuntime }) {
  const summary = parseCodexConfigSummary(runtime);
  if (!summary) return null;

  const configFacts = [
    { label: "模型", value: summary.model },
    { label: "Provider", value: summary.modelProvider },
    { label: "Reasoning", value: summary.reasoningEffort },
    { label: "Approval", value: summary.approvalPolicy },
    { label: "Sandbox", value: summary.sandboxMode },
    { label: "配置路径", value: summary.configPath },
    { label: "快照路径", value: summary.snapshotPath },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <SectionBlock
      title="Codex 配置可见性"
      description="这里展示运行时 metadata 已上报的 Codex 配置摘要；若未上报，说明页面无法从当前 runtime 记录确认 config.toml 或 MCP 条目。"
    >
      <div className="rounded-2xl border bg-background/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
              <FileSliders className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium text-foreground">{summary.sourceLabel}</div>
                <RuntimePill tone={summary.statusTone}>{summary.statusLabel}</RuntimePill>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {summary.visible
                  ? "该 runtime 已上报可展示的 Codex 配置字段；敏感值应继续只显示为摘要或路径。"
                  : runtime.status === "online"
                    ? "runtime 在线但没有上报 Codex 配置摘要，需要 daemon/heartbeat 补充 codex_config 或 mcp_servers 字段。"
                    : "runtime 当前离线且未上报配置摘要，重启本机 daemon 后才可能刷新这里。"}
              </p>
            </div>
          </div>
          <div className="rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
            MCP {summary.mcpServers.length} 项
          </div>
        </div>

        {configFacts.length > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {configFacts.map((fact) => (
              <DetailCard key={fact.label} label={fact.label} value={fact.value} mono />
            ))}
          </div>
        )}

        {summary.mcpServers.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              MCP servers
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.mcpServers.map((server) => (
                <span key={server} className="rounded-full border bg-muted/30 px-2 py-1 font-mono text-xs">
                  {server}
                </span>
              ))}
            </div>
          </div>
        )}

        {summary.notes.length > 0 && (
          <div className="mt-4 space-y-1 text-xs leading-5 text-muted-foreground">
            {summary.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        )}
      </div>
    </SectionBlock>
  );
}

export function RuntimeDetail({ runtime }: { runtime: AgentRuntime }) {
  const {
    title,
    hostHint,
    cliVersion,
    launchedBy,
    environment,
    summary,
  } = parseRuntimeIdentity(runtime);

  const user = useAuthStore((s) => s.user);
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const deleteMutation = useDeleteRuntime(wsId);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const ownerMember = runtime.owner_id
    ? members.find((m) => m.user_id === runtime.owner_id) ?? null
    : null;

  const currentMember = user
    ? members.find((m) => m.user_id === user.id)
    : null;
  const isAdmin = currentMember
    ? currentMember.role === "owner" || currentMember.role === "admin"
    : false;
  const isRuntimeOwner = Boolean(user && runtime.owner_id === user.id);
  const canDelete = isAdmin || isRuntimeOwner;

  const handleDelete = () => {
    deleteMutation.mutate(runtime.id, {
      onSuccess: () => {
        toast.success("运行时已删除");
        setDeleteOpen(false);
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "删除运行时失败");
      },
    });
  };

  const handleCopy = async (key: string, label: string, value: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success(`${label}已复制`);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1200);
    } catch {
      toast.error(`复制${label}失败`);
    }
  };

  const metadataEntries = runtime.metadata
    ? Object.keys(runtime.metadata).length
    : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
              <ProviderLogo provider={runtime.provider} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                  {title}
                </h2>
                <StatusBadge status={runtime.status} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {summary || environment}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border px-2 py-0.5">
                  {formatRuntimeProvider(runtime.provider)}
                </span>
                <span className="rounded-full border px-2 py-0.5">
                  {formatRuntimeMode(runtime.runtime_mode)}
                </span>
                {hostHint && (
                  <span className="rounded-full border px-2 py-0.5">
                    主机 {hostHint}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy("runtime-id", "运行时 ID", runtime.id)}
            >
              {copiedKey === "runtime-id" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              复制 ID
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <SectionBlock
          title="运行时概览"
          description="优先展示当前运行面、宿主信息和控制入口，避免把重要状态埋进原始元数据。"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Laptop className="h-3.5 w-3.5" />}
              label="宿主 / 设备"
              value={runtime.device_info || hostHint || "未上报"}
              hint={runtime.launch_header || "未上报启动头"}
            />
            <MetricCard
              icon={
                runtime.runtime_mode === "cloud" ? (
                  <Cloud className="h-3.5 w-3.5" />
                ) : (
                  <TerminalSquare className="h-3.5 w-3.5" />
                )
              }
              label="运行面"
              value={environment}
              hint={formatRuntimeProvider(runtime.provider)}
            />
            <MetricCard
              icon={<Cpu className="h-3.5 w-3.5" />}
              label="CLI / 启动人"
              value={cliVersion ? `v${cliVersion}` : "未上报"}
              hint={launchedBy || "未上报启动人"}
            />
            <MetricCard
              icon={<ShieldUser className="h-3.5 w-3.5" />}
              label="所有者 / 最后在线"
              value={ownerMember?.name || "未绑定工作区所有者"}
              hint={formatLastSeen(runtime.last_seen_at)}
            />
          </div>
        </SectionBlock>

        <SectionBlock
          title="身份与控制锚点"
          description="这里放稳定可复制的控制标识，供事项、记录与运维排障时直接回跳。"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <DetailCard
              label="运行时 ID"
              value={runtime.id}
              mono
              action={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleCopy("runtime-id-card", "运行时 ID", runtime.id)}
                >
                  {copiedKey === "runtime-id-card" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              }
            />
            <DetailCard
              label="守护进程 ID"
              value={runtime.daemon_id || "未绑定"}
              mono
              action={
                runtime.daemon_id ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      handleCopy("daemon-id", "守护进程 ID", runtime.daemon_id)
                    }
                  >
                    {copiedKey === "daemon-id" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : null
              }
            />
            <DetailCard
              label="启动头"
              value={runtime.launch_header || "未上报"}
            />
            <DetailCard
              label="创建 / 更新时间"
              value={`${new Date(runtime.created_at).toLocaleString()} / ${new Date(
                runtime.updated_at,
              ).toLocaleString()}`}
            />
          </div>
        </SectionBlock>

        {runtime.runtime_mode === "local" && (
          <SectionBlock
            title="运行时维护"
            description="本地运行时直接在这里做版本检查与升级，不再把更新面板埋成孤立模块。"
          >
            <UpdateSection
              runtimeId={runtime.id}
              currentVersion={cliVersion}
              isOnline={runtime.status === "online"}
              launchedBy={launchedBy}
            />
          </SectionBlock>
        )}

        <CodexConfigPanel runtime={runtime} />

        <SectionBlock
          title="连接测试"
          description="从当前控制面直接验证这个运行时是否还能接任务。"
        >
          <PingSection runtimeId={runtime.id} />
        </SectionBlock>

        <SectionBlock
          title="令牌用量"
          description="继续复用现有运行时用量数据面，不额外引入新后端接口。"
        >
          <UsageSection runtimeId={runtime.id} />
        </SectionBlock>

        {metadataEntries > 0 && (
          <SectionBlock
            title="原始元数据"
            description="保留原始字段作为兜底排障视图；结构化信息以上面的控制中心视图为准。"
          >
            <div className="rounded-xl border bg-muted/20 p-3">
              <pre className="whitespace-pre-wrap break-all text-xs leading-5 text-foreground/85">
                {JSON.stringify(runtime.metadata, null, 2)}
              </pre>
            </div>
          </SectionBlock>
        )}
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(value) => {
          if (!value) setDeleteOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除运行时</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除 &ldquo;{runtime.name}&rdquo; 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
