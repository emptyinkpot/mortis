"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileCode2, MessageSquarePlus, ShieldAlert, Sparkles, Users } from "lucide-react";
import type { Agent, Issue } from "@multica/core/types";
import { toast } from "sonner";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@multica/ui/components/ui/dialog";
import { Input } from "@multica/ui/components/ui/input";
import { Textarea } from "@multica/ui/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import { buildDiscussionKickoffComment } from "./discussion-kickoff";

interface DiscussionKickoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: Pick<Issue, "identifier" | "title" | "description" | "assignee_id" | "assignee_type">;
  agents: Agent[];
  onSubmit: (content: string) => Promise<void>;
}

type RoleKey = "moderator" | "architect" | "critic" | "implementer";

const ROLE_PREVIEW: Array<{
  key: RoleKey;
  label: string;
  summary: string;
  accentClass: string;
}> = [
  {
    key: "moderator",
    label: "主持人",
    summary: "开启群聊讨论、控节奏、收束 FINAL IMPLEMENTATION PLAN",
    accentClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    key: "architect",
    label: "架构师",
    summary: "提出方案边界、文件落点和依赖改动",
    accentClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "critic",
    label: "批评者",
    summary: "专挑风险、回归点和更稳妥替代方案",
    accentClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    key: "implementer",
    label: "实现者",
    summary: "把讨论结论压缩成可执行步骤和验证清单",
    accentClass: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
];

function chooseDistinct(candidates: Agent[], exclude: string[]): Agent | null {
  return candidates.find((agent) => !exclude.includes(agent.id)) ?? candidates[0] ?? null;
}

function normalizeSelectValue(
  setValue: React.Dispatch<React.SetStateAction<string>>,
): (value: string | null) => void {
  return (value) => setValue(value ?? "");
}

function getAgentInitial(agent: Agent | null): string {
  const name = agent?.name?.trim();
  return name ? name.slice(0, 1).toUpperCase() : "?";
}

export function DiscussionKickoffDialog({
  open,
  onOpenChange,
  issue,
  agents,
  onSubmit,
}: DiscussionKickoffDialogProps) {
  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    [agents],
  );

  const [moderatorId, setModeratorId] = useState("");
  const [architectId, setArchitectId] = useState("");
  const [criticId, setCriticId] = useState("");
  const [implementerId, setImplementerId] = useState("");
  const [goal, setGoal] = useState("");
  const [scope, setScope] = useState("");
  const [maxRounds, setMaxRounds] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const handleModeratorChange = useMemo(() => normalizeSelectValue(setModeratorId), []);
  const handleArchitectChange = useMemo(() => normalizeSelectValue(setArchitectId), []);
  const handleCriticChange = useMemo(() => normalizeSelectValue(setCriticId), []);
  const handleImplementerChange = useMemo(() => normalizeSelectValue(setImplementerId), []);
  const handleMaxRoundsChange = useMemo(() => normalizeSelectValue(setMaxRounds), []);

  useEffect(() => {
    if (!open || sortedAgents.length === 0) return;

    const assigneeAgent =
      issue.assignee_type === "agent"
        ? sortedAgents.find((agent) => agent.id === issue.assignee_id) ?? null
        : null;
    const moderator = assigneeAgent ?? sortedAgents[0] ?? null;
    const architect = chooseDistinct(sortedAgents, moderator ? [moderator.id] : []);
    const critic = chooseDistinct(
      sortedAgents,
      [moderator?.id, architect?.id].filter(Boolean) as string[],
    );
    const implementer =
      assigneeAgent ??
      chooseDistinct(
        sortedAgents,
        [moderator?.id, architect?.id, critic?.id].filter(Boolean) as string[],
      );

    setModeratorId(moderator?.id ?? "");
    setArchitectId(architect?.id ?? moderator?.id ?? "");
    setCriticId(critic?.id ?? architect?.id ?? moderator?.id ?? "");
    setImplementerId(implementer?.id ?? moderator?.id ?? "");
    setGoal(`Decide the best implementation approach for ${issue.identifier} ${issue.title}`);
    setScope("");
    setMaxRounds("2");
  }, [open, sortedAgents, issue.assignee_id, issue.assignee_type, issue.identifier, issue.title]);

  const moderator = sortedAgents.find((agent) => agent.id === moderatorId) ?? null;
  const architect = sortedAgents.find((agent) => agent.id === architectId) ?? null;
  const critic = sortedAgents.find((agent) => agent.id === criticId) ?? null;
  const implementer = sortedAgents.find((agent) => agent.id === implementerId) ?? null;
  const previewContent = useMemo(() => {
    if (!moderator || !architect || !critic || !implementer) {
      return "";
    }

    return buildDiscussionKickoffComment({
      issue,
      moderator,
      architect,
      critic,
      implementer,
      goal,
      scope,
      maxRounds: Number(maxRounds) || 2,
    });
  }, [architect, critic, goal, implementer, issue, maxRounds, moderator, scope]);

  const kickoffLeadLine = useMemo(
    () => previewContent.split("\n").find((line) => line.trim().length > 0) ?? "",
    [previewContent],
  );
  const normalizedGoal = goal.trim();
  const normalizedScope = scope.trim();
  const selectedAgentsByRole: Record<RoleKey, Agent | null> = {
    moderator,
    architect,
    critic,
    implementer,
  };

  const canSubmit = !!moderator && !!architect && !!critic && !!implementer && !submitting;

  const handleSubmit = async () => {
    if (!previewContent) return;

    setSubmitting(true);
    try {
      await onSubmit(previewContent);
      toast.success("已发起代码讨论");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发起代码讨论失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden p-0">
        <DialogTitle className="sr-only">发起代码讨论</DialogTitle>
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span>发起代码讨论</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            这会向当前线程发送一条 kickoff 评论，把讨论组织成一个可见的群聊接力：只直接 @ 主持人，其余角色由主持人继续点名接力。
          </p>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr),380px]">
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-2xl border bg-card/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">当前讨论目标事项</div>
                  <div className="mt-1 text-sm font-semibold">
                    {issue.identifier} · {issue.title}
                  </div>
                </div>
                <Badge variant="outline">只创建 kickoff 评论</Badge>
              </div>
              <p className="mt-3 line-clamp-4 text-xs leading-5 text-muted-foreground">
                {issue.description?.trim() || "当前事项没有额外描述，讨论将直接基于标题和现有线程上下文展开。"}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">主持人</label>
                <Select value={moderatorId} onValueChange={handleModeratorChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择主持人" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">架构师</label>
                <Select value={architectId} onValueChange={handleArchitectChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择架构师" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">批评者</label>
                <Select value={criticId} onValueChange={handleCriticChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择批评者" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">实现者</label>
                <Select value={implementerId} onValueChange={handleImplementerChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择实现者" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">讨论目标</label>
              <Input
                className="mt-1"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="这轮讨论要解决什么问题"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),140px]">
              <div>
                <label className="text-xs font-medium text-muted-foreground">代码范围 / 约束</label>
                <Textarea
                  className="mt-1 min-h-24"
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                  placeholder="例如：只讨论 packages/views/issues 与 server/internal/handler/comment.go，不执行代码改动"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">最多轮数</label>
                <Select value={maxRounds} onValueChange={handleMaxRoundsChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 轮</SelectItem>
                    <SelectItem value="3">3 轮</SelectItem>
                    <SelectItem value="4">4 轮</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">原始 kickoff comment</label>
                <span className="text-[11px] text-muted-foreground">发送前可直接检查完整 markdown</span>
              </div>
              <Textarea
                className="mt-1 min-h-52 font-mono text-[11px]"
                readOnly
                value={previewContent}
                data-testid="kickoff-preview"
                placeholder="选择完整角色后会在这里生成 kickoff comment 预览"
              />
            </div>
          </div>

          <aside className="border-t bg-muted/20 px-5 py-4 lg:border-t-0 lg:border-l">
            <div className="space-y-4 lg:sticky lg:top-0">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>群聊预演</span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  发送后会先出现一条“主持人开场消息”，然后按接力顺序在同一线程里继续往下讨论。
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {getAgentInitial(moderator)}
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl border bg-card px-3 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{moderator?.name ?? "主持人待定"}</span>
                      <Badge variant="outline">第一条群消息</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6">
                      {kickoffLeadLine || "选择完整角色后，这里会生成即将发出的 kickoff 开场消息。"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <Badge variant="secondary">只直接 @ 主持人</Badge>
                      <Badge variant="secondary">{maxRounds} 轮上限</Badge>
                      {normalizedGoal ? <Badge variant="secondary">目标已设置</Badge> : null}
                      {normalizedScope ? <Badge variant="secondary">范围已设置</Badge> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <FileCode2 className="h-3.5 w-3.5" />
                  <span>接力顺序</span>
                </div>
                <div className="mt-3 space-y-2">
                  {ROLE_PREVIEW.map((role, index) => {
                    const agent = selectedAgentsByRole[role.key];
                    return (
                      <div key={role.key}>
                        <div className={`rounded-xl border px-3 py-2 ${role.accentClass}`}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background/90 text-xs font-semibold text-foreground">
                              {getAgentInitial(agent)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{role.label}</span>
                                <Badge variant="outline">{agent?.name ?? "待选择"}</Badge>
                              </div>
                              <p className="mt-1 text-[11px] leading-5 text-current/80">
                                {role.summary}
                              </p>
                            </div>
                          </div>
                        </div>
                        {index < ROLE_PREVIEW.length - 1 ? (
                          <div className="flex justify-center py-1 text-muted-foreground">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>收口要求</span>
                </div>
                <ul className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">
                  <li>- 这轮只启动讨论，不直接改代码。</li>
                  <li>- Moderator 最后必须发出 `FINAL IMPLEMENTATION PLAN`。</li>
                  <li>- 结论要能被后续执行 agent 直接消费。</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3">
          <p className="text-[11px] text-muted-foreground">
            POC 版走现有 issue/comment/@agent 链路，不新增数据库对象。
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              <MessageSquarePlus className="mr-1.5 h-4 w-4" />
              发起讨论
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
