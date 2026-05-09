import { describe, it, expect } from "vitest";
import { extractBrowserEvidence, type BrowserTimelineItemLike } from "./browser-evidence";

describe("extractBrowserEvidence", () => {
  it("parses execution-gateway result payloads from task.result", () => {
    const summary = extractBrowserEvidence(
      {
        result: JSON.stringify({
          action: "browser.run",
          purpose: "verify-login",
          gateway_status: "verified",
          verification_level: "V3",
          message: "browser action verified",
          artifacts: [
            {
              kind: "screenshot",
              path: "C:\\tmp\\login.png",
            },
          ],
        }),
        error: null,
      },
      [],
    );

    expect(summary).not.toBeNull();
    expect(summary?.action).toBe("browser.run");
    expect(summary?.purpose).toBe("verify-login");
    expect(summary?.gatewayStatus).toBe("verified");
    expect(summary?.verificationLevel).toBe("V3");
    expect(summary?.artifacts).toEqual([
      {
        kind: "screenshot",
        path: "C:\\tmp\\login.png",
      },
    ]);
    expect(summary?.source).toBe("task");
  });

  it("falls back to transcript urls and screenshot paths when task.result is empty", () => {
    const items: BrowserTimelineItemLike[] = [
      {
        type: "tool_use",
        tool: "exec_command",
        input: {
          command:
            "\"C:\\Program Files\\PowerShell\\7\\pwsh.exe\" -Command 'Get-Item artifacts\\\\mor-16-example-com.png | ConvertTo-Json -Compress'",
        },
      },
      {
        type: "tool_result",
        tool: "exec_command",
        output:
          "{\"FullName\":\"C:\\\\Users\\\\ASUS-KL\\\\multica_workspaces\\\\b089cf97-7a4f-4931-a851-223f7432e50e\\\\9c08d7e3\\\\workdir\\\\artifacts\\\\mor-16-example-com.png\"}",
      },
      {
        type: "text",
        content:
          "对 `https://example.com` 做了真实 browser smoke，主页截图 artifact 已生成：`artifacts/mor-16-example-com.png`。",
      },
    ];

    const summary = extractBrowserEvidence(
      {
        result: null,
        error: null,
      },
      items,
    );

    expect(summary).not.toBeNull();
    expect(summary?.url).toBe("https://example.com");
    expect(summary?.artifacts).toEqual([
      {
        kind: "screenshot",
        path: "artifacts\\mor-16-example-com.png",
      },
    ]);
    expect(summary?.source).toBe("timeline");
  });

  it("ignores loose png mentions outside the artifacts path", () => {
    const summary = extractBrowserEvidence(
      {
        result:
          "[RESULT] 页面截图已生成：artifacts/mor-16-example-com.png；另外参考图 error-state.png 仅来自技能文档示例。",
        error: null,
      },
      [
        {
          type: "text",
          content: "技能文档里还有 error-state.png、success-state.png 这样的示例图，不应计入当前任务证据。",
        },
      ],
    );

    expect(summary).not.toBeNull();
    expect(summary?.artifacts).toEqual([
      {
        kind: "screenshot",
        path: "artifacts/mor-16-example-com.png",
      },
    ]);
  });
});
