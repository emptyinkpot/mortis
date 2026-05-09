import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const controlPlaneKeys = {
  summary: () => ["control-plane", "summary"] as const,
};

export function controlPlaneSummaryOptions() {
  return queryOptions({
    queryKey: controlPlaneKeys.summary(),
    queryFn: () => api.getControlPlaneSummary(),
    staleTime: 15_000,
  });
}
