"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Clock3,
  BrainCircuit,
  Cpu,
  FileCheck2,
  GitBranch,
  Network,
  RadioTower,
} from "lucide-react";
import { agentOSSummaryOptions } from "@multica/core/agent-os/queries";
import { useWorkspaceId } from "@multica/core/hooks";
import type {
  AgentOSAction,
  AgentOSArtifact,
  AgentOSRuntime,
  AgentOSStudioState,
} from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { cn } from "@multica/ui/lib/utils";
import { PageHeader } from "../../layout/page-header";

const actionTone: Record<string, string> = {
  proposed: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  awaiting_approval: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  executed: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  cancelled: "bg-muted text-muted-foreground",
};

const stateTone: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  partial: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  missing: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  blocked: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  operator_only: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

export function AgentOSPage() {
  const wsId = useWorkspaceId();
  const { data: summary, isLoading, error } = useQuery(agentOSSummaryOptions(wsId));

  const onlineRuntimes = useMemo(
    () => summary?.runtimes.filter((runtime) => runtime.status === "online") ?? [],
    [summary],
  );
  const activeActions = useMemo(
    () => summary?.actions.filter((action) => ["proposed", "awaiting_approval", "approved", "executed"].includes(action.status)) ?? [],
    [summary],
  );
  const blockedState = useMemo(
    () => summary?.studio_state.filter((item) => item.status === "blocked" || item.status === "missing") ?? [],
    [summary],
  );
  const latestAction = summary?.actions[0];
  const latestArtifact = summary?.artifacts[0];
  const recentArtifacts = summary?.artifacts.slice(0, 4) ?? [];
  const channelState = getChannelState(summary?.studio_state ?? []);
  const nextDecision = getNextDecision(activeActions, blockedState, summary?.artifacts ?? []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader>
        <div className="flex min-w-0 items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <h1 className="truncate text-sm font-semibold">Agent OS</h1>
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5">
          {error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              Agent OS summary 加载失败：{error instanceof Error ? error.message : "unknown error"}
            </div>
          ) : null}

          {isLoading || !summary ? (
            <LoadingState />
          ) : (
            <>
              <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <MetricCard icon={RadioTower} label="Workflow" value={nextDecision.label} tone={nextDecision.tone} />
                <MetricCard icon={Activity} label="Active Chain" value={summary.counts.active_actions} />
                <MetricCard icon={FileCheck2} label="Evidence" value={summary.counts.recent_artifacts} />
                <MetricCard icon={Cpu} label="Runtimes" value={`${onlineRuntimes.length}/${summary.counts.runtimes}`} />
                <MetricCard icon={AlertTriangle} label="Open Gaps" value={summary.counts.blocked_state} tone={summary.counts.blocked_state > 0 ? "warn" : "default"} />
                <MetricCard icon={Network} label="Channels" value={channelState.label} tone={channelState.tone} />
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <Panel title="Operator Cockpit" icon={RadioTower}>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <CockpitCard
                      icon={GitBranch}
                      label="Current Chain"
                      title={latestAction ? `${latestAction.role_title} / ${latestAction.action_type}` : "No active task"}
                      detail={latestAction ? `${latestAction.status} · risk ${latestAction.risk_level} · ${formatDate(latestAction.updated_at)}` : "Waiting for an approved action contract."}
                      tone={latestAction?.status === "awaiting_approval" ? "warn" : "default"}
                    />
                    <CockpitCard
                      icon={ClipboardCheck}
                      label="Latest Evidence"
                      title={latestArtifact ? latestArtifact.title || latestArtifact.artifact_type : "No artifact yet"}
                      detail={latestArtifact ? `${latestArtifact.artifact_type} · ${latestArtifact.status} · ${formatDate(latestArtifact.created_at)}` : "Builder and Tester evidence will appear here."}
                    />
                    <CockpitCard
                      icon={Clock3}
                      label="Next Operator Move"
                      title={nextDecision.title}
                      detail={nextDecision.detail}
                      tone={nextDecision.tone}
                    />
                  </div>
                </Panel>

                <Panel title="Open Decisions" icon={AlertTriangle}>
                  <div className="space-y-2">
                    {(blockedState.length > 0 ? blockedState : activeActions.slice(0, 4)).map((item) =>
                      "state_key" in item ? <StudioStateRow key={item.id} item={item} /> : <ActionRow key={item.id} action={item} />,
                    )}
                    {blockedState.length === 0 && activeActions.length === 0 ? <EmptyLine text="No blocked decision. The chain is idle." /> : null}
                  </div>
                </Panel>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                <Panel title="Execution Chain" icon={GitBranch}>
                  <div className="space-y-2">
                    {(activeActions.length > 0 ? activeActions : summary.actions.slice(0, 8)).map((action) => (
                      <ActionRow key={action.id} action={action} />
                    ))}
                    {summary.actions.length === 0 ? <EmptyLine text="No role actions yet." /> : null}
                  </div>
                </Panel>

                <Panel title="Evidence Journal" icon={Boxes}>
                  <div className="space-y-2">
                    {(recentArtifacts.length > 0 ? recentArtifacts : summary.artifacts.slice(0, 10)).map((artifact) => (
                      <ArtifactRow key={artifact.id} artifact={artifact} runtime={findRuntime(summary.runtimes, artifact)} />
                    ))}
                    {summary.artifacts.length === 0 ? <EmptyLine text="No artifacts yet." /> : null}
                  </div>
                </Panel>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                <Panel title="Channel Gateway" icon={Network}>
                  <div className="space-y-2">
                    <CockpitCard
                      icon={Network}
                      label="IM Boundary"
                      title={channelState.title}
                      detail={channelState.detail}
                      tone={channelState.tone}
                    />
                    <div className="rounded-md border border-dashed px-3 py-3 text-xs leading-5 text-muted-foreground">
                      QQ / Telegram / Discord are command and notification terminals. Mortis Shell, action contracts, artifacts, and verification remain the core path when an IM adapter is degraded.
                    </div>
                  </div>
                </Panel>

                <Panel title="Runtime Topology" icon={Network}>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <TopologyColumn title="Roles" items={summary.roles.map((role) => ({
                      id: role.id,
                      title: role.title,
                      subtitle: `${role.name} · ${role.default_runtime}`,
                      badge: role.built_in ? "built-in" : "custom",
                    }))} />
                    <TopologyColumn title="Agents" items={summary.agents.slice(0, 10).map((agent) => ({
                      id: agent.id,
                      title: agent.name,
                      subtitle: `${agent.runtime_mode} · ${agent.status}`,
                      badge: agent.archived_at ? "archived" : agent.visibility,
                    }))} />
                    <TopologyColumn title="Runtimes" items={summary.runtimes.slice(0, 10).map((runtime) => ({
                      id: runtime.id,
                      title: runtime.name,
                      subtitle: `${runtime.provider} · ${runtime.runtime_mode}`,
                      badge: runtime.status,
                    }))} />
                  </div>
                </Panel>

                <Panel title="Studio State" icon={BrainCircuit}>
                  <div className="space-y-2">
                    {(blockedState.length > 0 ? blockedState : summary.studio_state.slice(0, 8)).map((item) => (
                      <StudioStateRow key={item.id} item={item} />
                    ))}
                    {summary.studio_state.length === 0 ? <EmptyLine text="No studio state recorded." /> : null}
                  </div>
                </Panel>
              </section>

            </>
          )}
        </div>
      </div>
    </div>
  );
}


function CockpitCard({
  icon: Icon,
  label,
  title,
  detail,
  tone = "default",
}: {
  icon: typeof Network;
  label: string;
  title: string;
  detail: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className={cn("rounded-md border bg-muted/15 px-3 py-3", tone === "warn" && "border-amber-500/30 bg-amber-500/5")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-2 truncate text-sm font-semibold">{title}</div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Network;
  label: string;
  value: number | string;
  tone?: "default" | "warn";
}) {
  return (
    <div className={cn("rounded-lg border bg-card px-3 py-3", tone === "warn" && "border-amber-500/30 bg-amber-500/5")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Network;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TopologyColumn({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; subtitle: string; badge: string }>;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-md border bg-muted/15 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-sm font-medium">{item.title}</div>
              <Badge variant="outline" className="ml-auto shrink-0">{item.badge}</Badge>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{item.subtitle}</div>
          </div>
        ))}
        {items.length === 0 ? <EmptyLine text="None" /> : null}
      </div>
    </div>
  );
}

function ActionRow({ action }: { action: AgentOSAction }) {
  return (
    <div className="rounded-md border bg-muted/15 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{action.role_title}</Badge>
        <span className="text-sm font-medium">{action.action_type}</span>
        <Badge variant="secondary" className={actionTone[action.status] ?? ""}>{action.status}</Badge>
        {action.requires_approval ? <Badge variant="secondary">approval</Badge> : null}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {shortId(action.id)} · risk {action.risk_level} · {formatDate(action.updated_at)}
      </div>
    </div>
  );
}

function ArtifactRow({ artifact, runtime }: { artifact: AgentOSArtifact; runtime?: AgentOSRuntime }) {
  return (
    <div className="rounded-md border bg-muted/15 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{artifact.artifact_type}</Badge>
        <span className="text-sm font-medium">{artifact.title || artifact.artifact_type}</span>
        <Badge variant="secondary">{artifact.status}</Badge>
        {artifact.verification_status ? <Badge variant="outline">{artifact.verification_status}</Badge> : null}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {artifact.produced_by || runtime?.name || "unknown"} · {artifact.uri || shortId(artifact.id)} · {formatDate(artifact.created_at)}
      </div>
    </div>
  );
}

function StudioStateRow({ item }: { item: AgentOSStudioState }) {
  return (
    <div className="rounded-md border bg-muted/15 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.state_key}</span>
        <Badge variant="secondary" className={stateTone[item.status] ?? ""}>{item.status}</Badge>
        {item.owner_role ? <Badge variant="outline">{item.owner_role}</Badge> : null}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</div>
      {item.next_action ? <div className="mt-1 truncate text-xs text-muted-foreground">Next: {item.next_action}</div> : null}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{text}</div>;
}

function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

function shortId(id: string | null | undefined) {
  if (!id) return "";
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}



function getChannelState(items: AgentOSStudioState[]) {
  const related = items.filter((item) => /qq|napcat|channel|gateway|im/i.test(`${item.state_key} ${item.state_type} ${item.summary}`));
  const blocked = related.find((item) => item.status === "blocked" || item.status === "missing");
  if (blocked) {
    return { label: "Degraded", title: blocked.state_key, detail: blocked.next_action || blocked.summary || "Channel adapter needs attention.", tone: "warn" as const };
  }
  if (related.length > 0) {
    return { label: "Optional", title: "Channels are terminals", detail: "IM adapters are available as ingress/egress, not as the system core.", tone: "default" as const };
  }
  return { label: "Optional", title: "No channel gate required", detail: "Use the Web Shell as the primary operator surface; connect IM adapters only as terminals.", tone: "default" as const };
}

function getNextDecision(actions: AgentOSAction[], blockedState: AgentOSStudioState[], artifacts: AgentOSArtifact[]) {
  const awaiting = actions.find((action) => action.status === "awaiting_approval" || action.status === "proposed");
  if (awaiting) {
    return { label: "Needs Decision", title: "Review action contract", detail: `${awaiting.role_title} is waiting on ${awaiting.action_type}.`, tone: "warn" as const };
  }
  const blocked = blockedState[0];
  if (blocked) {
    return { label: "Blocked", title: blocked.state_key, detail: blocked.next_action || blocked.summary || "Resolve the open gap.", tone: "warn" as const };
  }
  const active = actions[0];
  if (active) {
    return { label: "Running", title: "Watch execution", detail: `${active.role_title} ${active.status}; wait for deterministic artifacts.`, tone: "default" as const };
  }
  if (artifacts.length > 0) {
    return { label: "Ready", title: "Review latest evidence", detail: "No active chain. Inspect the latest artifact or start the next task.", tone: "default" as const };
  }
  return { label: "Idle", title: "Start with one task", detail: "Create a structured action contract before asking agents to work.", tone: "default" as const };
}

function findRuntime(runtimes: AgentOSRuntime[], artifact: AgentOSArtifact) {
  const runtimeName = typeof artifact.metadata.runtime === "string" ? artifact.metadata.runtime : "";
  if (!runtimeName) return undefined;
  return runtimes.find((runtime) => runtime.name === runtimeName || runtime.provider === runtimeName);
}
