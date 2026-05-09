"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@multica/ui/lib/utils";
import { AppLink, useNavigation } from "../navigation";
import {
  Inbox,
  ListTodo,
  Bot,
  Monitor,
  LayoutDashboard,
  Network,
  ChevronDown,
  Settings,
  Plus,
  Check,
  BookOpenText,
  BadgeCheck,
  BrainCircuit,
  SquarePen,
  CircleUser,
  FolderKanban,
  Globe,
  Rocket,
  Server,
  Zap,
  MessageSquareText,
  PanelTop,
} from "lucide-react";
import { WorkspaceAvatar } from "../workspace/workspace-avatar";
import { ActorAvatar } from "@multica/ui/components/common/actor-avatar";
import { useIssueDraftStore } from "@multica/core/issues/stores/draft-store";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@multica/ui/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@multica/ui/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@multica/ui/components/ui/popover";
import { useAuthStore } from "@multica/core/auth";
import { useCurrentWorkspace, useWorkspacePaths, paths } from "@multica/core/paths";
import { workspaceListOptions, myInvitationListOptions, workspaceKeys } from "@multica/core/workspace/queries";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inboxKeys, deduplicateInboxItems } from "@multica/core/inbox/queries";
import { api } from "@multica/core/api";
import { useModalStore } from "@multica/core/modals";
import { useMyRuntimesNeedUpdate } from "@multica/core/runtimes/hooks";
import { pinListOptions } from "@multica/core/pins/queries";

const singleUserMode = Boolean(process.env.NEXT_PUBLIC_AUTO_LOGIN_WORKSPACE_SLUG);
const DeferredPinnedItemsSection = dynamic(
  () => import("./pinned-items-section").then((mod) => mod.PinnedItemsSection),
  { ssr: false },
);

// Nav items reference WorkspacePaths method names so they can be resolved
// against the current workspace slug at render time (see AppSidebar body).
// Only parameterless paths are valid nav destinations.
type NavKey =
  | "inbox"
  | "myIssues"
  | "issues"
  | "projects"
  | "agentOS"
  | "manager"
  | "roles"
  | "autopilots"
  | "agents"
  | "internalChat"
  | "overview"
  | "servers"
  | "deployments"
  | "domains"
  | "atramentiHome"
  | "atramentiOverview"
  | "atramentiNovel"
  | "runtimes"
  | "skills"
  | "settings";

const personalNav: { key: NavKey; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "收件箱", icon: Inbox },
  { key: "myIssues", label: "我的事项", icon: CircleUser },
];

const workspaceNav: { key: NavKey; label: string; icon: typeof Inbox }[] = [
  { key: "issues", label: "事项", icon: ListTodo },
  { key: "projects", label: "项目", icon: FolderKanban },
  { key: "agentOS", label: "Agent OS", icon: Network },
  { key: "manager", label: "Manager 职务", icon: BrainCircuit },
  { key: "roles", label: "AI 职务", icon: BadgeCheck },
  { key: "autopilots", label: "自动流程", icon: Zap },
  { key: "agents", label: "智能体", icon: Bot },
  { key: "internalChat", label: "内部群聊", icon: MessageSquareText },
];

const operationsNav: { key: NavKey; label: string; icon: typeof Inbox }[] = [
  { key: "overview", label: "总览", icon: LayoutDashboard },
  { key: "servers", label: "服务器", icon: Server },
  { key: "deployments", label: "部署", icon: Rocket },
  { key: "domains", label: "域名", icon: Globe },
];

const atramentiNav: { key: NavKey; label: string; icon: typeof Inbox }[] = [
  { key: "atramentiHome", label: "控制台首页", icon: PanelTop },
  { key: "atramentiOverview", label: "系统总览", icon: Network },
  { key: "atramentiNovel", label: "小说管线", icon: SquarePen },
];

const configureNav: { key: NavKey; label: string; icon: typeof Inbox }[] = [
  { key: "runtimes", label: "运行时", icon: Monitor },
  { key: "skills", label: "技能", icon: BookOpenText },
  { key: "settings", label: "设置", icon: Settings },
];

function DraftDot() {
  const hasDraft = useIssueDraftStore((s) => !!(s.draft.title || s.draft.description));
  if (!hasDraft) return null;
  return <span className="absolute top-0 right-0 size-1.5 rounded-full bg-brand" />;
}

interface AppSidebarProps {
  /** Rendered above SidebarHeader (e.g. desktop traffic light spacer) */
  topSlot?: React.ReactNode;
  /** Rendered in the header between workspace switcher and new-issue button (e.g. search trigger) */
  searchSlot?: React.ReactNode;
  /** Extra className for SidebarHeader */
  headerClassName?: string;
  /** Extra style for SidebarHeader */
  headerStyle?: React.CSSProperties;
}

export function AppSidebar({ topSlot, searchSlot, headerClassName, headerStyle }: AppSidebarProps = {}) {
  const { pathname, push } = useNavigation();
  const user = useAuthStore((s) => s.user);
  const userId = useAuthStore((s) => s.user?.id);
  const workspace = useCurrentWorkspace();
  const p = useWorkspacePaths();
  const shouldLoadWorkspaceSwitcherData = !singleUserMode;
  const { data: workspaces = [] } = useQuery({
    ...workspaceListOptions(),
    enabled: shouldLoadWorkspaceSwitcherData,
  });
  const { data: myInvitations = [] } = useQuery({
    ...myInvitationListOptions(),
    enabled: shouldLoadWorkspaceSwitcherData,
  });
  const workspaceSwitcherItems = singleUserMode
    ? workspace
      ? [workspace]
      : []
    : workspaces;

  const wsId = workspace?.id;
  const { data: inboxItems = [] } = useQuery({
    queryKey: wsId ? inboxKeys.list(wsId) : ["inbox", "disabled"],
    queryFn: () => api.listInbox(),
    enabled: !!wsId,
  });
  const [runtimeUpdateCheckEnabled, setRuntimeUpdateCheckEnabled] = useState(false);
  useEffect(() => {
    setRuntimeUpdateCheckEnabled(false);
    if (!wsId) return;

    const enable = () => setRuntimeUpdateCheckEnabled(true);
    const timeoutId = window.setTimeout(enable, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [wsId]);
  const unreadCount = React.useMemo(
    () => deduplicateInboxItems(inboxItems).filter((i) => !i.read).length,
    [inboxItems],
  );
  const hasRuntimeUpdates = useMyRuntimesNeedUpdate(
    runtimeUpdateCheckEnabled ? wsId : undefined,
  );
  const { data: pinnedItems = [] } = useQuery({
    ...pinListOptions(wsId ?? "", userId ?? ""),
    enabled: !!wsId && !!userId,
  });

  const queryClient = useQueryClient();
  const acceptInvitationMut = useMutation({
    mutationFn: (id: string) => api.acceptInvitation(id),
    // After accepting an invitation, navigate INTO the newly-joined workspace.
    // Otherwise the user stays on their current workspace and just sees the
    // new one appear in the dropdown — silent and confusing (this is MUL-820).
    onSuccess: async (_, invitationId) => {
      const invitation = myInvitations.find((i) => i.id === invitationId);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.myInvitations() });
      // staleTime: 0 forces a real network fetch — we need the joined workspace
      // in the list before we can resolve its slug for navigation.
      const list = await queryClient.fetchQuery({
        ...workspaceListOptions(),
        staleTime: 0,
      });
      const joined = invitation
        ? list.find((w) => w.id === invitation.workspace_id)
        : null;
      if (joined) {
        push(paths.workspace(joined.slug).issues());
      }
    },
  });
  const declineInvitationMut = useMutation({
    mutationFn: (id: string) => api.declineInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.myInvitations() });
    },
  });

  // Global "C" shortcut to open create-issue modal (like Linear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (e.target as HTMLElement)?.isContentEditable;
        if (isEditable) return;
        if (useModalStore.getState().modal) return;
        e.preventDefault();
        // Auto-fill project when on a project detail page
        const projectMatch = pathname.match(/^\/[^/]+\/projects\/([^/]+)$/);
        const data = projectMatch ? { project_id: projectMatch[1] } : undefined;
        useModalStore.getState().open("create-issue", data);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pathname]);

  return (
      <Sidebar variant="inset">
        {topSlot}
        {/* Workspace Switcher */}
        <SidebarHeader className={cn("py-3", headerClassName)} style={headerStyle}>
          <SidebarMenu>
            <SidebarMenuItem>
              {singleUserMode ? (
                <SidebarMenuButton>
                  <WorkspaceAvatar name={workspace?.name ?? "M"} size="sm" />
                  <span className="flex-1 truncate font-medium">
                    {workspace?.name ?? "Mortis"}
                  </span>
                </SidebarMenuButton>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton>
                        <WorkspaceAvatar name={workspace?.name ?? "M"} size="sm" />
                        <span className="flex-1 truncate font-medium">
                          {workspace?.name ?? "Mortis"}
                        </span>
                        <ChevronDown className="size-3 text-muted-foreground" />
                      </SidebarMenuButton>
                    }
                  />
                  <DropdownMenuContent
                    className="w-auto"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {user?.email}
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        工作区
                      </DropdownMenuLabel>
                      {workspaceSwitcherItems.map((ws) => (
                        <DropdownMenuItem
                          key={ws.id}
                          render={
                            <AppLink href={paths.workspace(ws.slug).issues()} />
                          }
                        >
                          <WorkspaceAvatar name={ws.name} size="sm" />
                          <span className="flex-1 truncate">{ws.name}</span>
                          {ws.id === workspace?.id && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem
                        onClick={() =>
                          useModalStore.getState().open("create-workspace")
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        创建工作区
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    {myInvitations.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            待处理邀请
                          </DropdownMenuLabel>
                          {myInvitations.map((inv) => (
                            <div key={inv.id} className="flex items-center gap-2 px-2 py-1.5">
                              <WorkspaceAvatar name={inv.workspace_name ?? "W"} size="sm" />
                              <span className="flex-1 truncate text-sm">{inv.workspace_name ?? "工作区"}</span>
                              <button
                                type="button"
                                className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                disabled={acceptInvitationMut.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  acceptInvitationMut.mutate(inv.id);
                                }}
                              >
                                加入
                              </button>
                              <button
                                type="button"
                                className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
                                disabled={declineInvitationMut.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  declineInvitationMut.mutate(inv.id);
                                }}
                              >
                                拒绝
                              </button>
                            </div>
                          ))}
                        </DropdownMenuGroup>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarMenu>
            {searchSlot && (
              <SidebarMenuItem>
                {searchSlot}
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-muted-foreground"
                onClick={() => useModalStore.getState().open("create-issue")}
              >
                <span className="relative">
                  <SquarePen />
                  <DraftDot />
                </span>
                <span>新建事项</span>
                <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">C</kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {personalNav.map((item) => {
                  const href = p[item.key]();
                  const isActive = pathname === href;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<AppLink href={href} />}
                        className="text-muted-foreground hover:not-data-active:bg-sidebar-accent/70 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                        {item.key === "inbox" && unreadCount > 0 && (
                          <span className="ml-auto text-xs">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {pinnedItems.length > 0 && <DeferredPinnedItemsSection pinnedItems={pinnedItems} />}

          <SidebarGroup>
            <SidebarGroupLabel>工作区</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {workspaceNav.map((item) => {
                  const href = p[item.key]();
                  const isActive = pathname === href;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<AppLink href={href} />}
                        className="text-muted-foreground hover:not-data-active:bg-sidebar-accent/70 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>运维</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {operationsNav.map((item) => {
                  const href = p[item.key]();
                  const isActive = pathname === href;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<AppLink href={href} />}
                        className="text-muted-foreground hover:not-data-active:bg-sidebar-accent/70 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Atramenti</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {atramentiNav.map((item) => {
                  const href = p[item.key]();
                  const isActive = pathname === href;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<AppLink href={href} />}
                        className="text-muted-foreground hover:not-data-active:bg-sidebar-accent/70 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>配置</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {configureNav.map((item) => {
                  const href = p[item.key]();
                  const isActive = pathname === href;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<AppLink href={href} />}
                        className="text-muted-foreground hover:not-data-active:bg-sidebar-accent/70 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                        {item.key === "runtimes" && hasRuntimeUpdates && (
                          <span className="ml-auto size-1.5 rounded-full bg-destructive" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-2">
          <div className="border-t pt-2">
            <Popover>
              <PopoverTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer">
                <ActorAvatar
                  name={user?.name ?? ""}
                  initials={(user?.name ?? "U").charAt(0).toUpperCase()}
                  avatarUrl={user?.avatar_url}
                  size={28}
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium leading-tight">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground leading-tight">
                    {user?.email}
                  </p>
                </div>
              </PopoverTrigger>
              <PopoverContent side="top" sideOffset={8} align="start" className="w-48 p-0">
                <div className="flex items-center gap-2.5 px-2.5 py-2 border-b">
                  <ActorAvatar
                    name={user?.name ?? ""}
                    initials={(user?.name ?? "U").charAt(0).toUpperCase()}
                    avatarUrl={user?.avatar_url}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user?.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
  );
}
