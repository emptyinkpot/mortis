import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchCommand } from "./search-command";
import { useSearchStore } from "./search-store";

const {
  mockPush,
  mockSearchIssues,
  mockSearchProjects,
  mockRecentItems,
  mockAllIssues,
  mockSetTheme,
  mockTheme,
  mockPathname,
  mockGetShareableUrl,
  mockWorkspaces,
  mockCurrentWorkspace,
  mockOpenModal,
  mockToastSuccess,
  mockClipboardWrite,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchIssues: vi.fn(),
  mockSearchProjects: vi.fn(),
  mockRecentItems: { current: [] as Array<{ id: string; visitedAt: number }> },
  mockAllIssues: { current: [] as Array<Record<string, unknown>> },
  mockSetTheme: vi.fn(),
  mockTheme: { current: "system" as "light" | "dark" | "system" },
  mockPathname: { current: "/ws-test/issues" as string },
  mockGetShareableUrl: vi.fn((p: string) => `https://app.multica/${p}`),
  mockWorkspaces: {
    current: [] as Array<{ id: string; name: string; slug: string }>,
  },
  mockCurrentWorkspace: {
    current: null as { id: string; name: string; slug: string } | null,
  },
  mockOpenModal: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockClipboardWrite: vi.fn(() => Promise.resolve()),
}));

vi.mock("@multica/core/api", () => ({
  api: {
    searchIssues: mockSearchIssues,
    searchProjects: mockSearchProjects,
  },
}));

vi.mock("@multica/core/issues/stores", () => ({
  useRecentIssuesStore: (
    selector?: (state: { items: typeof mockRecentItems.current }) => unknown,
  ) => {
    const state = { items: mockRecentItems.current };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@multica/core", () => ({
  useWorkspaceId: () => "ws-test",
}));

vi.mock("@multica/core/paths", () => ({
  paths: {
    workspace: (slug: string) => ({
      issues: () => `/${slug}/issues`,
    }),
  },
  useCurrentWorkspace: () => mockCurrentWorkspace.current,
  useWorkspacePaths: () => ({
    inbox: () => "/ws-test/inbox",
    myIssues: () => "/ws-test/my-issues",
    issues: () => "/ws-test/issues",
    projects: () => "/ws-test/projects",
    agents: () => "/ws-test/agents",
    internalChat: () => "/ws-test/internal-chat",
    runtimes: () => "/ws-test/runtimes",
    skills: () => "/ws-test/skills",
    settings: () => "/ws-test/settings",
    issueDetail: (id: string) => `/ws-test/issues/${id}`,
    projectDetail: (id: string) => `/ws-test/projects/${id}`,
  }),
}));

vi.mock("@multica/core/issues/queries", () => ({
  issueListOptions: () => ({ queryKey: ["issues", "ws-test", "list"], enabled: false }),
}));

vi.mock("@multica/core/workspace/queries", () => ({
  workspaceListOptions: () => ({ queryKey: ["workspaces", "list"], enabled: false }),
}));

vi.mock("@multica/core/modals", () => ({
  useModalStore: Object.assign(vi.fn(), {
    getState: () => ({ open: mockOpenModal }),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey: readonly unknown[] }) => {
    const key = opts.queryKey;
    if (key[0] === "workspaces") return { data: mockWorkspaces.current };
    return { data: mockAllIssues.current };
  },
}));

vi.mock("../navigation", () => ({
  useNavigation: () => ({
    push: mockPush,
    pathname: mockPathname.current,
    getShareableUrl: mockGetShareableUrl,
  }),
}));

vi.mock("@multica/ui/components/common/theme-provider", () => ({
  useTheme: () => ({ theme: mockTheme.current, setTheme: mockSetTheme }),
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: vi.fn() },
}));

describe("SearchCommand", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchIssues.mockReset().mockResolvedValue({ issues: [] });
    mockSearchProjects.mockReset().mockResolvedValue({ projects: [] });
    mockRecentItems.current = [];
    mockAllIssues.current = [];
    mockSetTheme.mockReset();
    mockTheme.current = "system";
    mockPathname.current = "/ws-test/issues";
    mockGetShareableUrl
      .mockReset()
      .mockImplementation((p: string) => `https://app.multica/${p}`);
    mockWorkspaces.current = [];
    mockCurrentWorkspace.current = null;
    mockOpenModal.mockReset();
    mockToastSuccess.mockReset();
    mockClipboardWrite.mockReset().mockResolvedValue(undefined);

    Element.prototype.scrollIntoView = vi.fn();

    act(() => {
      useSearchStore.setState({ open: true });
    });
  });

  it("closes on a single Escape press from the search input", async () => {
    const user = userEvent.setup();

    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.click(input);

    expect(useSearchStore.getState().open).toBe(true);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(useSearchStore.getState().open).toBe(false);
    });
    expect(screen.queryByPlaceholderText("输入命令或开始搜索...")).not.toBeInTheDocument();
  });

  it("shows only 新建事项 by default and hides secondary groups until query", () => {
    render(<SearchCommand />);

    expect(screen.queryByText("页面")).not.toBeInTheDocument();
    expect(screen.queryByText("切换工作区")).not.toBeInTheDocument();
    expect(screen.getByText("命令")).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === "新建事项" && el?.tagName === "SPAN"),
    ).toBeInTheDocument();
    expect(screen.queryByText("新建项目")).not.toBeInTheDocument();
    expect(screen.queryByText("切换到浅色主题")).not.toBeInTheDocument();
    expect(screen.queryByText("切换到深色主题")).not.toBeInTheDocument();
    expect(screen.queryByText("跟随系统主题")).not.toBeInTheDocument();
  });

  it("filters navigation pages by query and surfaces 内部群聊", async () => {
    const user = userEvent.setup();
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "群聊");

    await waitFor(() => {
      expect(
        screen.getByText((_, el) => el?.textContent === "内部群聊" && el?.tagName === "SPAN"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("收件箱")).not.toBeInTheDocument();
  });

  it("navigates to internal chat page on selection", async () => {
    const user = userEvent.setup();
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "群聊");

    const chatItem = await screen.findByText(
      (_, el) => el?.textContent === "内部群聊" && el?.tagName === "SPAN",
    );
    await user.click(chatItem);

    expect(mockPush).toHaveBeenCalledWith("/ws-test/internal-chat");
    expect(useSearchStore.getState().open).toBe(false);
  });

  it("renders recent issues from query cache joined with store visit records", () => {
    mockRecentItems.current = [
      { id: "issue-1", visitedAt: 1000 },
      { id: "issue-2", visitedAt: 900 },
    ];
    mockAllIssues.current = [
      { id: "issue-1", identifier: "MUL-1", title: "第一个事项", status: "todo" },
      { id: "issue-2", identifier: "MUL-2", title: "第二个事项", status: "done" },
    ];

    render(<SearchCommand />);

    expect(screen.getByText("最近访问")).toBeInTheDocument();
    expect(screen.getByText("第一个事项")).toBeInTheDocument();
    expect(screen.getByText("MUL-1")).toBeInTheDocument();
    expect(screen.getByText("第二个事项")).toBeInTheDocument();
    expect(screen.getByText("MUL-2")).toBeInTheDocument();
  });

  it("shows 新建事项 / 新建项目 under 命令 and triggers the modal store", async () => {
    const user = userEvent.setup();
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "新建");

    await waitFor(() => {
      expect(screen.getByText("命令")).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => el?.textContent === "新建事项" && el?.tagName === "SPAN"),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => el?.textContent === "新建项目" && el?.tagName === "SPAN"),
      ).toBeInTheDocument();
    });

    const newIssue = await screen.findByText(
      (_, el) => el?.textContent === "新建事项" && el?.tagName === "SPAN",
    );
    await user.click(newIssue);

    expect(mockOpenModal).toHaveBeenCalledWith("create-issue");
    expect(useSearchStore.getState().open).toBe(false);
  });

  it("hides copy-link commands when not on an issue detail route", async () => {
    const user = userEvent.setup();
    mockPathname.current = "/ws-test/projects";
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "复制");

    expect(screen.queryByText("复制事项链接")).not.toBeInTheDocument();
  });

  it("copies issue link and identifier when on an issue detail route", async () => {
    const user = userEvent.setup();
    const writeSpy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockImplementation(mockClipboardWrite);
    mockPathname.current = "/ws-test/issues/issue-1";
    mockAllIssues.current = [
      { id: "issue-1", identifier: "MUL-42", title: "演示事项", status: "todo" },
    ];
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "复制");

    const linkItem = await screen.findByText(
      (_, el) => el?.textContent === "复制事项链接" && el?.tagName === "SPAN",
    );
    await user.click(linkItem);

    expect(mockGetShareableUrl).toHaveBeenCalledWith("/ws-test/issues/issue-1");
    expect(mockClipboardWrite).toHaveBeenCalledWith("https://app.multica//ws-test/issues/issue-1");
    expect(mockToastSuccess).toHaveBeenCalledWith("已复制链接");

    act(() => {
      useSearchStore.setState({ open: true });
    });
    const input2 = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input2, "复制");
    const idItem = await screen.findByText(
      (_, el) => el?.textContent === "复制编号（MUL-42）" && el?.tagName === "SPAN",
    );
    await user.click(idItem);
    expect(mockClipboardWrite).toHaveBeenCalledWith("MUL-42");
    expect(mockToastSuccess).toHaveBeenCalledWith("已复制 MUL-42");

    writeSpy.mockRestore();
  });

  it("filters theme commands by query keywords", async () => {
    const user = userEvent.setup();
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "深色");

    await waitFor(() => {
      expect(screen.getByText("命令")).toBeInTheDocument();
      expect(
        screen.getByText(
          (_, el) => el?.textContent === "切换到深色主题" && el?.tagName === "SPAN",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("切换到浅色主题")).not.toBeInTheDocument();
    expect(screen.queryByText("跟随系统主题")).not.toBeInTheDocument();
  });

  it("applies the selected theme and closes the palette", async () => {
    const user = userEvent.setup();
    mockTheme.current = "light";
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "深色");

    const darkItem = await screen.findByText(
      (_, el) => el?.textContent === "切换到深色主题" && el?.tagName === "SPAN",
    );
    await user.click(darkItem);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(useSearchStore.getState().open).toBe(false);
  });

  it("matches theme action via generic keyword and marks current theme", async () => {
    const user = userEvent.setup();
    mockTheme.current = "dark";
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "主题");

    await waitFor(() => {
      expect(
        screen.getByText(
          (_, el) => el?.textContent === "切换到浅色主题" && el?.tagName === "SPAN",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          (_, el) => el?.textContent === "切换到深色主题" && el?.tagName === "SPAN",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => el?.textContent === "跟随系统主题" && el?.tagName === "SPAN"),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("当前主题")).toBeInTheDocument();
  });

  it("lists other workspaces under 切换工作区 and navigates on select", async () => {
    const user = userEvent.setup();
    mockCurrentWorkspace.current = { id: "ws-current", name: "当前工作区", slug: "current" };
    mockWorkspaces.current = [
      { id: "ws-current", name: "当前工作区", slug: "current" },
      { id: "ws-alpha", name: "Alpha Co", slug: "alpha" },
      { id: "ws-beta", name: "Beta Co", slug: "beta" },
    ];
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "alpha");

    await waitFor(() => {
      expect(screen.getByText("切换工作区")).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => el?.textContent === "Alpha Co" && el?.tagName === "SPAN"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Beta Co")).not.toBeInTheDocument();
    expect(screen.queryByText("当前工作区")).not.toBeInTheDocument();

    const alphaItem = await screen.findByText(
      (_, el) => el?.textContent === "Alpha Co" && el?.tagName === "SPAN",
    );
    await user.click(alphaItem);

    expect(mockPush).toHaveBeenCalledWith("/alpha/issues");
    expect(useSearchStore.getState().open).toBe(false);
  });

  it("shows all other workspaces when typing 工作区", async () => {
    const user = userEvent.setup();
    mockCurrentWorkspace.current = { id: "ws-current", name: "当前工作区", slug: "current" };
    mockWorkspaces.current = [
      { id: "ws-current", name: "当前工作区", slug: "current" },
      { id: "ws-alpha", name: "Alpha Co", slug: "alpha" },
      { id: "ws-beta", name: "Beta Co", slug: "beta" },
    ];
    render(<SearchCommand />);

    const input = screen.getByPlaceholderText("输入命令或开始搜索...");
    await user.type(input, "工作区");

    await waitFor(() => {
      expect(screen.getByText("切换工作区")).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => el?.textContent === "Alpha Co" && el?.tagName === "SPAN"),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => el?.textContent === "Beta Co" && el?.tagName === "SPAN"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("当前工作区")).not.toBeInTheDocument();
  });

  it("filters out recent items not present in query cache", () => {
    mockRecentItems.current = [
      { id: "issue-1", visitedAt: 1000 },
      { id: "deleted-issue", visitedAt: 900 },
    ];
    mockAllIssues.current = [
      { id: "issue-1", identifier: "MUL-1", title: "仍存在的事项", status: "in_progress" },
    ];

    render(<SearchCommand />);

    expect(screen.getByText("最近访问")).toBeInTheDocument();
    expect(screen.getByText("仍存在的事项")).toBeInTheDocument();
    expect(screen.queryByText("deleted-issue")).not.toBeInTheDocument();
  });
});
