import type { Metadata } from "next";
import { AboutPageClient } from "@/features/landing/components/about-page-client";

export const metadata: Metadata = {
  title: "关于 Mortis",
  description:
    "了解 Mortis——一个面向单一操作者与其 Agent 的私人指挥工作区。",
  openGraph: {
    title: "关于 Mortis",
    description:
      "Mortis 的来历，以及它为何被收口为私人指挥工作区。",
    url: "/about",
  },
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
