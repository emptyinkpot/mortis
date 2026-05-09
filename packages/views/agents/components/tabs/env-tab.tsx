"use client";

import { useState } from "react";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import type { Agent } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import { toast } from "sonner";
import {
  buildAgentEnvSummary,
  getRecommendedEnvPresets,
} from "../../agent-env-summary";

let nextEnvId = 0;

interface EnvEntry {
  id: number;
  key: string;
  value: string;
  visible: boolean;
}

function envMapToEntries(env: Record<string, string>): EnvEntry[] {
  return Object.entries(env).map(([key, value]) => ({
    id: nextEnvId++,
    key,
    value,
    visible: false,
  }));
}

function entriesToEnvMap(entries: EnvEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (key) {
      map[key] = entry.value;
    }
  }
  return map;
}

export function EnvTab({
  agent,
  runtimeProvider,
  readOnly = false,
  onSave,
}: {
  agent: Agent;
  runtimeProvider?: string | null;
  readOnly?: boolean;
  onSave: (updates: Partial<Agent>) => Promise<void>;
}) {
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>(
    envMapToEntries(agent.custom_env ?? {}),
  );
  const [saving, setSaving] = useState(false);

  const currentEnvMap = entriesToEnvMap(envEntries);
  const originalEnvMap = agent.custom_env ?? {};
  const envSummary = buildAgentEnvSummary(
    currentEnvMap,
    runtimeProvider,
    readOnly,
  );
  const recommendedPresets = getRecommendedEnvPresets(runtimeProvider);
  const dirty =
    JSON.stringify(currentEnvMap) !== JSON.stringify(originalEnvMap);

  const addEnvEntry = () => {
    setEnvEntries([
      ...envEntries,
      { id: nextEnvId++, key: "", value: "", visible: true },
    ]);
  };

  const ensureEnvEntry = (key: string) => {
    const normalized = key.trim();
    if (!normalized) {
      return;
    }

    const existingIndex = envEntries.findIndex(
      (entry) => entry.key.trim().toUpperCase() === normalized.toUpperCase(),
    );

    if (existingIndex >= 0) {
      setEnvEntries(
        envEntries.map((entry, index) =>
          index === existingIndex ? { ...entry, visible: true } : entry,
        ),
      );
      toast.success(`${normalized} 已存在，已展开可编辑`);
      return;
    }

    setEnvEntries([
      ...envEntries,
      { id: nextEnvId++, key: normalized, value: "", visible: true },
    ]);
    toast.success(`已添加 ${normalized}`);
  };

  const removeEnvEntry = (index: number) => {
    setEnvEntries(envEntries.filter((_, i) => i !== index));
  };

  const updateEnvEntry = (
    index: number,
    field: "key" | "value",
    val: string,
  ) => {
    setEnvEntries(
      envEntries.map((entry, i) =>
        i === index ? { ...entry, [field]: val } : entry,
      ),
    );
  };

  const toggleEnvVisibility = (index: number) => {
    setEnvEntries(
      envEntries.map((entry, i) =>
        i === index ? { ...entry, visible: !entry.visible } : entry,
      ),
    );
  };

  const handleSave = async () => {
    const keys = envEntries.filter((e) => e.key.trim()).map((e) => e.key.trim());
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size < keys.length) {
      toast.error("环境变量键重复");
      return;
    }

    setSaving(true);
    try {
      await onSave({ custom_env: currentEnvMap });
      toast.success("环境变量已保存");
    } catch {
      toast.error("保存环境变量失败");
    } finally {
      setSaving(false);
    }
  };

  if (readOnly) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-foreground">Key 来源摘要</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                只显示 provider、键名和遮罩信息，不回显明文 secret。
              </p>
            </div>
            <Badge variant="outline">{envSummary.providerLabel}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{envSummary.sourceHint}</p>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">已配置 key 槽位</Label>
            {envSummary.keySlots.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {envSummary.keySlots.map((slot) => (
                  <Badge key={slot.key} variant="secondary" className="font-mono">
                    {slot.key}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                当前未在 custom_env 中检测到 API key。
              </p>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            环境变量
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            启动时注入到智能体进程中。变量值已隐藏，只有智能体所有者或工作区管理员可以查看和编辑。
          </p>
        </div>
        {envEntries.length > 0 ? (
          <div className="space-y-2">
            {envEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <Input
                  value={entry.key}
                  readOnly
                  className="w-[40%] font-mono text-xs bg-muted"
                />
                <div className="relative flex-1">
                  <Input
                    type="password"
                    value="****"
                    readOnly
                    className="pr-8 font-mono text-xs bg-muted"
                  />
                  <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">未配置环境变量。</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-foreground">Key 来源摘要</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              这里显示当前 provider 与已配置的 key 槽位；完整值仍只在输入框里可见。
            </p>
          </div>
          <Badge variant="outline">{envSummary.providerLabel}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{envSummary.sourceHint}</p>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            {envSummary.keySlots.length <= 1 ? "当前 key 槽位" : "候选 key 槽位"}
          </Label>
          {envSummary.keySlots.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {envSummary.keySlots.map((slot) => (
                <Badge key={slot.key} variant="secondary" className="gap-1.5 font-mono">
                  <span>{slot.key}</span>
                  {slot.fingerprint ? (
                    <span className="text-[10px] text-muted-foreground">
                      {slot.fingerprint}
                    </span>
                  ) : null}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              当前未在 custom_env 中检测到 API key。
            </p>
          )}
        </div>
        {envSummary.relatedConfigKeys.length > 0 ? (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">相关配置</Label>
            <div className="flex flex-wrap gap-1.5">
              {envSummary.relatedConfigKeys.map((key) => (
                <Badge key={key} variant="outline" className="font-mono">
                  {key}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <div>
          <Label className="text-xs text-muted-foreground">快捷预设</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            按当前 provider 推荐常见 key 槽位；点击后会自动插入到下方列表。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recommendedPresets.map((preset) => (
            <Button
              key={preset.key}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-mono"
              onClick={() => ensureEnvEntry(preset.key)}
            >
              {preset.key}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs text-muted-foreground">
            环境变量
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            启动时注入到智能体进程中（例如 OPENAI_API_KEY、ANTHROPIC_API_KEY、
            OPENAI_BASE_URL）
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEnvEntry}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          添加
        </Button>
      </div>
      {envEntries.length > 0 && (
        <div className="space-y-2">
          {envEntries.map((entry, index) => (
            <div key={entry.id} className="flex items-center gap-2">
              <Input
                value={entry.key}
                onChange={(e) => updateEnvEntry(index, "key", e.target.value)}
                placeholder="KEY"
                className="w-[40%] font-mono text-xs"
              />
              <div className="relative flex-1">
                <Input
                  type={entry.visible ? "text" : "password"}
                  value={entry.value}
                  onChange={(e) =>
                    updateEnvEntry(index, "value", e.target.value)
                  }
                  placeholder="value"
                  className="pr-8 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => toggleEnvVisibility(index)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {entry.visible ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeEnvEntry(index)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5 mr-1.5" />
        )}
        保存
      </Button>
    </div>
  );
}
