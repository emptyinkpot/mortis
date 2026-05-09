"use client";

import { ArrowRight, ArrowUpRight, BookOpenText, Network, PanelTop, ShieldCheck, Waypoints } from "lucide-react";
import { useWorkspacePaths } from "@multica/core/paths";
import { Badge } from "@multica/ui/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import { buttonVariants } from "@multica/ui/components/ui/button";
import { cn } from "@multica/ui/lib/utils";
import { AppLink } from "../../navigation";
import { EmbeddedAtramentiShell } from "./embedded-atramenti-shell";

const ATRAMENTI_CONSOLE_BASE_URL = "https://console.tengokukk.com";

const primaryCards = [
  {
    key: "system-overview",
    title: "系统总览",
    description: "查看模块、真源映射、runtime 探针和结构问题，适合先判断当前基线。",
    badge: "结构与拓扑",
    icon: Network,
  },
  {
    key: "novel",
    title: "小说管线",
    description: "查看小说自动化快照、调度状态、阻塞、队列和活动流。",
    badge: "业务运维",
    icon: BookOpenText,
  },
] as const;

const executionSteps = [
  "任务进入 Mortis 后，Execution Gateway 先判定是否需要真实浏览器路径。",
  "命中浏览器任务时，daemon 会把 MCP 工具收口到 browser.run，而不是让执行器只输出解释。",
  "完成门继续检查验证痕迹，避免 reasoning-only 结果直接被判成已完成。",
];

export function AtramentiConsoleHomePage() {
  const wsPaths = useWorkspacePaths();
  const cardLinks: Record<(typeof primaryCards)[number]["key"], string> = {
    "system-overview": wsPaths.atramentiOverview(),
    novel: wsPaths.atramentiNovel(),
  };

  return (
    <EmbeddedAtramentiShell
      activeTab="home"
      title="Atramenti 控制台"
      description="把 Mortis 里已经接入的 Atramenti 页面、browser.run 执行门禁和旧控制台入口收在一个前端导航枢纽里，先形成可见闭环。"
      badges={["Mortis 导航已接管", "Execution Gateway 已接入"]}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
          <Card className="border-border/70 bg-gradient-to-br from-background via-background to-muted/60">
            <CardHeader className="gap-3">
              <Badge variant="secondary" className="w-fit">
                Mortis x Atramenti
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-2xl tracking-tight">从 Mortis 直接进入 Atramenti 的关键工作台</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  这一层先不做大重构，而是把已经可用的嵌入页面、旧控制台跳转和
                  browser.run 执行门禁关系收成一个能导航、能阅读、能继续扩面的前端入口。
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <AppLink
                href={wsPaths.atramentiOverview()}
                className={cn(buttonVariants({ size: "sm" }), "gap-2")}
              >
                先看系统总览
                <ArrowRight className="size-4" />
              </AppLink>
              <AppLink
                href={wsPaths.atramentiNovel()}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
              >
                打开小说管线
                <ArrowRight className="size-4" />
              </AppLink>
              <a
                href={ATRAMENTI_CONSOLE_BASE_URL}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2")}
              >
                打开原版控制台
                <ArrowUpRight className="size-4" />
              </a>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="size-4 text-emerald-500" />
                browser.run 门禁现状
              </div>
              <CardDescription>
                后端最小接入已经完成；这一版前端先把入口和认知路径补齐。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border bg-muted/40 p-3">
                浏览器任务现在必须走 <span className="font-medium text-foreground">browser.run</span>，
                不能只靠解释性输出收尾。
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                daemon / gateway / MCP 三段关系已经接上，但真实在线浏览器闭环仍可继续补
                artifact 级验证。
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            {primaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.key} className="border-border/70">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <CardTitle className="text-base">{card.title}</CardTitle>
                      </div>
                      <Badge variant="outline">{card.badge}</Badge>
                    </div>
                    <CardDescription className="leading-6">{card.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AppLink
                      href={cardLinks[card.key]}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
                    >
                      进入 {card.title}
                      <ArrowRight className="size-4" />
                    </AppLink>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Waypoints className="size-4 text-sky-500" />
                执行链路
              </div>
              <CardDescription>
                这轮 UI 先把 Mortis 里最需要知道的执行路径显式露出来。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {executionSteps.map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold text-foreground">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step}</p>
                </div>
              ))}
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                下一步可以继续把真实 browser artifact、daemon 在线状态和更多 Atramenti 面板继续接进这个入口。
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <PanelTop className="size-4 text-violet-500" />
              当前导航策略
            </div>
            <CardDescription>
              侧栏增加了 Atramenti 的总入口，具体页面仍保持细分导航，先保证“能找到、能进入、能继续扩”。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">控制台首页</div>
              <p className="mt-1 leading-6">统一收口 Atramenti 的嵌入页面、原版跳转和 gateway 语义。</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">系统总览</div>
              <p className="mt-1 leading-6">继续承载模块、真源、runtime 与结构问题。</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">小说管线</div>
              <p className="mt-1 leading-6">继续承载业务快照、队列、阻塞和服务状态。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </EmbeddedAtramentiShell>
  );
}
