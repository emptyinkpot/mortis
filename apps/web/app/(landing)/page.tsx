import type { Metadata } from "next";
import { MulticaLanding } from "@/features/landing/components/multica-landing";
import { RedirectIfAuthenticated } from "@/features/landing/components/redirect-if-authenticated";

export const metadata: Metadata = {
  title: {
    absolute: "Mortis —— 私人指挥工作区",
  },
  description:
    "Mortis 是一个面向单一操作者与其 Agent 的私人指挥工作区。",
  openGraph: {
    title: "Mortis —— 私人指挥工作区",
    description: "面向单一操作者与其 Agent 的私人指挥工作区。",
    url: "/",
  },
  alternates: {
    canonical: "/",
  },
};

export default function LandingPage() {
  return (
    <>
      <RedirectIfAuthenticated />
      <MulticaLanding />
    </>
  );
}
