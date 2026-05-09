"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, BookOpenText, Clock3, RefreshCw, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@multica/ui/components/ui/tabs";
import { EmbeddedAtramentiShell } from "./embedded-atramenti-shell";

type DashboardSnapshot = {
  syncedAt: string;
  pipelineReadiness?: {
    generateReadyWorks?: number;
    auditReadyWorks?: number;
    publishReadyWorks?: number;
    syncedAt?: string;
  };
  pipelineQueue?: Array<{
    workId: number;
    workTitle: string;
    chapterNumber: number;
    chapterTitle?: string;
    stage?: string;
    reason?: string;
    updatedAt?: string;
  }>;
  pipelineBlockers?: Array<{
    type?: string;
    message?: string;
    workTitle?: string;
    chapterNumber?: number;
    reason?: string;
    stage?: string;
    severity?: string;
    suggestedAction?: string;
    timestamp?: string;
  }>;
  activityLog?: Array<{
    id: number | string;
    timestamp?: string;
    type?: string;
    message?: string;
    level?: string;
  }>;
  dailyPlanOperations?: Array<{
    id: number;
    created_at?: string;
    operation_type?: string;
    source?: string;
    snapshot_json?: {
      planDate?: string;
      dailyChaptersPerWork?: number;
    };
  }>;
  automationConfig?: {
    autoScanEnabled?: boolean;
    autoPublishEnabled?: boolean;
    scanInterval?: number;
    runtimeState?: Record<string, { status?: string; meta?: { currentTask?: string | null; lastHeartbeat?: string | null } }>;
    publishServiceStatus?: {
      running?: boolean;
      lastRunTime?: string | null;
      lastHeartbeat?: string | null;
      currentTask?: string | null;
      processedCount?: number;
      errorCount?: number;
    };
  };
  publishAuto?: {
    status?: {
      running?: boolean;
      lastHeartbeat?: string | null;
      processedCount?: number;
      errorCount?: number;
      currentTask?: string | null;
    };
    config?: {
      enabled?: boolean;
      processInterval?: number;
      maxChaptersPerRun?: number;
    };
  };
  worksSync?: {
    localWorks?: Array<{
      id: number;
      title: string;
      current_chapters?: number;
      target_chapters?: number;
      status?: string;
    }>;
    accounts?: Array<{
      id: string;
      name: string;
      status?: string;
      lastCookieSyncedAt?: string | null;
    }>;
  };
  systemStatus?: {
    contentCraftAuto?: { status?: { running?: boolean; currentTask?: string | null } };
    auditAuto?: { status?: { running?: boolean; currentTask?: string | null } };
    smartScheduler?: { status?: { running?: boolean; currentTask?: string | null } };
    publishAuto?: { status?: { running?: boolean; currentTask?: string | null } };
  };
};

async function fetchNovelDashboard(): Promise<DashboardSnapshot> {
  const response = await fetch("/api/atramenti/novel-dashboard", {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    let message = `novel dashboard request failed: ${response.status}`;
    try {
      const payload = await response.json() as { error?: string };
      if (typeof payload?.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch {
      // Ignore parse errors and keep fallback message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<DashboardSnapshot>;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return value;
  }
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Sparkles;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]">
          <Icon className="size-4" />
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function ServiceStatusCard({
  label,
  running,
  task,
}: {
  label: string;
  running: boolean;
  task?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{running ? "运行中" : "未运行"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <Badge variant={running ? "default" : "secondary"}>{running ? "在线" : "离线"}</Badge>
        <div>任务：{task || "--"}</div>
      </CardContent>
    </Card>
  );
}

export function AtramentiNovelDashboardPage() {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["atramenti-console", "novel-dashboard"],
    queryFn: fetchNovelDashboard,
    refetchInterval: 30_000,
  });

  const queueCount = data?.pipelineQueue?.length ?? 0;
  const blockerCount = data?.pipelineBlockers?.length ?? 0;
  const worksCount = data?.worksSync?.localWorks?.length ?? 0;
  const accountCount = data?.worksSync?.accounts?.length ?? 0;

  return (
    <EmbeddedAtramentiShell
      activeTab="novel"
      title="Atramenti 小说管线"
      description="把 Atramenti-Console 旧小说工作台的关键运维面板接入 Mortis：先保留最有价值的调度快照、服务状态、阻塞与活动流。"
      badges={data ? [`同步 ${formatTimestamp(data.syncedAt)}`, `${worksCount} 作品`, `${accountCount} 账号`] : []}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            数据来源：<span className="font-medium text-foreground">Atramenti 公网小说快照</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            刷新快照
          </Button>
        </div>

        {error ? (
          <Card className="border-rose-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-rose-500" />
                Atramenti 小说面板暂不可用
              </CardTitle>
              <CardDescription>{error instanceof Error ? error.message : "加载失败"}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Sparkles}
            label="可发布作品"
            value={data?.pipelineReadiness?.publishReadyWorks ?? 0}
            hint={`生成 ${data?.pipelineReadiness?.generateReadyWorks ?? 0} · 审核 ${data?.pipelineReadiness?.auditReadyWorks ?? 0}`}
          />
          <MetricCard
            icon={Clock3}
            label="排队章节"
            value={queueCount}
            hint={queueCount > 0 ? "等待生成 / 审核 / 发布" : "当前队列为空"}
          />
          <MetricCard
            icon={AlertTriangle}
            label="阻塞项"
            value={blockerCount}
            hint={blockerCount > 0 ? "优先看阻塞与建议动作" : "当前没有阻塞"}
          />
          <MetricCard
            icon={BookOpenText}
            label="作品 / 账号"
            value={`${worksCount}/${accountCount}`}
            hint="本地作品数 / 活跃账号数"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <ServiceStatusCard
            label="内容生成"
            running={Boolean(data?.systemStatus?.contentCraftAuto?.status?.running)}
            task={data?.systemStatus?.contentCraftAuto?.status?.currentTask}
          />
          <ServiceStatusCard
            label="审核"
            running={Boolean(data?.systemStatus?.auditAuto?.status?.running)}
            task={data?.systemStatus?.auditAuto?.status?.currentTask}
          />
          <ServiceStatusCard
            label="调度器"
            running={Boolean(data?.systemStatus?.smartScheduler?.status?.running)}
            task={data?.systemStatus?.smartScheduler?.status?.currentTask}
          />
          <ServiceStatusCard
            label="自动发布"
            running={Boolean(data?.publishAuto?.status?.running)}
            task={data?.publishAuto?.status?.currentTask}
          />
        </div>

        <Tabs defaultValue="queue" className="gap-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="queue">队列</TabsTrigger>
            <TabsTrigger value="blockers">阻塞</TabsTrigger>
            <TabsTrigger value="activity">活动流</TabsTrigger>
            <TabsTrigger value="ops">调度参数</TabsTrigger>
          </TabsList>

          <TabsContent value="queue">
            <div className="grid gap-4 lg:grid-cols-2">
              {(data?.pipelineQueue ?? []).slice(0, 12).map((item) => (
                <Card key={`${item.workId}-${item.chapterNumber}-${item.stage}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{item.workTitle}</CardTitle>
                        <CardDescription>
                          第 {item.chapterNumber} 章 {item.chapterTitle ? `· ${item.chapterTitle}` : ""}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{item.stage || "unknown"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <div>原因：{item.reason || "--"}</div>
                    <div>更新时间：{formatTimestamp(item.updatedAt)}</div>
                  </CardContent>
                </Card>
              ))}
              {!queueCount ? (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">当前没有排队章节</CardTitle>
                    <CardDescription>小说管线现在是空队列状态。</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="blockers">
            <div className="space-y-3">
              {(data?.pipelineBlockers ?? []).slice(0, 16).map((item, index) => (
                <Card key={`${item.type || "blocker"}-${index}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{item.message || item.reason || "未命名阻塞项"}</CardTitle>
                        <CardDescription>
                          {item.workTitle ? `${item.workTitle}` : "全局阻塞"}{item.chapterNumber ? ` · 第 ${item.chapterNumber} 章` : ""}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{item.severity || item.stage || "blocker"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <div>原因：{item.reason || "--"}</div>
                    <div>建议动作：{item.suggestedAction || "--"}</div>
                    <div>时间：{formatTimestamp(item.timestamp)}</div>
                  </CardContent>
                </Card>
              ))}
              {!blockerCount ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">当前没有阻塞项</CardTitle>
                    <CardDescription>发布链路看起来是通的，可以继续观察队列变化。</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="space-y-3">
              {(data?.activityLog ?? []).slice(0, 18).map((item) => (
                <Card key={String(item.id)}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="mt-0.5 rounded-full border p-2">
                      <Activity className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{item.message || "无消息"}</div>
                        <Badge variant="outline">{item.level || item.type || "info"}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{formatTimestamp(item.timestamp)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ops">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="size-4" />
                    自动化配置
                  </CardTitle>
                  <CardDescription>来自 dashboard snapshot 的当前自动化开关。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>自动扫描：{data?.automationConfig?.autoScanEnabled ? "开启" : "关闭"}</div>
                  <div>自动发布：{data?.automationConfig?.autoPublishEnabled ? "开启" : "关闭"}</div>
                  <div>扫描间隔：{data?.automationConfig?.scanInterval ?? "--"} 秒</div>
                  <div>自动发布心跳：{formatTimestamp(data?.publishAuto?.status?.lastHeartbeat)}</div>
                  <div>自动发布处理数：{data?.publishAuto?.status?.processedCount ?? 0}</div>
                  <div>自动发布错误数：{data?.publishAuto?.status?.errorCount ?? 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="size-4" />
                    最近调度操作
                  </CardTitle>
                  <CardDescription>保留原工作台里最重要的计划生成痕迹。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(data?.dailyPlanOperations ?? []).slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-xl border p-3 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{item.operation_type || "operation"}</div>
                      <div className="mt-1">来源：{item.source || "--"}</div>
                      <div>计划日：{item.snapshot_json?.planDate || "--"}</div>
                      <div>单作品章节数：{item.snapshot_json?.dailyChaptersPerWork ?? "--"}</div>
                      <div>创建时间：{formatTimestamp(item.created_at)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </EmbeddedAtramentiShell>
  );
}
