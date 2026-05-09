"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, MessageSquareText, Plus, Sparkles } from "lucide-react";
import { useWorkspaceId } from "@multica/core/hooks";
import { useAuthStore } from "@multica/core/auth";
import { api } from "@multica/core/api";
import {
  allChatSessionsOptions,
  chatKeys,
  chatMessagesOptions,
  pendingChatTaskOptions,
} from "@multica/core/chat/queries";
import {
  useCreateChatSession,
  useMarkChatSessionRead,
} from "@multica/core/chat/mutations";
import { useChatStore } from "@multica/core/chat";
import { agentListOptions, memberListOptions } from "@multica/core/workspace/queries";
import type { Agent, ChatMessage, ChatSession, Project } from "@multica/core/types";
import { canAssignAgent } from "@multica/views/issues/components";
import { Button } from "@multica/ui/components/ui/button";
import { cn } from "@multica/ui/lib/utils";
import { ActorAvatar } from "../../common/actor-avatar";
import { ChatInput } from "../../chat/components/chat-input";
import { ChatMessageList, ChatMessageSkeleton } from "../../chat/components/chat-message-list";

interface ProjectCollaborationPanelProps {
  project?: Project;
  leadName?: string | null;
  compact?: boolean;
}

const STARTER_PROMPTS = [
  "列出这个项目现在最该推进的 3 件事",
  "根据当前项目状态，给我一个本周推进计划",
  "总结最近对话里和这个项目相关的关键动作",
];

export function ProjectCollaborationPanel({
  project,
  leadName,
  compact = false,
}: ProjectCollaborationPanelProps) {
  const wsId = useWorkspaceId();
  const user = useAuthStore((s) => s.user);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setSelectedAgentId = useChatStore((s) => s.setSelectedAgentId);
  const setOpen = useChatStore((s) => s.setOpen);
  const qc = useQueryClient();

  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: allSessions = [] } = useQuery(allChatSessionsOptions(wsId));
  const { data: rawMessages, isLoading: messagesLoading } = useQuery(
    chatMessagesOptions(activeSessionId ?? ""),
  );
  const { data: pendingTask } = useQuery(
    pendingChatTaskOptions(activeSessionId ?? ""),
  );

  const createSession = useCreateChatSession();
  const markRead = useMarkChatSessionRead();

  const messages = activeSessionId ? rawMessages ?? [] : [];
  const pendingTaskId = pendingTask?.task_id ?? null;
  const showSkeleton = !!activeSessionId && messagesLoading;

  const currentMember = members.find((m) => m.user_id === user?.id);
  const memberRole = currentMember?.role;

  const availableAgents = useMemo(
    () =>
      agents.filter(
        (agent) => !agent.archived_at && canAssignAgent(agent, user?.id, memberRole),
      ),
    [agents, user?.id, memberRole],
  );

  const orderedAgents = useMemo(() => {
    const items = [...availableAgents];
    if (project?.lead_type === "agent" && project.lead_id) {
      items.sort((a, b) => {
        if (a.id === project.lead_id) return -1;
        if (b.id === project.lead_id) return 1;
        return a.name.localeCompare(b.name, "zh-CN");
      });
      return items;
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [availableAgents, project?.lead_id, project?.lead_type]);

  const activeAgent =
    orderedAgents.find((agent) => agent.id === selectedAgentId) ??
    orderedAgents[0] ??
    null;

  const currentSession = activeSessionId
    ? allSessions.find((session) => session.id === activeSessionId) ?? null
    : null;
  const currentHasUnread =
    allSessions.find((session) => session.id === activeSessionId)?.has_unread ?? false;
  const isSessionArchived = currentSession?.status === "archived";

  const recentSessions = useMemo(() => {
    const limit = compact ? 4 : 6;
    return allSessions.slice(0, limit);
  }, [allSessions, compact]);

  useEffect(() => {
    if (!project || project.lead_type !== "agent" || !project.lead_id) return;
    const leadAvailable = orderedAgents.some((agent) => agent.id === project.lead_id);
    if (!leadAvailable) return;
    if (!selectedAgentId || !orderedAgents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(project.lead_id);
    }
  }, [orderedAgents, project, selectedAgentId, setSelectedAgentId]);

  useEffect(() => {
    if (!activeSessionId || !currentHasUnread) return;
    markRead.mutate(activeSessionId);
  }, [activeSessionId, currentHasUnread, markRead]);

  const handleSelectAgent = useCallback(
    (agent: Agent) => {
      if (activeAgent?.id === agent.id) return;
      setSelectedAgentId(agent.id);
      setActiveSession(null);
    },
    [activeAgent?.id, setActiveSession, setSelectedAgentId],
  );

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      if (session.agent_id !== selectedAgentId) {
        setSelectedAgentId(session.agent_id);
      }
      setActiveSession(session.id);
    },
    [selectedAgentId, setActiveSession, setSelectedAgentId],
  );

  const handleNewChat = useCallback(() => {
    setActiveSession(null);
  }, [setActiveSession]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeAgent) return;

      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = await createSession.mutateAsync({
          agent_id: activeAgent.id,
          title: project ? `${project.title} · ${content.slice(0, 36)}` : content.slice(0, 50),
        });
        sessionId = session.id;
        setActiveSession(sessionId);
      }

      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        chat_session_id: sessionId,
        role: "user",
        content,
        task_id: null,
        created_at: new Date().toISOString(),
      };

      qc.setQueryData<ChatMessage[]>(
        chatKeys.messages(sessionId),
        (old) => (old ? [...old, optimistic] : [optimistic]),
      );

      const result = await api.sendChatMessage(sessionId, content);
      qc.setQueryData(chatKeys.pendingTask(sessionId), {
        task_id: result.task_id,
        status: "queued",
      });
      qc.invalidateQueries({ queryKey: chatKeys.messages(sessionId) });
    },
    [activeAgent, activeSessionId, createSession, project, qc, setActiveSession],
  );

  const handleStop = useCallback(async () => {
    if (!pendingTaskId) return;
    await api.cancelTaskById(pendingTaskId);
    if (activeSessionId) {
      qc.setQueryData(chatKeys.pendingTask(activeSessionId), {});
      qc.invalidateQueries({ queryKey: chatKeys.messages(activeSessionId) });
    }
  }, [activeSessionId, pendingTaskId, qc]);

  const title = project ? "项目智能体与协同对话" : "支持的智能体与协同对话";
  const description = project
    ? "在项目页里直接切换可用智能体，并继续当前工作区的协同推进对话。"
    : "先看当前工作区有哪些智能体可用，再直接续接最近的协同对话。";

  const hasMessages = messages.length > 0 || !!pendingTaskId;

  return (
    <section className="border-b bg-muted/15">
      <div className={cn("mx-auto w-full max-w-6xl px-5 py-4", compact ? "space-y-3" : "space-y-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{project ? "项目 / 协同" : "项目 / 总览"}</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {project && (
              <span className="rounded-full border bg-background px-2.5 py-1 text-muted-foreground">
                当前项目：{project.icon || "📁"} {project.title}
              </span>
            )}
            {leadName && (
              <span className="rounded-full border bg-background px-2.5 py-1 text-muted-foreground">
                负责人：{leadName}
              </span>
            )}
            <span className="rounded-full border bg-background px-2.5 py-1 text-muted-foreground">
              智能体 {orderedAgents.length}
            </span>
            <span className="rounded-full border bg-background px-2.5 py-1 text-muted-foreground">
              对话 {allSessions.length}
            </span>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              打开悬浮聊天
            </Button>
          </div>
        </div>

        <div className={cn("grid gap-4", compact ? "xl:grid-cols-[280px,minmax(0,1fr)]" : "xl:grid-cols-[320px,minmax(0,1fr)]")}>
          <div className="rounded-xl border bg-background/90 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span>支持的智能体</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              选中一个智能体后，下面的协同对话会直接切到它。
            </p>

            <div className="mt-3 space-y-2">
              {orderedAgents.length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  当前工作区还没有可用智能体。
                </div>
              ) : (
                orderedAgents.map((agent) => {
                  const isActive = activeAgent?.id === agent.id;
                  const isLead = project?.lead_type === "agent" && project.lead_id === agent.id;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => handleSelectAgent(agent)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-brand bg-brand/8"
                          : "border-border hover:bg-accent/40",
                      )}
                    >
                      <ActorAvatar actorType="agent" actorId={agent.id} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{agent.name}</span>
                          {isLead && (
                            <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-medium text-brand">
                              负责人
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {agent.description || `状态：${agent.status}`}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-background/90 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                  <span>协同对话</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  最近会话会显示在这里；你也可以从当前项目直接发起新对话。
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleNewChat}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                新建对话
              </Button>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {recentSessions.length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  还没有协同对话，先选一个智能体开始。
                </div>
              ) : (
                recentSessions.map((session) => {
                  const sessionAgent =
                    agents.find((agent) => agent.id === session.agent_id) ?? null;
                  const isActive = session.id === activeSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => handleSelectSession(session)}
                      className={cn(
                        "min-w-[180px] rounded-xl border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-brand bg-brand/8"
                          : "border-border hover:bg-accent/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {session.title?.trim() || "新对话"}
                        </span>
                        {session.has_unread && (
                          <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {sessionAgent?.name || "智能体"} · {formatRelativeTime(session.updated_at)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className={cn(
              "mt-3 overflow-hidden rounded-xl border bg-card/60",
              compact ? "min-h-[240px]" : "min-h-[300px]",
            )}>
              {showSkeleton ? (
                <ChatMessageSkeleton />
              ) : hasMessages ? (
                <ChatMessageList
                  messages={messages}
                  pendingTaskId={pendingTaskId}
                  isWaiting={!!pendingTaskId}
                />
              ) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-8 text-center">
                  <div className="rounded-full bg-muted p-3 text-muted-foreground">
                    <MessageSquareText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {activeAgent ? `正在为 ${activeAgent.name} 准备新对话` : "先选择一个智能体"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      你可以直接点击下面的建议问题，或者输入自己的项目协同指令。
                    </p>
                  </div>
                  <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={!activeAgent}
                        onClick={() => handleSend(prompt)}
                        className="rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3">
              {activeAgent ? (
                <ChatInput
                  onSend={handleSend}
                  onStop={handleStop}
                  isRunning={!!pendingTaskId}
                  disabled={isSessionArchived}
                  agentName={activeAgent?.name}
                  leftAdornment={
                    <span className="text-xs text-muted-foreground">
                      当前智能体：{activeAgent.name}
                    </span>
                  }
                />
              ) : (
                <div className="rounded-lg border border-dashed bg-card px-4 py-3 text-xs text-muted-foreground">
                  当前没有可用智能体，先到 `智能体` 页面接入运行时或恢复可分配的智能体。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatRelativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(value).toLocaleDateString("zh-CN");
}
