import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="font-semibold text-base">Mortis 文档</span>
    ),
  },
  links: [
    {
      text: "主站",
      url: "https://mortis.tengokukk.com",
    },
    {
      text: "关于",
      url: "https://mortis.tengokukk.com/about",
    },
  ],
};
