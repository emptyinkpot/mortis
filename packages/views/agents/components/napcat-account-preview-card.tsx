"use client";

import type { NapcatAccount } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { cn } from "@multica/ui/lib/utils";
import {
  formatNapcatAccountSummary,
  getNapcatAccountDisplayName,
  getNapcatAccountSlotLabel,
} from "../napcat";
import { NapcatAccountAvatar } from "./napcat-account-avatar";

function buildFallbackLabel(account: NapcatAccount): string {
  const displayName = getNapcatAccountDisplayName(account).trim();
  return displayName.charAt(0).toUpperCase() || "Q";
}

export function NapcatAccountPreviewCard({
  account,
  className,
}: {
  account: NapcatAccount;
  className?: string;
}) {
  const displayName = getNapcatAccountDisplayName(account);
  const slotLabel = getNapcatAccountSlotLabel(account);
  const summary = formatNapcatAccountSummary(account);
  const avatarFallback = (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
      {buildFallbackLabel(account)}
    </div>
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <NapcatAccountAvatar
          account={account}
          fallback={avatarFallback}
          className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
            {!account.enabled && <Badge variant="secondary">已停用</Badge>}
          </div>
          {slotLabel && <div className="mt-1 text-muted-foreground/90">槽位：{slotLabel}</div>}
          {summary && <div className="mt-1">{summary}</div>}
          {account.description && (
            <div className="mt-2 text-muted-foreground/90">{account.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}
