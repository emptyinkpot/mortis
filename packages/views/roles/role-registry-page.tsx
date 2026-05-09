"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, MessageSquareText, ShieldCheck } from "lucide-react";
import { roleInvocationListOptions, roleListOptions } from "@multica/core/roles/queries";
import { useCreateRole, useRouteRoleMessage } from "@multica/core/roles/mutations";
import { useWorkspaceId } from "@multica/core/hooks";
import type { RoleChannel, RoleDefinition } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { PageHeader } from "../layout/page-header";

const channelLabel: Record<RoleChannel, string> = {
  web: "Web",
  internal_chat: "内部群聊",
  qq: "QQ",
  api: "API",
};

export function RoleRegistryPage() {
  const wsId = useWorkspaceId();
  const { data: roles = [], isLoading } = useQuery(roleListOptions(wsId));
  const { data: invocations = [] } = useQuery(roleInvocationListOptions(wsId));
  const routeMessage = useRouteRoleMessage();
  const createRole = useCreateRole();
  const [message, setMessage] = useState("@manager 规划一下 Manager AI 和内部群聊结合的实现");
  const [channel, setChannel] = useState<RoleChannel>("internal_chat");
  const [customName, setCustomName] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const builtIns = useMemo(() => roles.filter((role) => role.built_in), [roles]);
  const customRoles = useMemo(() => roles.filter((role) => !role.built_in), [roles]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader>
        <div className="flex min-w-0 items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-muted-foreground" />
          <h1 className="truncate text-sm font-semibold">AI 职务</h1>
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-5">
          <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Role Registry</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Manager / Builder / Tester 是内置职务；财务、运维、研究员等可以作为自定义职务继续添加。
              </p>
              <div className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">正在加载职务...</div>
                ) : (
                  <>
                    {builtIns.map((role) => (
                      <RoleCard key={role.id} role={role} />
                    ))}
                    {customRoles.map((role) => (
                      <RoleCard key={role.id} role={role} />
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">消息路由模拟</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  QQ / Web / 内部群聊都会进入同一个 Role Router；高风险命令只生成审批申请。
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
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
                    className="min-h-24 resize-none"
                  />
                  <Button
                    disabled={!message.trim() || routeMessage.isPending}
                    onClick={() =>
                      routeMessage.mutate({
                        channel,
                        content: message.trim(),
                        external_thread_key: `${channel}:manual-console`,
                      })
                    }
                  >
                    {routeMessage.isPending ? "路由中..." : "路由到职务"}
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
                <h2 className="text-sm font-semibold">新增自定义职务</h2>
                <div className="mt-4 space-y-3">
                  <Input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="finance" />
                  <Input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="财务 AI" />
                  <Textarea
                    value={customDescription}
                    onChange={(event) => setCustomDescription(event.target.value)}
                    placeholder="整理账单、生成预算报告、提醒异常支出；不能付款或修改银行卡。"
                    className="min-h-20 resize-none"
                  />
                  <Button
                    variant="outline"
                    disabled={!customName.trim() || !customTitle.trim() || createRole.isPending}
                    onClick={() =>
                      createRole.mutate(
                        {
                          name: customName.trim(),
                          title: customTitle.trim(),
                          description: customDescription.trim(),
                          responsibilities: customDescription.trim() ? [customDescription.trim()] : [],
                          forbidden_actions: ["high-risk execution without approval"],
                          permissions: ["report:create", "approval:request"],
                          default_runtime: "manual",
                          allowed_channels: ["web", "internal_chat", "qq"],
                          approval_policy: "operator_required_for_high_risk",
                          system_prompt: `You are ${customTitle.trim()}. Follow the role boundary and request approval for risky actions.`,
                        },
                        {
                          onSuccess: () => {
                            setCustomName("");
                            setCustomTitle("");
                            setCustomDescription("");
                          },
                        },
                      )
                    }
                  >
                    创建职务
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Invocation Timeline</h2>
              <Badge variant="secondary">{invocations.length} recent</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {invocations.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/15 px-3 py-2 text-xs">
                  <Badge variant="outline">{item.role_title}</Badge>
                  <span>{channelLabel[item.channel]}</span>
                  <span>{item.command_type}</span>
                  <span>risk {item.risk_level}</span>
                  {item.requires_approval ? <Badge variant="secondary">needs approval</Badge> : null}
                </div>
              ))}
              {invocations.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  暂无职务调用记录。
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RoleCard({ role }: { role: RoleDefinition }) {
  return (
    <article className="rounded-md border bg-muted/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={role.built_in ? "default" : "secondary"}>{role.title}</Badge>
        <Badge variant="outline">{role.name}</Badge>
        <Badge variant="outline">{role.default_runtime}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <List title="职责" items={role.responsibilities} />
        <List title="禁止" items={role.forbidden_actions} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {role.allowed_channels.map((item) => (
          <Badge key={item} variant="outline">
            {channelLabel[item] ?? item}
          </Badge>
        ))}
      </div>
    </article>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
        {items.slice(0, 4).map((item) => (
          <li key={item} className="truncate">{item}</li>
        ))}
        {items.length === 0 ? <li>未指定</li> : null}
      </ul>
    </div>
  );
}
