"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Save,
  Globe,
  Lock,
  Camera,
  ChevronDown,
} from "lucide-react";
import type {
  Agent,
  AgentVisibility,
  RuntimeDevice,
  MemberWithUser,
  NapcatAccount,
} from "@multica/core/types";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@multica/ui/components/ui/popover";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import { toast } from "sonner";
import { api } from "@multica/core/api";
import { useFileUpload } from "@multica/core/hooks/use-file-upload";
import { ActorAvatar } from "../../../common/actor-avatar";
import { ProviderLogo } from "../../../runtimes/components/provider-logo";
import {
  formatNapcatAccountOptionLabel,
  NAPCAT_ACCOUNT_ENV_KEY,
  resolveNapcatAccountKey,
} from "../../napcat";
import { NapcatAccountPreviewCard } from "../napcat-account-preview-card";

type RuntimeFilter = "mine" | "all";

const NAPCAT_UNASSIGNED_VALUE = "__unassigned__";
const DEFAULT_NAPCAT_ENV_KEYS = [
  NAPCAT_ACCOUNT_ENV_KEY,
  "NAPCAT_API_URL",
  "NAPCAT_ACCESS_TOKEN",
  "NAPCAT_TRANSPORT",
  "NAPCAT_WEBUI_URL",
  "NAPCAT_WEBUI_TOKEN",
  "NAPCAT_WEBUI_CONFIG_PATH",
];

function getManagedNapcatEnvKeys(accounts: NapcatAccount[]): string[] {
  const keys = new Set(DEFAULT_NAPCAT_ENV_KEYS);
  for (const account of accounts) {
    for (const key of Object.keys(account.env ?? {})) {
      keys.add(key);
    }
  }
  return [...keys];
}

function stripManagedNapcatEnv(
  customEnv: Record<string, string>,
  accounts: NapcatAccount[],
): Record<string, string> {
  const nextEnv = { ...customEnv };
  for (const key of getManagedNapcatEnvKeys(accounts)) {
    delete nextEnv[key];
  }
  return nextEnv;
}

function hasManagedNapcatEnv(
  customEnv: Record<string, string>,
  accounts: NapcatAccount[],
): boolean {
  return getManagedNapcatEnvKeys(accounts).some((key) => key in customEnv);
}

export function SettingsTab({
  agent,
  runtimes,
  members,
  currentUserId,
  onSave,
}: {
  agent: Agent;
  runtimes: RuntimeDevice[];
  members: MemberWithUser[];
  currentUserId: string | null;
  onSave: (updates: Partial<Agent>) => Promise<void>;
}) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [visibility, setVisibility] = useState<AgentVisibility>(agent.visibility);
  const [maxTasks, setMaxTasks] = useState(agent.max_concurrent_tasks);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState(agent.runtime_id);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [runtimeFilter, setRuntimeFilter] = useState<RuntimeFilter>("mine");
  const [saving, setSaving] = useState(false);
  const [napcatAccounts, setNapcatAccounts] = useState<NapcatAccount[]>([]);
  const [napcatAccountsLoading, setNapcatAccountsLoading] = useState(false);
  const [napcatAccountsError, setNapcatAccountsError] = useState<string | null>(null);
  const [selectedNapcatAccountKey, setSelectedNapcatAccountKey] = useState<string>(NAPCAT_UNASSIGNED_VALUE);
  const { upload, uploading } = useFileUpload(api);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getOwnerMember = (ownerId: string | null) => {
    if (!ownerId) return null;
    return members.find((m) => m.user_id === ownerId) ?? null;
  };

  const hasOtherRuntimes = runtimes.some((r) => r.owner_id !== currentUserId);

  const filteredRuntimes = useMemo(() => {
    const filtered = runtimeFilter === "mine" && currentUserId
      ? runtimes.filter((r) => r.owner_id === currentUserId)
      : runtimes;
    return [...filtered].sort((a, b) => {
      if (a.owner_id === currentUserId && b.owner_id !== currentUserId) return -1;
      if (a.owner_id !== currentUserId && b.owner_id === currentUserId) return 1;
      return 0;
    });
  }, [runtimes, runtimeFilter, currentUserId]);

  const selectedRuntime = runtimes.find((d) => d.id === selectedRuntimeId) ?? null;
  const selectedOwnerMember = selectedRuntime ? getOwnerMember(selectedRuntime.owner_id) : null;
  const currentNapcatAccountKey = useMemo(
    () => resolveNapcatAccountKey(agent.custom_env ?? {}, napcatAccounts),
    [agent.custom_env, napcatAccounts],
  );
  const selectedNapcatAccount = useMemo(
    () => napcatAccounts.find((account) => account.key === selectedNapcatAccountKey) ?? null,
    [napcatAccounts, selectedNapcatAccountKey],
  );
  const hasManualNapcatEnv = useMemo(
    () =>
      !currentNapcatAccountKey &&
      hasManagedNapcatEnv(agent.custom_env ?? {}, napcatAccounts),
    [agent.custom_env, currentNapcatAccountKey, napcatAccounts],
  );

  useEffect(() => {
    let cancelled = false;

    setNapcatAccountsLoading(true);
    setNapcatAccountsError(null);

    api.listAgentNapcatAccounts(agent.id)
      .then((accounts) => {
        if (cancelled) return;
        setNapcatAccounts(accounts);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "加载 QQ 账号池失败";
        setNapcatAccounts([]);
        setNapcatAccountsError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setNapcatAccountsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  useEffect(() => {
    setSelectedNapcatAccountKey(currentNapcatAccountKey || NAPCAT_UNASSIGNED_VALUE);
  }, [currentNapcatAccountKey]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const result = await upload(file);
      if (!result) return;
      await onSave({ avatar_url: result.link });
      toast.success("头像已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传头像失败");
    }
  };

  const dirty =
    name !== agent.name ||
    description !== (agent.description ?? "") ||
    visibility !== agent.visibility ||
    maxTasks !== agent.max_concurrent_tasks ||
    selectedRuntimeId !== agent.runtime_id ||
    selectedNapcatAccountKey !== (currentNapcatAccountKey || NAPCAT_UNASSIGNED_VALUE);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("名称不能为空");
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<Agent> = {
        name: name.trim(),
        description,
        visibility,
        max_concurrent_tasks: maxTasks,
        runtime_id: selectedRuntimeId,
      };

      if (selectedNapcatAccountKey !== (currentNapcatAccountKey || NAPCAT_UNASSIGNED_VALUE)) {
        const nextCustomEnv = stripManagedNapcatEnv(agent.custom_env ?? {}, napcatAccounts);
        if (selectedNapcatAccountKey !== NAPCAT_UNASSIGNED_VALUE && selectedNapcatAccount) {
          Object.assign(nextCustomEnv, selectedNapcatAccount.env);
          nextCustomEnv[NAPCAT_ACCOUNT_ENV_KEY] = selectedNapcatAccount.key;
        }
        updates.custom_env = nextCustomEnv;
      }

      await onSave(updates);
      toast.success("设置已保存");
    } catch {
      toast.error("保存设置失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Label className="text-xs text-muted-foreground">头像</Label>
        <div className="mt-1.5 flex items-center gap-4">
          <button
            type="button"
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <ActorAvatar actorType="agent" actorId={agent.id} size={64} className="rounded-none" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <div className="text-xs text-muted-foreground">
            点击上传头像
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">名称</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">简介</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="这个智能体负责什么？"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">可见性</Label>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => setVisibility("workspace")}
            className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              visibility === "workspace"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
          >
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">工作区</div>
              <div className="text-xs text-muted-foreground">所有成员都可分配</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              visibility === "private"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
          >
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">私有</div>
              <div className="text-xs text-muted-foreground">仅你可分配</div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">最大并发任务数</Label>
        <Input
          type="number"
          min={1}
          max={50}
          value={maxTasks}
          onChange={(e) => setMaxTasks(Number(e.target.value))}
          className="mt-1 w-24"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">运行时</Label>
          {hasOtherRuntimes && (
            <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setRuntimeFilter("mine")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  runtimeFilter === "mine"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                我的
              </button>
              <button
                type="button"
                onClick={() => setRuntimeFilter("all")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  runtimeFilter === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                全部
              </button>
            </div>
          )}
        </div>
        <Popover open={runtimeOpen} onOpenChange={setRuntimeOpen}>
          <PopoverTrigger
            disabled={runtimes.length === 0}
            className="mt-1.5 flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {selectedRuntime ? (
              <ProviderLogo provider={selectedRuntime.provider} className="h-4 w-4 shrink-0" />
            ) : (
              <ProviderLogo provider="" className="h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">
                  {selectedRuntime?.name ?? "暂无可用运行时"}
                </span>
                {selectedRuntime?.runtime_mode === "cloud" && (
                  <span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
                    云端
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {selectedRuntime ? (
                  selectedOwnerMember ? selectedOwnerMember.name : selectedRuntime.device_info
                ) : "请选择运行时"}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${runtimeOpen ? "rotate-180" : ""}`} />
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-60 w-[var(--anchor-width)] overflow-y-auto p-1">
            {filteredRuntimes.map((device) => {
              const ownerMember = getOwnerMember(device.owner_id);
              return (
                <button
                  key={device.id}
                  onClick={() => {
                    setSelectedRuntimeId(device.id);
                    setRuntimeOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                    device.id === selectedRuntimeId ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <ProviderLogo provider={device.provider} className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{device.name}</span>
                      {device.runtime_mode === "cloud" && (
                        <span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
                          云端
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {ownerMember ? (
                        <>
                          <ActorAvatar actorType="member" actorId={ownerMember.user_id} size={14} />
                          <span className="truncate">{ownerMember.name}</span>
                        </>
                      ) : (
                        <span className="truncate">{device.device_info}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      device.status === "online" ? "bg-success" : "bg-muted-foreground/40"
                    }`}
                  />
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">QQ / NapCat 账号</Label>
        <Select
          value={selectedNapcatAccountKey}
          onValueChange={(value) => setSelectedNapcatAccountKey(value ?? NAPCAT_UNASSIGNED_VALUE)}
          disabled={napcatAccountsLoading || napcatAccounts.length === 0}
        >
          <SelectTrigger className="mt-1 w-full">
            <SelectValue placeholder={napcatAccountsLoading ? "加载中..." : "未分配"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NAPCAT_UNASSIGNED_VALUE}>未分配</SelectItem>
            {napcatAccounts.map((account) => (
              <SelectItem key={account.key} value={account.key} disabled={!account.enabled}>
                {formatNapcatAccountOptionLabel(account)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {napcatAccountsError ? (
          <p className="mt-1.5 text-xs text-destructive">{napcatAccountsError}</p>
        ) : selectedNapcatAccount ? (
          <NapcatAccountPreviewCard account={selectedNapcatAccount} className="mt-2" />
        ) : hasManualNapcatEnv ? (
          <p className="mt-1.5 text-xs text-amber-600">
            当前智能体正在使用手动配置的 NapCat 环境变量，未匹配到账号池条目；保存为“未分配”会清空这些专属键。
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            未分配时不会向该智能体注入专属 QQ / NapCat 账号。
          </p>
        )}
      </div>

      <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
        保存更改
      </Button>
    </div>
  );
}
