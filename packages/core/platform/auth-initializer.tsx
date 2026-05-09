"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApi } from "../api";
import { useAuthStore } from "../auth";
import { configStore } from "../config";
import { workspaceKeys } from "../workspace/queries";
import { createLogger } from "../logger";
import { defaultStorage } from "./storage";
import { setCurrentWorkspace } from "./workspace-storage";
import type { StorageAdapter } from "../types/storage";
import type { User, Workspace } from "../types";

const logger = createLogger("auth");
const singleUserMode = Boolean(process.env.NEXT_PUBLIC_AUTO_LOGIN_WORKSPACE_SLUG);

export function AuthInitializer({
  children,
  onLogin,
  onLogout,
  storage = defaultStorage,
  cookieAuth,
}: {
  children: ReactNode;
  onLogin?: () => void;
  onLogout?: () => void;
  storage?: StorageAdapter;
  cookieAuth?: boolean;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    const api = getApi();
    const finishLogin = (user: User, wsList: Workspace[]) => {
      onLogin?.();
      useAuthStore.setState({ user, isLoading: false });
      qc.setQueryData(workspaceKeys.list(), wsList);
    };

    const initWithUser = async () => {
      const user = await api.getMe();
      const currentWorkspace =
        singleUserMode && user.current_workspace ? user.current_workspace : null;

      if (currentWorkspace) {
        finishLogin(user, [currentWorkspace]);
        return;
      }

      const wsList = await api.listWorkspaces();
      finishLogin(user, wsList);
    };

    // Fetch app config (CDN domain, etc.) in the background — non-blocking.
    api.getConfig().then((cfg) => {
      if (cfg.cdn_domain) configStore.getState().setCdnDomain(cfg.cdn_domain);
    }).catch(() => { /* config is optional — legacy file card matching degrades gracefully */ });

    if (cookieAuth) {
      // Cookie mode: the HttpOnly cookie is sent automatically by the browser.
      // Call the API to check if the session is still valid.
      //
      // Seed the workspace list into React Query so the URL-driven layout can
      // resolve the slug without a second fetch. The active workspace itself
      // is derived from the URL by [workspaceSlug]/layout.tsx — no imperative
      // selection here.
      initWithUser()
        .catch((err) => {
          logger.error("cookie auth init failed", err);
          onLogout?.();
          useAuthStore.setState({ user: null, isLoading: false });
        });
      return;
    }

    // Token mode: read from localStorage (Electron / legacy).
    const token = storage.getItem("multica_token");
    if (!token) {
      onLogout?.();
      useAuthStore.setState({ isLoading: false });
      return;
    }

    api.setToken(token);

    initWithUser()
      .catch((err) => {
        logger.error("auth init failed", err);
        api.setToken(null);
        setCurrentWorkspace(null, null);
        storage.removeItem("multica_token");
        onLogout?.();
        useAuthStore.setState({ user: null, isLoading: false });
      });
  }, []);

  return <>{children}</>;
}
