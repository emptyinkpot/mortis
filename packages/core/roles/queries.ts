import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const roleKeys = {
  all: (wsId: string) => ["roles", wsId] as const,
  list: (wsId: string) => [...roleKeys.all(wsId), "list"] as const,
  detail: (wsId: string, id: string) => [...roleKeys.all(wsId), "detail", id] as const,
  invocations: (wsId: string) => [...roleKeys.all(wsId), "invocations"] as const,
};

export function roleListOptions(wsId: string) {
  return queryOptions({
    queryKey: roleKeys.list(wsId),
    queryFn: () => api.listRoles(),
    select: (data) => data.roles,
  });
}

export function roleDetailOptions(wsId: string, id: string) {
  return queryOptions({
    queryKey: roleKeys.detail(wsId, id),
    queryFn: () => api.getRole(id),
  });
}

export function roleInvocationListOptions(wsId: string) {
  return queryOptions({
    queryKey: roleKeys.invocations(wsId),
    queryFn: () => api.listRoleInvocations(),
    select: (data) => data.invocations,
  });
}
