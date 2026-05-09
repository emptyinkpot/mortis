import type { Metadata } from "next";
import { ChangelogPageClient } from "@/features/landing/components/changelog-page-client";

export const metadata: Metadata = {
  title: "更新日志",
  description:
    "查看 Mortis 的最新功能、改进与修复。",
  openGraph: {
    title: "更新日志 | Mortis",
    description: "Mortis 的最新更新与发布记录。",
    url: "/changelog",
  },
  alternates: {
    canonical: "/changelog",
  },
};

export default function ChangelogPage() {
  return <ChangelogPageClient />;
}
