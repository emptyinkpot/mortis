import type { Metadata } from "next";
import { MulticaLanding } from "@/features/landing/components/multica-landing";

export const metadata: Metadata = {
  title: "首页",
  description:
    "Mortis 是一个面向单一操作者与其 Agent 的私人指挥工作区。",
  openGraph: {
    title: "Mortis —— 私人指挥工作区",
    description: "面向单一操作者与其 Agent 的私人指挥工作区。",
    url: "/homepage",
  },
  alternates: {
    canonical: "/homepage",
  },
};

export default function HomepagePage() {
  return <MulticaLanding />;
}
