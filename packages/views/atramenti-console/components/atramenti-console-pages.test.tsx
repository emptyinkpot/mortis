import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AtramentiConsoleHomePage } from "./home-page";
import { AtramentiNovelDashboardPage } from "./novel-dashboard-page";
import { AtramentiSystemOverviewPage } from "./system-overview-page";

vi.mock("@multica/core/paths", async () => {
  const actual = await vi.importActual<typeof import("@multica/core/paths")>("@multica/core/paths");
  return {
    ...actual,
    useWorkspacePaths: () => actual.paths.workspace("mortis"),
  };
});

vi.mock("../../navigation", () => ({
  AppLink: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../layout/page-header", () => ({
  PageHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <header className={className}>{children}</header>
  ),
}));

const fetchMock = vi.fn<typeof fetch>();

function renderWithQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {node}
    </QueryClientProvider>,
  );
}

describe("Atramenti console pages", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the Mortis Atramenti home hub with navigation cards", () => {
    renderWithQueryClient(<AtramentiConsoleHomePage />);

    expect(screen.getByText("从 Mortis 直接进入 Atramenti 的关键工作台")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /先看系统总览/i })).toHaveAttribute(
      "href",
      "/mortis/atramenti/system-overview",
    );
    expect(screen.getByRole("link", { name: /打开小说管线/i })).toHaveAttribute(
      "href",
      "/mortis/atramenti/novel",
    );
    expect(screen.getByRole("link", { name: /打开原版控制台/i })).toHaveAttribute(
      "href",
      "https://console.tengokukk.com",
    );
    expect(screen.getByText("browser.run 门禁现状")).toBeInTheDocument();
    expect(screen.getByText("当前导航策略")).toBeInTheDocument();
  });

  it("renders the Mortis-native system overview shell and data cards", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          generatedAt: "2026-04-21T02:00:00.000Z",
          project: {
            name: "Atramenti Console",
            rootPath: "E:/My Project/Atramenti-Console",
            moduleCount: 4,
          },
          modules: [
            {
              id: "system-overview",
              displayName: "System Overview",
              routePrefix: "/system-overview",
              apiPrefix: "/api/system-overview",
              layer: "dashboard",
              dependsOn: ["runtime"],
              hasReadme: true,
              hasModuleJson: true,
              topologyPath: "docs/system-overview.md",
              mountedInServer: true,
              domain: "console.tengokukk.com",
            },
          ],
          sourceMap: [
            {
              key: "module-map",
              label: "Module Map",
              sourceType: "json",
              sourcePath: "control-plane/source-map.json",
              module: "system-overview",
              readers: ["mortis"],
              writers: ["atramenti-console"],
              fallbacks: [],
            },
          ],
          runtime: [
            {
              id: "runtime-1",
              label: "Console API",
              url: "https://console.tengokukk.com/api/system-overview/summary",
              ok: true,
              statusCode: 200,
            },
          ],
          issues: [
            {
              id: "issue-1",
              severity: "warn",
              category: "source-map",
              target: "module-map",
              summary: "Source map needs refresh",
              sourcePath: "control-plane/source-map.json",
              fixHint: "Regenerate the map from the canonical source.",
            },
          ],
          flows: [
            {
              module: "system-overview",
              id: "flow-1",
              label: "Refresh source map",
              steps: ["Load data", "Render cards"],
            },
          ],
          docs: [
            {
              label: "System Overview README",
              path: "docs/system-overview.md",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    renderWithQueryClient(<AtramentiSystemOverviewPage />);

    expect(screen.getByText("Mortis x Atramenti")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /打开原版面板/i })).toHaveAttribute(
      "href",
      "https://console.tengokukk.com/system-overview/",
    );

    await waitFor(() => {
      expect(screen.getByText("Atramenti Console")).toBeInTheDocument();
    });

    expect(screen.getByText("E:/My Project/Atramenti-Console")).toBeInTheDocument();
    expect(screen.getByText("System Overview")).toBeInTheDocument();
    expect(screen.getByText("system-overview")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "问题" }));
    expect(screen.getByText("Source map needs refresh")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "流程" }));
    expect(screen.getByText("Refresh source map")).toBeInTheDocument();
  });

  it("renders the Mortis-native novel dashboard shell and service status cards", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          syncedAt: "2026-04-21T03:00:00.000Z",
          pipelineReadiness: {
            generateReadyWorks: 2,
            auditReadyWorks: 1,
            publishReadyWorks: 3,
          },
          pipelineQueue: [
            {
              workId: 101,
              workTitle: "Northern Archive",
              chapterNumber: 12,
              chapterTitle: "Relay",
              stage: "publish",
              reason: "Ready to publish",
              updatedAt: "2026-04-21T03:10:00.000Z",
            },
          ],
          pipelineBlockers: [
            {
              type: "cookie",
              message: "Cookie expired",
              workTitle: "Northern Archive",
              chapterNumber: 12,
              reason: "Need a fresh cookie",
              stage: "publish",
              severity: "warn",
              suggestedAction: "Sync account cookies",
              timestamp: "2026-04-21T03:12:00.000Z",
            },
          ],
          activityLog: [
            {
              id: 1,
              timestamp: "2026-04-21T03:15:00.000Z",
              type: "publish",
              message: "Queued chapter 12",
              level: "info",
            },
          ],
          dailyPlanOperations: [
            {
              id: 7,
              created_at: "2026-04-21T01:00:00.000Z",
              operation_type: "daily-plan",
              source: "scheduler",
              snapshot_json: {
                planDate: "2026-04-21",
                dailyChaptersPerWork: 3,
              },
            },
          ],
          automationConfig: {
            autoScanEnabled: true,
            autoPublishEnabled: true,
            scanInterval: 180,
          },
          publishAuto: {
            status: {
              running: true,
              lastHeartbeat: "2026-04-21T03:20:00.000Z",
              processedCount: 9,
              errorCount: 1,
              currentTask: "Publishing chapter 12",
            },
          },
          worksSync: {
            localWorks: [
              {
                id: 101,
                title: "Northern Archive",
                current_chapters: 12,
                target_chapters: 20,
                status: "active",
              },
            ],
            accounts: [
              {
                id: "qq-1",
                name: "QQ 1",
                status: "healthy",
                lastCookieSyncedAt: "2026-04-21T02:58:00.000Z",
              },
            ],
          },
          systemStatus: {
            contentCraftAuto: { status: { running: true, currentTask: "Draft chapter 13" } },
            auditAuto: { status: { running: false, currentTask: null } },
            smartScheduler: { status: { running: true, currentTask: "Refresh queue" } },
            publishAuto: { status: { running: true, currentTask: "Publishing chapter 12" } },
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    renderWithQueryClient(<AtramentiNovelDashboardPage />);

    expect(screen.getByRole("link", { name: /打开原版面板/i })).toHaveAttribute(
      "href",
      "https://console.tengokukk.com/novel/",
    );

    await waitFor(() => {
      expect(screen.getByText("Northern Archive")).toBeInTheDocument();
    });

    expect(screen.getByText("Northern Archive")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "阻塞" }));
    expect(screen.getByText("Cookie expired")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "调度参数" }));
    expect(screen.getByText("自动化配置")).toBeInTheDocument();
    expect(screen.getByText("daily-plan")).toBeInTheDocument();
  });
});
