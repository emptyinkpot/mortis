import type { AgentStatus } from "@multica/core/types";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
} from "lucide-react";

export const statusConfig: Record<AgentStatus, { label: string; color: string; dot: string }> = {
  idle: { label: "空闲", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  working: { label: "工作中", color: "text-success", dot: "bg-success" },
  blocked: { label: "阻塞", color: "text-warning", dot: "bg-warning" },
  error: { label: "错误", color: "text-destructive", dot: "bg-destructive" },
  offline: { label: "离线", color: "text-muted-foreground/50", dot: "bg-muted-foreground/40" },
};

export const taskStatusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  queued: { label: "排队中", icon: Clock, color: "text-muted-foreground" },
  dispatched: { label: "已派发", icon: Play, color: "text-info" },
  running: { label: "运行中", icon: Loader2, color: "text-success" },
  completed: { label: "已完成", icon: CheckCircle2, color: "text-success" },
  failed: { label: "失败", icon: XCircle, color: "text-destructive" },
  cancelled: { label: "已取消", icon: XCircle, color: "text-muted-foreground" },
};
