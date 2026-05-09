"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, MessageSquareText, ShieldCheck } from "lucide-react";
import { roleInvocationListOptions, roleListOptions } from "@multica/core/roles/queries";
import { useRouteRoleMessage } from "@multica/core/roles/mutations";
import { useWorkspaceId } from "@multica/core/hooks";
import type { RoleChannel, RoleDefinition } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { PageHeader } from "../../layout/page-header";

const channelLabel: Record<RoleChannel, string> = {
  web: "Web",
  internal_chat: "内部群聊",
  qq: "QQ",
  api: "API",
};

export function ManagerDashboard() {
  const wsId = useWorkspaceId();
  const { data: roles = [] } = useQuery(roleListOptions(wsId));
  const { data: invocations = [] } = useQuery(roleInvocationListOptions(wsId));
  const routeMessage = useRouteRoleMessage();
  const [message, setMessage] = useState("@manager 规划一下 Mortis 下一步的工程优先级");
  const [channel, setChannel] = useState<RoleChannel>("internal_chat");

  const managerRole = useMemo(
    () => roles.find((role) => role.name === "manager"),
    [roles],
  );

  const managerInvocations = useMemo(
    () => invocations.filter((item) => item.role_name === "manager"),
    [invocations],
  );

  const routeDisabled = !managerRole || !message.trim() || routeMessage.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader>
        <div className="flex min-w-0 items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-muted-foreground" />
          <h1 className="truncate text-sm font-semibold">Manager 职务</h1>
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-5">
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">向 Manager 下命令</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Manager 页面只调用 Role Router；任务创建、职务分派、审批申请都由职务系统接管。
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(["internal_chat", "qq", "web"] as RoleChannel[]).map((item) => (
                    <Button
                      key={item}
                      size="sm"
                      variant={channel === item ? "default" : "outline"}
                      onClick={() => setChannel(item)}
                    >
                      {channelLabel[item]}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="@manager 规划一下 Mortis 下一步"
                  className="min-h-28 resize-none"
                />
                <Button
                  disabled={routeDisabled}
                  onClick={() =>
                    routeMessage.mutate({
                      channel,
                      content: message.trim().startsWith("@manager")
                        ? message.trim()
                        : `@manager ${message.trim()}`,
                      external_thread_key: `${channel}:manager-console`,
                    })
                  }
                >
                  {routeMessage.isPending ? "路由中..." : "发送给 Manager 职务"}
                </Button>
                {routeMessage.data ? (
                  <div className="rounded-md border bg-muted/20 p-3 text-sm">
                    <div className="font-medium">{routeMessage.data.route.role_title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {routeMessage.data.route.command_type} · risk {routeMessage.data.route.risk_level}
                      {routeMessage.data.approval_id ? ` · approval ${routeMessage.data.approval_id}` : ""}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Manager 职务定义</h2>
              </div>
              {managerRole ? <ManagerRoleCard role={managerRole} /> : <ManagerRoleMissing />}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Manager 调用记录</h2>
              <Badge variant="secondary">{managerInvocations.length} recent</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {managerInvocations.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/15 px-3 py-2 text-xs"
                >
                  <Badge variant="outline">{channelLabel[item.channel]}</Badge>
                  <span>{item.command_type}</span>
                  <span>risk {item.risk_level}</span>
                  {item.requires_approval ? <Badge variant="secondary">needs approval</Badge> : null}
                </div>
              ))}
              {managerInvocations.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  暂无 Manager 职务调用记录。
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ManagerRoleCard({ role }: { role: RoleDefinition }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">{role.title}</Badge>
        <Badge variant="outline">{role.name}</Badge>
        <Badge variant="outline">{role.default_runtime}</Badge>
        <Badge variant="outline">{role.approval_policy}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{role.description}</p>
      <RoleList title="职责" items={role.responsibilities} />
      <RoleList title="禁止" items={role.forbidden_actions} />
      <RoleList title="权限" items={role.permissions} />
      <div className="flex flex-wrap gap-1">
        {role.allowed_channels.map((item) => (
          <Badge key={item} variant="outline">
            {channelLabel[item]}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ManagerRoleMissing() {
  return (
    <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      Manager 职务不存在。Role Registry 必须提供内置 manager 职务，页面不会回退到旧 Manager issue 发布器。
    </div>
  );
}

function RoleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md bg-muted/25 px-3 py-2">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="truncate">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
