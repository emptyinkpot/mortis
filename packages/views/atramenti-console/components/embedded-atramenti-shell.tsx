"use client";

import { ArrowUpRight, BookOpenText, Network, PanelTop } from "lucide-react";
import { useWorkspacePaths } from "@multica/core/paths";
import { Badge } from "@multica/ui/components/ui/badge";
import { buttonVariants } from "@multica/ui/components/ui/button";
import { cn } from "@multica/ui/lib/utils";
import { AppLink } from "../../navigation";
import { PageHeader } from "../../layout/page-header";

const ATRAMENTI_CONSOLE_BASE_URL = "https://console.tengokukk.com";

type EmbeddedAtramentiTab = "home" | "system-overview" | "novel";

const tabConfig: Record<
  EmbeddedAtramentiTab,
  { label: string; description: string; legacyPath: string; icon: typeof Network }
> = {
  home: {
    label: "控制台首页",
    description: "Mortis 内的 Atramenti 总入口，收口现有嵌入页面、browser.run 门禁语义与旧控制台跳转。",
    legacyPath: "/",
    icon: PanelTop,
  },
  "system-overview": {
    label: "系统总览",
    description: "Atramenti 模块、真源映射、runtime 探针与结构问题。",
    legacyPath: "/system-overview/",
    icon: Network,
  },
  novel: {
    label: "小说管线",
    description: "小说自动化快照、调度状态、队列、阻塞与活动日志。",
    legacyPath: "/novel/",
    icon: BookOpenText,
  },
};

function buildLegacyUrl(pathname: string) {
  return `${ATRAMENTI_CONSOLE_BASE_URL}${pathname}`;
}

export function EmbeddedAtramentiShell({
  activeTab,
  title,
  description,
  badges = [],
  children,
}: {
  activeTab: EmbeddedAtramentiTab;
  title: string;
  description: string;
  badges?: string[];
  children: React.ReactNode;
}) {
  const wsPaths = useWorkspacePaths();
  const tabs = [
    {
      key: "home" as const,
      href: wsPaths.atramentiHome(),
    },
    {
      key: "system-overview" as const,
      href: wsPaths.atramentiOverview(),
    },
    {
      key: "novel" as const,
      href: wsPaths.atramentiNovel(),
    },
  ];
  const activeConfig = tabConfig[activeTab];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader className="h-auto min-h-14 px-4 py-3">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Mortis x Atramenti
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
              <Badge variant="secondary">Mortis 内嵌</Badge>
              <Badge variant="outline">保留 Mortis 风格</Badge>
              {badges.map((badge) => (
                <Badge key={badge} variant="outline">
                  {badge}
                </Badge>
              ))}
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={buildLegacyUrl(activeConfig.legacyPath)}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              打开原版面板
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </PageHeader>

      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const config = tabConfig[tab.key];
            const Icon = config.icon;
            return (
              <AppLink
                key={tab.key}
                href={tab.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  tab.key === activeTab
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{config.label}</span>
              </AppLink>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{activeConfig.description}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-background">{children}</div>
    </div>
  );
}
