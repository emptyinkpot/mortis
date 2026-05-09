import { useState, useEffect, useCallback } from "react";
import { Button } from "@multica/ui/components/ui/button";
import { Switch } from "@multica/ui/components/ui/switch";
import type { DaemonPrefs } from "../../../shared/daemon-types";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function DaemonSettingsTab() {
  const [prefs, setPrefs] = useState<DaemonPrefs>({ autoStart: true, autoStop: false });
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.daemonAPI.getPrefs().then(setPrefs);
    window.daemonAPI.isCliInstalled().then(setCliInstalled);
  }, []);

  const updatePref = useCallback(
    async (key: keyof DaemonPrefs, value: boolean) => {
      setSaving(true);
      const updated = await window.daemonAPI.setPrefs({ [key]: value });
      setPrefs(updated);
      setSaving(false);
    },
    [],
  );

  return (
    <div>
      <h2 className="text-lg font-semibold">守护进程</h2>
      <p className="text-sm text-muted-foreground mt-1">
        配置桌面端如何管理本地 Agent 守护进程。
      </p>

      <div className="mt-6 divide-y">
        <SettingRow
          label="启动应用时自动启动"
          description="当应用打开且你已登录时，自动启动守护进程。"
        >
          <Switch
            checked={prefs.autoStart}
            onCheckedChange={(checked) => updatePref("autoStart", checked)}
            disabled={saving}
          />
        </SettingRow>

        <SettingRow
          label="退出应用时自动停止"
          description="关闭桌面应用时停止守护进程。关闭此项可让守护进程继续在后台运行。"
        >
          <Switch
            checked={prefs.autoStop}
            onCheckedChange={(checked) => updatePref("autoStop", checked)}
            disabled={saving}
          />
        </SettingRow>

        <div className="py-4">
          <p className="text-sm font-medium">CLI 状态</p>
          <p className="text-sm text-muted-foreground mt-1">
            {cliInstalled === null
              ? "检测中…"
              : cliInstalled
                ? "multica CLI 已安装，并可在 PATH 中直接调用。"
                : "未找到 multica CLI。安装后才能启用守护进程管理。"}
          </p>
          {cliInstalled === false && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() =>
                window.desktopAPI.openExternal(
                  "https://github.com/multica-ai/multica#cli-installation",
                )
              }
            >
              安装说明
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
