"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRightLeft, Boxes, FileText, Network, RefreshCw, Siren, Waypoints } from "lucide-react";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import { ScrollArea } from "@multica/ui/components/ui/scroll-area";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@multica/ui/components/ui/tabs";
import { EmbeddedAtramentiShell } from "./embedded-atramenti-shell";

type RuntimeProbe = {
  id: string;
  label: string;
  url: string;
  ok: boolean;
  statusCode: number | null;
  error?: string;
};

type ModuleInfo = {
  id: string;
  displayName: string;
  routePrefix: string | null;
  apiPrefix: string | null;
  layer: string;
  dependsOn: string[];
  hasReadme: boolean;
  hasModuleJson: boolean;
  topologyPath: string | null;
  mountedInServer: boolean;
  domain: string | null;
};

type SourceMapItem = {
  key: string;
  label: string;
  sourceType: string;
  sourcePath: string;
  module: string;
  readers: string[];
  writers: string[];
  fallbacks: string[];
};

type StructureIssue = {
  id: string;
  severity: "info" | "warn" | "error";
  category: string;
  target: string;
  summary: string;
  sourcePath: string;
  fixHint: string;
};

type FlowItem = {
  module: string;
  id: string;
  label: string;
  steps: string[];
};

type DocItem = {
  label: string;
  path: string;
};

type SystemOverviewSummary = {
  generatedAt: string;
  project: {
    name: string;
    rootPath: string;
    moduleCount: number;
  };
  modules: ModuleInfo[];
  sourceMap: SourceMapItem[];
  runtime: RuntimeProbe[];
  issues: StructureIssue[];
  flows: FlowItem[];
  docs: DocItem[];
};

async function fetchSystemOverview(): Promise<SystemOverviewSummary> {
  const response = await fetch("/api/atramenti/system-overview", {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    let message = `system overview request failed: ${response.status}`;
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
  return response.json() as Promise<SystemOverviewSummary>;
}

function formatTimestamp(value: string) {
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
  icon: typeof Boxes;
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

function SeverityBadge({ severity }: { severity: StructureIssue["severity"] }) {
  const className =
    severity === "error"
      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
      : severity === "warn"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-sky-500/10 text-sky-600 dark:text-sky-400";
  return (
    <Badge variant="secondary" className={className}>
      {severity === "error" ? "错误" : severity === "warn" ? "警告" : "信息"}
    </Badge>
  );
}

export function AtramentiSystemOverviewPage() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["atramenti-console", "system-overview"],
    queryFn: fetchSystemOverview,
    refetchInterval: 60_000,
  });

  const runtimeOkCount = data?.runtime.filter((item) => item.ok).length ?? 0;
  const mountedCount = data?.modules.filter((item) => item.mountedInServer).length ?? 0;
  const docCount = data?.docs.length ?? 0;
  const issueCount = data?.issues.length ?? 0;

  return (
    <EmbeddedAtramentiShell
      activeTab="system-overview"
      title="Atramenti 系统总览"
      description="把 Atramenti-Console 原先的 system-overview 面板收进 Mortis 页面体系，沿用 Mortis 的壳层、层级与阅读节奏。"
      badges={data ? [data.project.name, formatTimestamp(data.generatedAt)] : []}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            真源项目：<span className="font-medium text-foreground">{data?.project.rootPath || "加载中..."}</span>
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
                Atramenti system-overview 暂不可用
              </CardTitle>
              <CardDescription>{error instanceof Error ? error.message : "加载失败"}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Boxes}
            label="模块"
            value={isLoading ? <Skeleton className="h-8 w-20" /> : data?.modules.length ?? 0}
            hint={isLoading ? undefined : `${mountedCount} 个已挂载到服务`}
          />
          <MetricCard
            icon={ArrowRightLeft}
            label="真源映射"
            value={isLoading ? <Skeleton className="h-8 w-20" /> : data?.sourceMap.length ?? 0}
            hint={isLoading ? undefined : `${docCount} 份关联文档`}
          />
          <MetricCard
            icon={Network}
            label="Runtime 探针"
            value={isLoading ? <Skeleton className="h-8 w-20" /> : `${runtimeOkCount}/${data?.runtime.length ?? 0}`}
            hint="在线 / 总数"
          />
          <MetricCard
            icon={Siren}
            label="结构问题"
            value={isLoading ? <Skeleton className="h-8 w-20" /> : issueCount}
            hint={isLoading ? undefined : issueCount > 0 ? "优先收口 warn / error" : "当前未发现问题"}
          />
        </div>

        <Tabs defaultValue="modules" className="gap-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="modules">模块</TabsTrigger>
            <TabsTrigger value="sources">真源映射</TabsTrigger>
            <TabsTrigger value="runtime">Runtime</TabsTrigger>
            <TabsTrigger value="issues">问题</TabsTrigger>
            <TabsTrigger value="flows">流程</TabsTrigger>
          </TabsList>

          <TabsContent value="modules">
            <div className="grid gap-4 lg:grid-cols-2">
              {(data?.modules ?? []).slice(0, 12).map((module) => (
                <Card key={module.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{module.displayName}</CardTitle>
                        <CardDescription className="mt-1">{module.id}</CardDescription>
                      </div>
                      <Badge variant={module.mountedInServer ? "default" : "outline"}>
                        {module.mountedInServer ? "已挂载" : "未挂载"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div>层级：{module.layer}</div>
                    <div>路由：{module.routePrefix || "--"}</div>
                    <div>API：{module.apiPrefix || "--"}</div>
                    <div>依赖：{module.dependsOn.length ? module.dependsOn.join(" / ") : "--"}</div>
                    <div>拓扑：{module.topologyPath || "--"}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">真源映射</CardTitle>
                <CardDescription>谁是唯一真源、谁在读、谁在写，优先看这里。</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[560px] pr-4">
                  <div className="space-y-3">
                    {(data?.sourceMap ?? []).slice(0, 24).map((item) => (
                      <div key={item.key} className="rounded-xl border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">{item.label}</div>
                          <Badge variant="outline">{item.sourceType}</Badge>
                          <Badge variant="secondary">{item.module}</Badge>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">{item.sourcePath}</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          读者：{item.readers.length ? item.readers.join(" / ") : "--"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          写者：{item.writers.length ? item.writers.join(" / ") : "--"}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runtime">
            <div className="grid gap-4 lg:grid-cols-2">
              {(data?.runtime ?? []).map((probe) => (
                <Card key={probe.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{probe.label}</CardTitle>
                        <CardDescription className="mt-1 break-all">{probe.url}</CardDescription>
                      </div>
                      <Badge variant={probe.ok ? "default" : "secondary"}>
                        {probe.ok ? "OK" : "FAIL"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <div>状态码：{probe.statusCode ?? "--"}</div>
                    <div>错误：{probe.error || "--"}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="issues">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">结构问题</CardTitle>
                <CardDescription>保留原面板里最有用的“问题 + 修复提示”视角。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(data?.issues ?? []).slice(0, 20).map((issue) => (
                    <div key={issue.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={issue.severity} />
                        <Badge variant="outline">{issue.category}</Badge>
                        <span className="text-sm text-muted-foreground">{issue.target}</span>
                      </div>
                      <div className="mt-2 font-medium">{issue.summary}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{issue.fixHint}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{issue.sourcePath}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flows">
            <div className="grid gap-4 lg:grid-cols-2">
              {(data?.flows ?? []).slice(0, 12).map((flow) => (
                <Card key={flow.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Waypoints className="size-4" />
                      {flow.label}
                    </CardTitle>
                    <CardDescription>{flow.module}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {flow.steps.map((step, index) => (
                      <div key={`${flow.id}-${step}-${index}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span>{step}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
              {data?.docs?.length ? (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="size-4" />
                      关联文档
                    </CardTitle>
                    <CardDescription>来自 Atramenti system-overview 快照的关联文档。</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {data.docs.slice(0, 8).map((doc) => (
                      <div key={doc.path} className="rounded-xl border p-3">
                        <div className="font-medium">{doc.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground break-all">{doc.path}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </EmbeddedAtramentiShell>
  );
}
