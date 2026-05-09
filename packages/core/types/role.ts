export type RoleChannel = "web" | "internal_chat" | "qq" | "api" | "telegram";
export type RoleRiskLevel = "low" | "medium" | "high";

export interface RoleDefinition {
  id: string;
  workspace_id: string;
  name: string;
  title: string;
  description: string;
  responsibilities: string[];
  forbidden_actions: string[];
  permissions: string[];
  default_runtime: string;
  allowed_channels: RoleChannel[];
  approval_policy: string;
  system_prompt: string;
  built_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleListResponse {
  roles: RoleDefinition[];
  total: number;
}

export interface RoleRequest {
  name: string;
  title: string;
  description?: string;
  responsibilities?: string[];
  forbidden_actions?: string[];
  permissions?: string[];
  default_runtime?: string;
  allowed_channels?: RoleChannel[];
  approval_policy?: string;
  system_prompt?: string;
}

export interface RoleRouteMessageRequest {
  channel: RoleChannel;
  content: string;
  external_thread_key?: string;
  external_message_id?: string;
  metadata?: Record<string, unknown>;
}

export interface RoleRouteResult {
  role_id: string;
  role_name: string;
  role_title: string;
  command_type: string;
  risk_level: RoleRiskLevel;
  requires_approval: boolean;
  reason: string;
}

export interface RoleInvocation {
  id: string;
  workspace_id: string;
  role_id: string;
  role_name: string;
  role_title: string;
  message_id: string | null;
  channel: RoleChannel;
  status: "routed" | "queued" | "running" | "completed" | "failed" | "blocked";
  command_type: string;
  risk_level: RoleRiskLevel;
  requires_approval: boolean;
  result: RoleRouteResult;
  created_at: string;
  updated_at: string;
}

export interface RoleInvocationListResponse {
  invocations: RoleInvocation[];
  total: number;
}

export interface RoleRouteMessageResponse {
  route: RoleRouteResult;
  invocation: RoleInvocation;
  approval_id: string | null;
}
