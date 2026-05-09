import type { IssueStatus } from "../../types";

export const STATUS_ORDER: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
];

export const ALL_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
];

/** Statuses shown as board columns (excludes cancelled). */
export const BOARD_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
];

export const STATUS_CONFIG: Record<
  IssueStatus,
  {
    label: string;
    iconColor: string;
    hoverBg: string;
    dividerColor: string;
    badgeBg: string;
    badgeText: string;
    columnBg: string;
  }
> = {
  backlog: { label: "待整理", iconColor: "text-muted-foreground", hoverBg: "hover:bg-accent", dividerColor: "bg-muted-foreground/40", badgeBg: "bg-muted", badgeText: "text-muted-foreground", columnBg: "bg-muted/40" },
  todo: { label: "待办", iconColor: "text-muted-foreground", hoverBg: "hover:bg-accent", dividerColor: "bg-muted-foreground/40", badgeBg: "bg-muted", badgeText: "text-muted-foreground", columnBg: "bg-muted/40" },
  in_progress: { label: "进行中", iconColor: "text-warning", hoverBg: "hover:bg-warning/10", dividerColor: "bg-warning", badgeBg: "bg-warning", badgeText: "text-white", columnBg: "bg-warning/5" },
  in_review: { label: "待审核", iconColor: "text-success", hoverBg: "hover:bg-success/10", dividerColor: "bg-success", badgeBg: "bg-success", badgeText: "text-white", columnBg: "bg-success/5" },
  done: { label: "已完成", iconColor: "text-info", hoverBg: "hover:bg-info/10", dividerColor: "bg-info", badgeBg: "bg-info", badgeText: "text-white", columnBg: "bg-info/5" },
  blocked: { label: "已阻塞", iconColor: "text-destructive", hoverBg: "hover:bg-destructive/10", dividerColor: "bg-destructive", badgeBg: "bg-destructive", badgeText: "text-white", columnBg: "bg-destructive/5" },
  cancelled: { label: "已取消", iconColor: "text-muted-foreground", hoverBg: "hover:bg-accent", dividerColor: "bg-muted-foreground/40", badgeBg: "bg-muted", badgeText: "text-muted-foreground", columnBg: "bg-muted/40" },
};
