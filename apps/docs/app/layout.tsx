import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/source";

export const metadata: Metadata = {
  title: {
    template: "%s | Mortis 文档",
    default: "Mortis 文档",
  },
  description:
    "Mortis 私人工作台文档，聚焦私有部署、单用户使用与运行维护。",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <RootProvider>
          <DocsLayout tree={source.pageTree} {...baseOptions}>
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
