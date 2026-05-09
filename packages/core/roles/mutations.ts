import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useWorkspaceId } from "../hooks";
import type {
  RoleDefinition,
  RoleInvocationListResponse,
  RoleListResponse,
  RoleRequest,
  RoleRouteMessageRequest,
} from "../types/role";
import { roleKeys } from "./queries";

export function useCreateRole() {
  const wsId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: RoleRequest) => api.createRole(data),
    onSuccess: (role) => {
      qc.setQueryData<RoleListResponse>(roleKeys.list(wsId), (old) =>
        old
          ? { roles: [...old.roles, role], total: old.total + 1 }
          : { roles: [role], total: 1 },
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: roleKeys.list(wsId) });
    },
  });
}

export function useUpdateRole() {
  const wsId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoleRequest }) =>
      api.updateRole(id, data),
    onSuccess: (role: RoleDefinition) => {
      qc.setQueryData<RoleListResponse>(roleKeys.list(wsId), (old) =>
        old
          ? {
              ...old,
              roles: old.roles.map((item) => (item.id === role.id ? role : item)),
            }
          : old,
      );
      qc.setQueryData(roleKeys.detail(wsId, role.id), role);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: roleKeys.list(wsId) });
    },
  });
}

export function useRouteRoleMessage() {
  const wsId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: RoleRouteMessageRequest) => api.routeRoleMessage(data),
    onSuccess: (result) => {
      qc.setQueryData<RoleInvocationListResponse>(roleKeys.invocations(wsId), (old) =>
        old
          ? {
              invocations: [result.invocation, ...old.invocations],
              total: old.total + 1,
            }
          : { invocations: [result.invocation], total: 1 },
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: roleKeys.invocations(wsId) });
    },
  });
}
