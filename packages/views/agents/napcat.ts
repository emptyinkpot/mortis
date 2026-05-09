"use client";

import type { Agent, NapcatAccount } from "@multica/core/types";

export const NAPCAT_ACCOUNT_ENV_KEY = "MORTIS_NAPCAT_ACCOUNT_KEY";

function trimNapcatValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function resolveNapcatAccountKey(
  customEnv: Record<string, string>,
  accounts: NapcatAccount[],
): string {
  const explicitKey = customEnv[NAPCAT_ACCOUNT_ENV_KEY]?.trim();
  if (explicitKey) {
    return explicitKey;
  }

  return (
    accounts.find((account) =>
      Object.entries(account.env ?? {}).every(([key, value]) => customEnv[key] === value),
    )?.key ?? ""
  );
}

export function resolveBoundNapcatAccount(
  agent: Agent,
  accounts: NapcatAccount[],
): NapcatAccount | null {
  const accountKey = resolveNapcatAccountKey(agent.custom_env ?? {}, accounts);
  if (!accountKey) {
    return null;
  }

  return accounts.find((account) => account.key === accountKey) ?? null;
}

export function buildNapcatQqAvatarUrl(qqUin: string | null | undefined): string | null {
  const value = trimNapcatValue(qqUin);
  if (!value) {
    return null;
  }

  return `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(value)}&s=100`;
}

export function getNapcatAccountDisplayName(account: NapcatAccount): string {
  return trimNapcatValue(account.qq_name) || trimNapcatValue(account.label) || account.key;
}

export function getNapcatAccountSlotLabel(account: NapcatAccount): string {
  const label = trimNapcatValue(account.label);
  if (!label || label === getNapcatAccountDisplayName(account)) {
    return "";
  }

  return label;
}

export function formatNapcatAccountAvatarLabel(account: NapcatAccount): string {
  const parts = [getNapcatAccountDisplayName(account)];
  const qqUin = trimNapcatValue(account.qq_uin);
  if (qqUin) {
    parts.push(`QQ ${qqUin}`);
  }

  return parts.join(" · ");
}

export function formatNapcatAccountOptionLabel(account: NapcatAccount): string {
  const slotLabel = getNapcatAccountSlotLabel(account);
  const qqUin = trimNapcatValue(account.qq_uin);
  const parts = [getNapcatAccountDisplayName(account)];
  if (slotLabel) {
    parts.push(slotLabel);
  }

  const label = parts.join(" · ");
  return qqUin ? `${label} (${qqUin})` : label;
}

export function formatNapcatAccountSummary(account: NapcatAccount): string {
  const parts = [
    account.qq_name ? `名称 ${getNapcatAccountDisplayName(account)}` : "",
    trimNapcatValue(account.qq_uin) ? `QQ ${trimNapcatValue(account.qq_uin)}` : "",
    trimNapcatValue(account.env.NAPCAT_API_URL) ? `HTTP ${trimNapcatValue(account.env.NAPCAT_API_URL)}` : "",
    trimNapcatValue(account.env.NAPCAT_WEBUI_URL) ? `WebUI ${trimNapcatValue(account.env.NAPCAT_WEBUI_URL)}` : "",
  ].filter(Boolean);

  return parts.join(" · ");
}

export function formatNapcatBinding(account: NapcatAccount | null): string {
  if (!account) {
    return "未绑定 QQ";
  }

  const parts = [getNapcatAccountDisplayName(account)];
  const slotLabel = getNapcatAccountSlotLabel(account);
  if (slotLabel) {
    parts.push(slotLabel);
  }
  const qqUin = trimNapcatValue(account.qq_uin);
  if (qqUin) {
    parts.push(qqUin);
  }

  return `绑定：${parts.join(" · ")}`;
}
