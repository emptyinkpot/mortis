"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Bot, ChevronRight, ChevronDown, Loader2, ArrowDown, Brain, AlertCircle, Clock, CheckCircle2, XCircle, Square, Maximize2, Link2 } from "lucide-react";
import { api } from "@multica/core/api";
import { useWSEvent } from "@multica/core/realtime";
import type { TaskMessagePayload, TaskCompletedPayload, TaskFailedPayload, TaskCancelledPayload } from "@multica/core/types/events";
import type { AgentTask } from "@multica/core/types/agent";
import { useWorkspacePaths } from "@multica/core/paths";
import { cn } from "@multica/ui/lib/utils";
import { toast } from "sonner";
import { ActorAvatar } from "../../common/actor-avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@multica/ui/components/ui/collapsible";
import { useActorName } from "@multica/core/workspace/hooks";
import { useNavigation } from "../../navigation";
import { redactSecrets } from "../utils/redact";
import { extractBrowserEvidence, type BrowserEvidenceSummary } from "../utils/browser-evidence";
import { AgentTranscriptDialog } from "./agent-transcript-dialog";

// ─── Shared types & helpers ─────────────────────────────────────────────────

/** A unified timeline entry: tool calls, thinking, text, and errors in chronological order. */
interface TimelineItem {
  seq: number;
  type: "tool_use" | "tool_result" | "thinking" | "text" | "error";
  tool?: string;
  content?: string;
  input?: Record<string, unknown>;
  output?: string;
}

function formatElapsed(startedAt: string): string {
  const elapsed = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function shortenPath(p: string): string {
  const parts = p.split(/[\\/]/);
  if (parts.length <= 3) return p;
  return ".../" + parts.slice(-2).join("/");
}

function getToolSummary(item: TimelineItem): string {
  if (!item.input) return "";
  const inp = item.input as Record<string, string>;

  // WebSearch / web search
  if (inp.query) return inp.query;
  // File operations
  if (inp.file_path) return shortenPath(inp.file_path);
  if (inp.path) return shortenPath(inp.path);
  if (inp.pattern) return inp.pattern;
  // Bash
  if (inp.description) return String(inp.description);
  if (inp.command) {
    const cmd = String(inp.command);
    return cmd.length > 100 ? cmd.slice(0, 100) + "..." : cmd;
  }
  // Agent
  if (inp.prompt) {
    const p = String(inp.prompt);
    return p.length > 100 ? p.slice(0, 100) + "..." : p;
  }
  // Skill
  if (inp.skill) return String(inp.skill);
  // Fallback: show first string value
  for (const v of Object.values(inp)) {
    if (typeof v === "string" && v.length > 0 && v.length < 120) return v;
  }
  return "";
}

function formatBrowserStatus(status: string): string {
  switch (status) {
    case "verified":
      return "已验证";
    case "blocked":
      return "已阻塞";
    case "failed":
      return "失败";
    case "completed":
      return "已完成";
    case "running":
      return "运行中";
    default:
      return status;
  }
}

function getBrowserStatusClass(status?: string): string {
  switch (status) {
    case "verified":
    case "completed":
      return "bg-success/10 text-success";
    case "blocked":
      return "bg-warning/10 text-warning";
    case "failed":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-info/10 text-info";
  }
}

function getArtifactLabel(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function getBrowserEvidenceBadgeLabel(evidence: BrowserEvidenceSummary): string {
  return evidence.artifacts.length > 0
    ? `浏览器证据 ${evidence.artifacts.length}`
    : "Browser Task";
}

function BrowserEvidencePanel({
  evidence,
  className,
}: {
  evidence: BrowserEvidenceSummary;
  className?: string;
}) {
  const artifacts = evidence.artifacts.slice(0, 3);
  const extraArtifactCount = Math.max(0, evidence.artifacts.length - artifacts.length);
  const title = evidence.action === "browser.run" ? "Browser Task" : "浏览器证据";

  return (
    <div className={cn("border-t border-info/10 px-3 py-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-info/10 px-2 py-0.5 font-medium text-info">
          {title}
        </span>
        {evidence.gatewayStatus && (
          <span className={cn("rounded-full px-2 py-0.5 font-medium", getBrowserStatusClass(evidence.gatewayStatus))}>
            {formatBrowserStatus(evidence.gatewayStatus)}
          </span>
        )}
        {evidence.verificationLevel && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            验证 {evidence.verificationLevel}
          </span>
        )}
        {evidence.artifacts.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {evidence.artifacts.length} 份截图
          </span>
        )}
      </div>

      <div className="mt-2 space-y-1.5 text-xs">
        {evidence.url && (
          <div className="flex items-start gap-2">
            <span className="w-12 shrink-0 text-muted-foreground">目标</span>
            <code className="min-w-0 break-all rounded bg-background/70 px-1.5 py-0.5 text-[11px]">
              {evidence.url}
            </code>
          </div>
        )}

        {evidence.purpose && (
          <div className="flex items-start gap-2">
            <span className="w-12 shrink-0 text-muted-foreground">目的</span>
            <span className="min-w-0 break-words text-foreground/90">{evidence.purpose}</span>
          </div>
        )}

        {evidence.message && (
          <div className="flex items-start gap-2">
            <span className="w-12 shrink-0 text-muted-foreground">摘要</span>
            <span className="min-w-0 break-words text-foreground/90">{evidence.message}</span>
          </div>
        )}

        {artifacts.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="w-12 shrink-0 pt-0.5 text-muted-foreground">证据</span>
            <div className="min-w-0 flex-1 space-y-1">
              {artifacts.map((artifact) => (
                <div
                  key={`${artifact.kind}:${artifact.path}`}
                  className="rounded border border-border/60 bg-background/70 px-2 py-1"
                  title={artifact.path}
                >
                  <div className="font-medium text-foreground">{getArtifactLabel(artifact.path)}</div>
                  <code className="mt-0.5 block break-all text-[11px] text-muted-foreground">
                    {artifact.path}
                  </code>
                </div>
              ))}
              {extraArtifactCount > 0 && (
                <p className="text-[11px] text-muted-foreground">另有 {extraArtifactCount} 份截图证据</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentBrowserEvidenceCallout({
  task,
  evidence,
}: {
  task: AgentTask;
  evidence: BrowserEvidenceSummary;
}) {
  return (
    <div className="rounded-lg border border-info/20 bg-info/5">
      <div className="flex items-center justify-between gap-2 border-b border-info/10 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">最近浏览器证据</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(task.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" · "}
            {task.status === "completed" ? "已完成" : task.status}
          </p>
        </div>
        <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info shrink-0">
          {getBrowserEvidenceBadgeLabel(evidence)}
        </span>
      </div>
      <BrowserEvidencePanel evidence={evidence} className="border-t-0 px-3 py-2" />
    </div>
  );
}

/** Build a chronologically ordered timeline from raw messages. */
function buildTimeline(msgs: TaskMessagePayload[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const msg of msgs) {
    items.push({
      seq: msg.seq,
      type: msg.type,
      tool: msg.tool,
      content: msg.content ? redactSecrets(msg.content) : msg.content,
      input: msg.input,
      output: msg.output ? redactSecrets(msg.output) : msg.output,
    });
  }
  return items.sort((a, b) => a.seq - b.seq);
}

// ─── Per-task state ─────────────────────────────────────────────────────────

interface TaskState {
  task: AgentTask;
  items: TimelineItem[];
}

// ─── AgentLiveCard (real-time view for multiple agents) ───────────────────

interface AgentLiveCardProps {
  issueId: string;
}

export function AgentLiveCard({ issueId }: AgentLiveCardProps) {
  const { getActorName } = useActorName();
  const [taskStates, setTaskStates] = useState<Map<string, TaskState>>(new Map());
  const seenSeqs = useRef(new Set<string>());

  // Fetch active tasks on mount
  useEffect(() => {
    let cancelled = false;
    api.getActiveTasksForIssue(issueId).then(({ tasks }) => {
      if (cancelled || tasks.length === 0) return;

      // Show cards immediately with empty timeline
      setTaskStates((prev) => {
        const next = new Map(prev);
        for (const task of tasks) {
          if (!next.has(task.id)) {
            next.set(task.id, { task, items: [] });
          }
        }
        return next;
      });

      // Load messages per task in the background
      for (const task of tasks) {
        api.listTaskMessages(task.id).then((msgs) => {
          if (cancelled) return;
          const timeline = buildTimeline(msgs);
          for (const m of msgs) seenSeqs.current.add(`${m.task_id}:${m.seq}`);
          setTaskStates((prev) => {
            const next = new Map(prev);
            const existing = next.get(task.id);
            if (existing) {
              // Merge: keep any WS-delivered items not in the loaded batch
              const loadedSeqs = new Set(timeline.map((i) => i.seq));
              const wsOnly = existing.items.filter((i) => !loadedSeqs.has(i.seq));
              const merged = [...timeline, ...wsOnly].sort((a, b) => a.seq - b.seq);
              next.set(task.id, { task: existing.task, items: merged });
            } else {
              next.set(task.id, { task, items: timeline });
            }
            return next;
          });
        }).catch(console.error);
      }
    }).catch(console.error);

    return () => { cancelled = true; };
  }, [issueId]);

  // Handle real-time task messages — route by task_id
  useWSEvent(
    "task:message",
    useCallback((payload: unknown) => {
      const msg = payload as TaskMessagePayload;
      if (msg.issue_id !== issueId) return;
      const key = `${msg.task_id}:${msg.seq}`;
      if (seenSeqs.current.has(key)) return;
      seenSeqs.current.add(key);

      const item: TimelineItem = {
        seq: msg.seq,
        type: msg.type,
        tool: msg.tool,
        content: msg.content,
        input: msg.input,
        output: msg.output,
      };

      setTaskStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(msg.task_id);
        if (existing) {
          const items = [...existing.items, item].sort((a, b) => a.seq - b.seq);
          next.set(msg.task_id, { ...existing, items });
        }
        // If we don't have this task yet, the dispatch handler will pick it up
        return next;
      });
    }, [issueId]),
  );

  // Handle task end events — remove only the specific task
  const handleTaskEnd = useCallback((payload: unknown) => {
    const p = payload as { task_id: string; issue_id: string };
    if (p.issue_id !== issueId) return;
    setTaskStates((prev) => {
      const next = new Map(prev);
      next.delete(p.task_id);
      return next;
    });
  }, [issueId]);

  useWSEvent("task:completed", handleTaskEnd);
  useWSEvent("task:failed", handleTaskEnd);
  useWSEvent("task:cancelled", handleTaskEnd);

  // Pick up newly dispatched tasks
  useWSEvent(
    "task:dispatch",
    useCallback((payload: unknown) => {
      const p = payload as { issue_id?: string };
      if (p.issue_id && p.issue_id !== issueId) return;
      api.getActiveTasksForIssue(issueId).then(({ tasks }) => {
        setTaskStates((prev) => {
          const next = new Map(prev);
          for (const task of tasks) {
            if (!next.has(task.id)) {
              next.set(task.id, { task, items: [] });
            }
          }
          return next;
        });
      }).catch(console.error);
    }, [issueId]),
  );

  if (taskStates.size === 0) return null;

  const entries = Array.from(taskStates.values());
  const [firstEntry, ...restEntries] = entries;
  if (!firstEntry) return null;

  return (
    <>
      {/* Primary agent — sticky at top of the Activity section */}
      <div className="mt-4 sticky top-4 z-10">
        <SingleAgentLiveCard
          task={firstEntry.task}
          items={firstEntry.items}
          issueId={issueId}
          agentName={firstEntry.task.agent_id ? getActorName("agent", firstEntry.task.agent_id) : "代理"}
        />
      </div>
      {/* Additional agents — scroll with the page */}
      {restEntries.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {restEntries.map(({ task, items }) => (
            <SingleAgentLiveCard
              key={task.id}
              task={task}
              items={items}
              issueId={issueId}
              agentName={task.agent_id ? getActorName("agent", task.agent_id) : "代理"}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── SingleAgentLiveCard (one card per running task) ──────────────────────

interface SingleAgentLiveCardProps {
  task: AgentTask;
  items: TimelineItem[];
  issueId: string;
  agentName: string;
}

function SingleAgentLiveCard({ task, items, issueId, agentName }: SingleAgentLiveCardProps) {
  const wsPaths = useWorkspacePaths();
  const { push } = useNavigation();
  const [elapsed, setElapsed] = useState("");
  const [open, setOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const browserEvidence = useMemo(() => extractBrowserEvidence(task, items), [task, items]);
  const runtimeHref = task.runtime_id
    ? `${wsPaths.runtimes()}?runtime=${encodeURIComponent(task.runtime_id)}`
    : "";

  // Elapsed time
  useEffect(() => {
    if (!task.started_at && !task.dispatched_at) return;
    const startRef = task.started_at ?? task.dispatched_at!;
    setElapsed(formatElapsed(startRef));
    const interval = setInterval(() => setElapsed(formatElapsed(startRef)), 1000);
    return () => clearInterval(interval);
  }, [task.started_at, task.dispatched_at]);

  // Auto-scroll timeline to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen(!open);
  }, [open]);

  const handleCancel = useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await api.cancelTask(issueId, task.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "停止任务失败");
      setCancelling(false);
    }
  }, [task.id, issueId, cancelling]);

  const toolCount = items.filter((i) => i.type === "tool_use").length;

  return (
    <div className="rounded-lg border border-info/20 bg-info/5 backdrop-blur-sm">
      {/* Header — click to toggle timeline */}
      <div
        className="group flex items-center gap-2 px-3 py-2 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
          }
        }}
      >
        {task.agent_id ? (
          <ActorAvatar actorType="agent" actorId={task.agent_id} size={20} />
        ) : (
          <div className="flex items-center justify-center h-5 w-5 rounded-full shrink-0 bg-info/10 text-info">
            <Bot className="h-3 w-3" />
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <Loader2 className="h-3 w-3 animate-spin text-info shrink-0" />
          <span className="font-medium text-foreground truncate">{agentName} 正在执行</span>
          <span className="text-muted-foreground tabular-nums shrink-0">{elapsed}</span>
          {toolCount > 0 && (
            <span className="text-muted-foreground shrink-0">{toolCount} 个工具</span>
          )}
          {browserEvidence && (
            <span className="rounded-full bg-info/10 px-1.5 py-0.5 text-[11px] font-medium text-info shrink-0">
              {getBrowserEvidenceBadgeLabel(browserEvidence)}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {runtimeHref && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                push(runtimeHref);
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              title="打开运行时控制中心"
            >
              <Link2 className="h-3 w-3" />
              <span>运行时</span>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setTranscriptOpen(true); }}
            className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="展开转录"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleCancel(); }}
            disabled={cancelling}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            title="停止代理"
          >
            {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
            <span>停止</span>
          </button>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </div>
      </div>

      {browserEvidence && <BrowserEvidencePanel evidence={browserEvidence} className="bg-background/20" />}

      {/* Timeline — grid-rows animation for smooth collapse/expand */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {items.length > 0 ? (
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="relative max-h-80 overflow-y-auto overscroll-y-contain border-t border-info/10 px-3 py-2 space-y-0.5"
            >
              {items.map((item, idx) => (
                <TimelineRow key={`${item.seq}-${idx}`} item={item} />
              ))}

              {!autoScroll && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (scrollRef.current) {
                      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                      setAutoScroll(true);
                    }
                  }}
                  className="sticky bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-background border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground shadow-sm"
                >
                  <ArrowDown className="h-3 w-3" />
                  最新
                </button>
              )}
            </div>
          ) : (
            <div className="border-t border-info/10 px-3 py-3">
              <p className="text-xs text-muted-foreground">
                当前代理提供方暂不支持实时日志，任务完成后会显示结果。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen transcript dialog */}
      <AgentTranscriptDialog
        open={transcriptOpen}
        onOpenChange={setTranscriptOpen}
        task={task}
        items={items}
        agentName={agentName}
        isLive
      />
    </div>
  );
}

// ─── TaskRunHistory (past execution logs) ──────────────────────────────────

interface TaskRunHistoryProps {
  issueId: string;
}

export function TaskRunHistory({ issueId }: TaskRunHistoryProps) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.listTasksByIssue(issueId).then(setTasks).catch(console.error);
  }, [issueId]);

  // Refresh when a task completes
  useWSEvent(
    "task:completed",
    useCallback((payload: unknown) => {
      const p = payload as TaskCompletedPayload;
      if (p.issue_id !== issueId) return;
      api.listTasksByIssue(issueId).then(setTasks).catch(console.error);
    }, [issueId]),
  );

  useWSEvent(
    "task:failed",
    useCallback((payload: unknown) => {
      const p = payload as TaskFailedPayload;
      if (p.issue_id !== issueId) return;
      api.listTasksByIssue(issueId).then(setTasks).catch(console.error);
    }, [issueId]),
  );

  // Refresh when a task is cancelled
  useWSEvent(
    "task:cancelled",
    useCallback((payload: unknown) => {
      const p = payload as TaskCancelledPayload;
      if (p.issue_id !== issueId) return;
      api.listTasksByIssue(issueId).then(setTasks).catch(console.error);
    }, [issueId]),
  );

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [tasks],
  );

  const latestBrowserEvidence = useMemo(() => {
    for (const task of completedTasks) {
      const evidence = extractBrowserEvidence(task, []);
      if (evidence) {
        return { task, evidence };
      }
    }
    return null;
  }, [completedTasks]);

  if (completedTasks.length === 0) return null;

  return (
    <div className="space-y-2">
      {latestBrowserEvidence && (
        <RecentBrowserEvidenceCallout
          task={latestBrowserEvidence.task}
          evidence={latestBrowserEvidence.evidence}
        />
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
          <Clock className="h-3 w-3" />
          <span>执行历史（{completedTasks.length}）</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1 space-y-2">
            {completedTasks.map((task) => (
              <TaskRunEntry key={task.id} task={task} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function TaskRunEntry({ task }: { task: AgentTask }) {
  const { getActorName } = useActorName();
  const wsPaths = useWorkspacePaths();
  const { push } = useNavigation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const browserEvidence = useMemo(() => extractBrowserEvidence(task, items ?? []), [task, items]);
  const runtimeHref = task.runtime_id
    ? `${wsPaths.runtimes()}?runtime=${encodeURIComponent(task.runtime_id)}`
    : "";

  const loadMessages = useCallback(() => {
    if (items !== null) return; // already loaded
    api.listTaskMessages(task.id).then((msgs) => {
      setItems(buildTimeline(msgs));
    }).catch((e) => {
      console.error(e);
      setItems([]);
    });
  }, [task.id, items]);

  useEffect(() => {
    if (open) loadMessages();
  }, [open, loadMessages]);

  const duration = task.started_at && task.completed_at
    ? formatDuration(task.started_at, task.completed_at)
    : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/30 transition-colors border border-transparent hover:border-border">
        <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        {task.status === "completed" ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
        ) : (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
        )}
        <span className="text-muted-foreground">
          {new Date(task.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
        {duration && <span className="text-muted-foreground">{duration}</span>}
        {browserEvidence && (
          <span className="rounded-full bg-info/10 px-1.5 py-0.5 text-[11px] font-medium text-info">
            {getBrowserEvidenceBadgeLabel(browserEvidence)}
          </span>
        )}
        <span className={cn("ml-auto capitalize", task.status === "completed" ? "text-success" : "text-destructive")}>
          {task.status}
        </span>
        {runtimeHref && (
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              push(runtimeHref);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                push(runtimeHref);
              }
            }}
            className="flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
            title="打开运行时控制中心"
          >
            <Link2 className="h-3 w-3" />
            <span>运行时</span>
          </span>
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            // Load messages before opening the transcript dialog
            if (items === null) {
              api.listTaskMessages(task.id).then((msgs) => {
                setItems(buildTimeline(msgs));
                setTranscriptOpen(true);
              }).catch(console.error);
            } else {
              setTranscriptOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.click();
            }
          }}
          className="flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
          title="展开转录"
        >
          <Maximize2 className="h-3 w-3" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {browserEvidence && (
          <div className="ml-5 mt-1 overflow-hidden rounded border bg-muted/30">
            <BrowserEvidencePanel evidence={browserEvidence} className="border-t-0 px-3 py-2" />
          </div>
        )}
        <div className="ml-5 mt-1 max-h-64 overflow-y-auto rounded border bg-muted/30 px-3 py-2 space-y-0.5">
          {items === null ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              加载中...
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">暂无执行记录。</p>
          ) : (
            items.map((item, idx) => (
              <TimelineRow key={`${item.seq}-${idx}`} item={item} />
            ))
          )}
        </div>
      </CollapsibleContent>

      {/* Fullscreen transcript dialog */}
      {items !== null && (
        <AgentTranscriptDialog
          open={transcriptOpen}
          onOpenChange={setTranscriptOpen}
          task={task}
          items={items}
          agentName={task.agent_id ? getActorName("agent", task.agent_id) : "代理"}
        />
      )}
    </Collapsible>
  );
}

// ─── Shared timeline row rendering ──────────────────────────────────────────

function TimelineRow({ item }: { item: TimelineItem }) {
  switch (item.type) {
    case "tool_use":
      return <ToolCallRow item={item} />;
    case "tool_result":
      return <ToolResultRow item={item} />;
    case "thinking":
      return <ThinkingRow item={item} />;
    case "text":
      return <TextRow item={item} />;
    case "error":
      return <ErrorRow item={item} />;
    default:
      return null;
  }
}

function ToolCallRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  const summary = getToolSummary(item);
  const hasInput = item.input && Object.keys(item.input).length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded px-1 -mx-1 py-0.5 text-xs hover:bg-accent/30 transition-colors">
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
            !hasInput && "invisible",
          )}
        />
        <span className="font-medium text-foreground shrink-0">{item.tool}</span>
        {summary && <span className="truncate text-muted-foreground">{summary}</span>}
      </CollapsibleTrigger>
      {hasInput && (
        <CollapsibleContent>
          <pre className="ml-[18px] mt-0.5 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
            {redactSecrets(JSON.stringify(item.input, null, 2))}
          </pre>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ToolResultRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  const output = item.output ?? "";
  if (!output) return null;

  const preview = output.length > 120 ? output.slice(0, 120) + "..." : output;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-start gap-1.5 rounded px-1 -mx-1 py-0.5 text-xs hover:bg-accent/30 transition-colors">
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform mt-0.5", open && "rotate-90")}
        />
        <span className="text-muted-foreground/70 truncate">
          {item.tool ? `${item.tool} 结果：` : "结果："}{preview}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="ml-[18px] mt-0.5 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
          {output.length > 4000 ? output.slice(0, 4000) + "\n...（已截断）" : output}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ThinkingRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  const text = item.content ?? "";
  if (!text) return null;

  const preview = text.length > 150 ? text.slice(0, 150) + "..." : text;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-start gap-1.5 rounded px-1 -mx-1 py-0.5 text-xs hover:bg-accent/30 transition-colors">
        <Brain className="h-3 w-3 shrink-0 text-info/60 mt-0.5" />
        <span className="text-muted-foreground italic truncate">{preview}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="ml-[18px] mt-0.5 max-h-40 overflow-auto rounded bg-info/5 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
          {text}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TextRow({ item }: { item: TimelineItem }) {
  const text = item.content ?? "";
  if (!text.trim()) return null;
  const lines = text.trim().split("\n").filter(Boolean);
  const last = lines[lines.length - 1] ?? "";
  if (!last) return null;

  return (
    <div className="flex items-start gap-1.5 px-1 -mx-1 py-0.5 text-xs">
      <span className="h-3 w-3 shrink-0" />
      <span className="text-muted-foreground/60 truncate">{last}</span>
    </div>
  );
}

function ErrorRow({ item }: { item: TimelineItem }) {
  return (
    <div className="flex items-start gap-1.5 px-1 -mx-1 py-0.5 text-xs">
      <AlertCircle className="h-3 w-3 shrink-0 text-destructive mt-0.5" />
      <span className="text-destructive">{item.content}</span>
    </div>
  );
}
