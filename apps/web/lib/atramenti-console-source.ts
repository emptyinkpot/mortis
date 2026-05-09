const DEFAULT_ATRAMENTI_CONSOLE_BASE_URL = "https://console.tengokukk.com";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePath(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

export function getAtramentiConsoleBaseUrl() {
  const raw = process.env.ATRAMENTI_CONSOLE_BASE_URL || DEFAULT_ATRAMENTI_CONSOLE_BASE_URL;
  return trimTrailingSlash(raw);
}

async function fetchAtramentiJson<T>(pathname: string): Promise<T> {
  const url = `${getAtramentiConsoleBaseUrl()}${normalizePath(pathname)}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let message = `Atramenti request failed: ${response.status}`;
    try {
      const payload = await response.json() as { error?: string };
      if (typeof payload?.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch {
      // Ignore JSON parse errors and keep fallback message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

type AtramentiApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

export async function loadAtramentiSystemOverview<T>() {
  const payload = await fetchAtramentiJson<AtramentiApiEnvelope<T>>("/api/system-overview/summary");
  if (!payload?.data) {
    throw new Error(payload?.error || "Atramenti system overview payload is missing data");
  }
  return payload.data;
}

export async function loadAtramentiNovelDashboard<T>() {
  const payload = await fetchAtramentiJson<AtramentiApiEnvelope<T>>("/api/novel/dashboard-snapshot");
  if (!payload?.data) {
    throw new Error(payload?.error || "Atramenti novel dashboard payload is missing data");
  }
  return payload.data;
}
