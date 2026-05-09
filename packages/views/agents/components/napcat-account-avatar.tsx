"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { NapcatAccount } from "@multica/core/types";
import {
  buildNapcatQqAvatarUrl,
  formatNapcatAccountAvatarLabel,
} from "../napcat";

export function NapcatAccountAvatar({
  account,
  fallback,
  className,
}: {
  account: NapcatAccount | null;
  fallback: ReactNode;
  className?: string;
}) {
  const [qqAvatarFailed, setQqAvatarFailed] = useState(false);
  const qqAvatarUrl = useMemo(
    () => buildNapcatQqAvatarUrl(account?.qq_uin),
    [account?.qq_uin],
  );

  useEffect(() => {
    setQqAvatarFailed(false);
  }, [qqAvatarUrl]);

  if (!account || !qqAvatarUrl || qqAvatarFailed) {
    return <>{fallback}</>;
  }

  return (
    <div className={className} title={formatNapcatAccountAvatarLabel(account)}>
      <img
        src={qqAvatarUrl}
        alt={formatNapcatAccountAvatarLabel(account)}
        className="h-full w-full object-cover"
        onError={() => setQqAvatarFailed(true)}
      />
    </div>
  );
}
