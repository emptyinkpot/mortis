#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Tuple


def truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_env_file(path: Path) -> Dict[str, str]:
    data: Dict[str, str] = {}
    if not path.exists():
        return data
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def load_json_file(path: Path) -> Any:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def append_log(log_path: Path, message: str) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(message + "\n")


def run_git(repo_path: str, *git_args: str) -> str:
    result = subprocess.run(
        ["git", "-C", repo_path, *git_args],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout.strip()


def post_json(url: str, payload: dict, headers: Dict[str, str] | None = None) -> str:
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=encoded, method="POST")
    request.add_header("Content-Type", "application/json; charset=utf-8")
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read().decode("utf-8", errors="replace")
        if response.status >= 400:
            raise RuntimeError(f"HTTP {response.status} when posting to {url}: {body}")
        return body

def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_napcat_webui_token(config: Dict[str, str]) -> str:
    direct_token = config.get("NAPCAT_WEBUI_TOKEN", "").strip()
    if direct_token:
        return direct_token

    config_path = Path(
        config.get("NAPCAT_WEBUI_CONFIG_PATH", "/home/ubuntu/napcat/data/config/webui.json")
    ).expanduser()
    raw = load_json_file(config_path)
    if isinstance(raw, dict):
        token = str(raw.get("token") or "").strip()
        if token:
            return token
    return ""


def login_napcat_webui(webui_url: str, webui_token: str) -> str:
    result = post_json(
        webui_url.rstrip("/") + "/api/auth/login",
        {"hash": sha256_hex(f"{webui_token}.napcat")},
    )
    try:
        parsed = json.loads(result)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"NapCat WebUI login returned non-JSON: {result}") from exc

    if parsed.get("code") != 0:
        raise RuntimeError(f"NapCat WebUI login failed: {result}")

    credential = str((parsed.get("data") or {}).get("Credential") or "").strip()
    if not credential:
        raise RuntimeError("NapCat WebUI login succeeded but Credential missing")
    return credential


def run_napcat_via_webui(
    *,
    webui_url: str,
    webui_token: str,
    message_mode: str,
    user_id: str,
    group_id: str,
    text: str,
) -> str:
    mode = message_mode.strip().lower()
    if mode not in {"private", "group"}:
        raise RuntimeError(f"unsupported NAPCAT_MESSAGE_MODE: {message_mode}")

    if mode == "group":
        action = "send_group_msg"
        target_value = group_id.strip()
        if not target_value:
            raise RuntimeError("NAPCAT_GROUP_ID missing for group mode")
        params = {"group_id": coerce_target_id(target_value), "message": text}
    else:
        action = "send_private_msg"
        target_value = user_id.strip()
        if not target_value:
            raise RuntimeError("NAPCAT_USER_ID missing for private mode")
        params = {"user_id": coerce_target_id(target_value), "message": text}

    credential = login_napcat_webui(webui_url, webui_token)
    result = post_json(
        webui_url.rstrip("/") + "/api/Debug/call/debug-primary",
        {"action": action, "params": params},
        headers={"Authorization": f'Bearer "{credential}"'},
    )
    try:
        parsed = json.loads(result)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"NapCat WebUI debug returned non-JSON: {result}") from exc

    if parsed.get("code") != 0:
        raise RuntimeError(f"NapCat WebUI debug failed: {result}")

    inner = parsed.get("data") or {}
    status = str(inner.get("status") or "").lower()
    retcode = inner.get("retcode")
    if status and status != "ok":
        raise RuntimeError(f"NapCat WebUI debug returned status={status}: {result}")
    if retcode not in (None, 0):
        raise RuntimeError(f"NapCat WebUI debug returned retcode={retcode}: {result}")
    return result


def build_text(title_prefix: str, repo_url: str, branch: str, source: str, host: str, sha: str, commit_message: str, changed_files: List[str]) -> str:
    lines = [
        f"{title_prefix} pushed {sha}",
        f"repo: {repo_url}",
        f"branch: {branch}",
        f"source: {source}",
        f"host: {host}",
        f"commit: {commit_message}",
        f"commit url: {repo_url}/commit/{sha}",
    ]
    if changed_files:
        lines.append("changed files:")
        preview = changed_files[:20]
        lines.extend(f"- {item}" for item in preview)
        if len(changed_files) > len(preview):
            lines.append(f"- ... and {len(changed_files) - len(preview)} more")
    return "\n".join(lines)


def normalize_qqbot_target(target: str) -> str:
    value = target.strip()
    if not value:
        return ""
    lowered = value.lower()
    if lowered.startswith("qqbot:"):
        return value
    if lowered.startswith(("c2c:", "group:", "channel:")):
        return f"qqbot:{value}"
    if re.fullmatch(r"[0-9a-fA-F]{32}", value):
        return f"qqbot:c2c:{value}"
    if re.fullmatch(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", value):
        return f"qqbot:c2c:{value}"
    return value


def known_user_sort_key(item: Dict[str, Any]) -> Tuple[str, str]:
    last_seen = str(item.get("lastSeenAt") or "")
    first_seen = str(item.get("firstSeenAt") or "")
    return (last_seen, first_seen)


def read_known_users(path: Path) -> List[Dict[str, Any]]:
    raw = load_json_file(path)
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if isinstance(raw, dict):
        users = raw.get("users")
        if isinstance(users, list):
            return [item for item in users if isinstance(item, dict)]
    return []


def resolve_qqbot_target(config: Dict[str, str], log_path: Path) -> Tuple[str, str]:
    configured_account = config.get("QQBOT_ACCOUNT", "").strip()
    explicit_target = normalize_qqbot_target(config.get("QQBOT_TARGET", ""))
    if explicit_target:
        return explicit_target, configured_account

    mode = config.get("QQBOT_TARGET_MODE", "").strip().lower()
    if mode not in {"latest_c2c", "latest_group"}:
        return "", configured_account

    known_users_path = Path(
        config.get("QQBOT_KNOWN_USERS_PATH", "~/.openclaw/qqbot/data/known-users.json")
    ).expanduser()
    users = read_known_users(known_users_path)
    if not users:
        append_log(log_path, f"[notify] qqbot skipped: known users file empty or missing: {known_users_path}")
        return "", configured_account

    wanted_type = "c2c" if mode == "latest_c2c" else "group"
    candidates = [
        item for item in users if str(item.get("type") or "").strip().lower() == wanted_type
    ]
    if not candidates:
        append_log(log_path, f"[notify] qqbot skipped: no known users matched mode={mode}")
        return "", configured_account

    latest = max(candidates, key=known_user_sort_key)
    account_id = str(latest.get("accountId") or configured_account).strip()
    if wanted_type == "group":
        group_openid = str(latest.get("groupOpenid") or latest.get("openid") or "").strip()
        if not group_openid:
            append_log(log_path, "[notify] qqbot skipped: latest_group entry missing groupOpenid/openid")
            return "", account_id
        target = f"qqbot:group:{group_openid}"
    else:
        openid = str(latest.get("openid") or "").strip()
        if not openid:
            append_log(log_path, "[notify] qqbot skipped: latest_c2c entry missing openid")
            return "", account_id
        target = f"qqbot:c2c:{openid}"

    append_log(log_path, f"[notify] qqbot target resolved via {mode}: {target} (account={account_id or 'default'})")
    return target, account_id


def coerce_target_id(value: str) -> int | str:
    stripped = value.strip()
    if re.fullmatch(r"\d+", stripped):
        return int(stripped)
    return stripped


def run_napcat_onebot(
    *,
    api_url: str,
    access_token: str,
    message_mode: str,
    user_id: str,
    group_id: str,
    text: str,
) -> str:
    mode = message_mode.strip().lower()
    if mode not in {"private", "group"}:
        raise RuntimeError(f"unsupported NAPCAT_MESSAGE_MODE: {message_mode}")

    headers: Dict[str, str] = {}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    if mode == "group":
        endpoint = "/send_group_msg"
        target_value = group_id.strip()
        if not target_value:
            raise RuntimeError("NAPCAT_GROUP_ID missing for group mode")
        payload = {"group_id": coerce_target_id(target_value), "message": text}
    else:
        endpoint = "/send_private_msg"
        target_value = user_id.strip()
        if not target_value:
            raise RuntimeError("NAPCAT_USER_ID missing for private mode")
        payload = {"user_id": coerce_target_id(target_value), "message": text}

    result = post_json(api_url.rstrip("/") + endpoint, payload, headers=headers)
    try:
        parsed = json.loads(result)
    except json.JSONDecodeError:
        return result

    status = str(parsed.get("status") or "").lower()
    retcode = parsed.get("retcode")
    if status and status != "ok":
        raise RuntimeError(f"NapCat returned status={status}: {result}")
    if retcode not in (None, 0):
        raise RuntimeError(f"NapCat returned retcode={retcode}: {result}")
    return result


def run_openclaw_qqbot(
    *,
    openclaw_bin: str,
    app_id: str,
    client_secret: str,
    account_id: str,
    target: str,
    text: str,
    dry_run: bool,
) -> str:
    env = os.environ.copy()
    env["QQBOT_APP_ID"] = app_id
    env["QQBOT_CLIENT_SECRET"] = client_secret
    command = [
        openclaw_bin,
        "message",
        "send",
        "--channel",
        "qqbot",
        "--target",
        target,
        "--message",
        text,
        "--json",
    ]
    if account_id and account_id != "default":
        command.extend(["--account", account_id])
    if dry_run:
        command.append("--dry-run")
    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )
    output = result.stdout.strip() or result.stderr.strip()
    return output or "{}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Notify after Mortis public mirror pushes")
    parser.add_argument("--repo-path", required=True)
    parser.add_argument("--repo-url", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--branch", default="main")
    parser.add_argument("--sha")
    parser.add_argument("--commit-message")
    parser.add_argument("--test-message")
    args = parser.parse_args()

    control_dir = Path(args.repo_path).resolve().parent / "control"
    config_path = control_dir / "notify.env"
    log_path = control_dir / "notify.log"
    config = load_env_file(config_path)
    for key in [
        "NOTIFY_ENABLED",
        "NOTIFY_DRY_RUN",
        "NOTIFY_CHANNELS",
        "NOTIFY_TITLE_PREFIX",
        "NOTIFY_HOSTNAME",
        "NOTIFY_WEBHOOK_URL",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "FEISHU_WEBHOOK_URL",
        "RESEND_API_KEY",
        "RESEND_TO_EMAIL",
        "RESEND_FROM_EMAIL",
        "QQBOT_APP_ID",
        "QQBOT_CLIENT_SECRET",
        "QQBOT_TARGET",
        "QQBOT_TARGET_MODE",
        "QQBOT_KNOWN_USERS_PATH",
        "QQBOT_ACCOUNT",
        "OPENCLAW_BIN",
        "NAPCAT_API_URL",
        "NAPCAT_ACCESS_TOKEN",
        "NAPCAT_MESSAGE_MODE",
        "NAPCAT_USER_ID",
        "NAPCAT_GROUP_ID",
        "NAPCAT_TRANSPORT",
        "NAPCAT_WEBUI_URL",
        "NAPCAT_WEBUI_TOKEN",
        "NAPCAT_WEBUI_CONFIG_PATH",
    ]:
        value = os.getenv(key)
        if value is not None:
            config[key] = value

    enabled = truthy(config.get("NOTIFY_ENABLED", "0"))
    if not enabled:
        append_log(log_path, "[notify] notifications disabled; skip")
        return 0

    dry_run = truthy(config.get("NOTIFY_DRY_RUN", "0"))
    title_prefix = config.get("NOTIFY_TITLE_PREFIX", "[Mortis Public Watch]")
    host = config.get("NOTIFY_HOSTNAME") or os.uname().nodename
    channels = [item.strip().lower() for item in config.get("NOTIFY_CHANNELS", "webhook").split(",") if item.strip()]

    sha = args.sha or run_git(args.repo_path, "rev-parse", "--short", "HEAD")
    commit_message = args.commit_message or run_git(args.repo_path, "show", "-s", "--format=%s", sha)
    changed_files: List[str] = []
    if args.test_message:
        commit_message = args.test_message
    else:
        changed_output = run_git(args.repo_path, "show", "--pretty=", "--name-only", sha)
        changed_files = [line for line in changed_output.splitlines() if line.strip()]

    text = build_text(title_prefix, args.repo_url, args.branch, args.source, host, sha, commit_message, changed_files)
    subject = f"{title_prefix} {sha}"
    payload = {
        "title": subject,
        "text": text,
        "repo_url": args.repo_url,
        "branch": args.branch,
        "source": args.source,
        "host": host,
        "commit_sha": sha,
        "commit_message": commit_message,
        "commit_url": f"{args.repo_url}/commit/{sha}",
        "changed_files": changed_files,
    }

    attempted = 0
    succeeded = 0

    def maybe_send(name: str, func) -> None:
        nonlocal attempted, succeeded
        attempted += 1
        if dry_run:
            append_log(log_path, f"[notify] DRY_RUN {name}: {json.dumps(payload, ensure_ascii=False)}")
            succeeded += 1
            return
        func()
        append_log(log_path, f"[notify] delivered via {name}: {sha}")
        succeeded += 1

    for channel in channels:
        try:
            if channel == "webhook":
                url = config.get("NOTIFY_WEBHOOK_URL", "")
                if not url:
                    if dry_run:
                        maybe_send("webhook", lambda: None)
                    else:
                        append_log(log_path, "[notify] webhook skipped: NOTIFY_WEBHOOK_URL missing")
                    continue
                maybe_send("webhook", lambda url=url: post_json(url, payload))
            elif channel == "telegram":
                token = config.get("TELEGRAM_BOT_TOKEN", "")
                chat_id = config.get("TELEGRAM_CHAT_ID", "")
                if not token or not chat_id:
                    if dry_run:
                        maybe_send("telegram", lambda: None)
                    else:
                        append_log(log_path, "[notify] telegram skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing")
                    continue
                maybe_send(
                    "telegram",
                    lambda token=token, chat_id=chat_id: post_json(
                        f"https://api.telegram.org/bot{token}/sendMessage",
                        {"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
                    ),
                )
            elif channel == "feishu":
                url = config.get("FEISHU_WEBHOOK_URL", "")
                if not url:
                    if dry_run:
                        maybe_send("feishu", lambda: None)
                    else:
                        append_log(log_path, "[notify] feishu skipped: FEISHU_WEBHOOK_URL missing")
                    continue
                maybe_send(
                    "feishu",
                    lambda url=url: post_json(url, {"msg_type": "text", "content": {"text": text}}),
                )
            elif channel == "email":
                api_key = config.get("RESEND_API_KEY", "")
                to_email = config.get("RESEND_TO_EMAIL", "")
                from_email = config.get("RESEND_FROM_EMAIL", "")
                if not api_key or not to_email or not from_email:
                    if dry_run:
                        maybe_send("email", lambda: None)
                    else:
                        append_log(log_path, "[notify] email skipped: RESEND_* values missing")
                    continue
                maybe_send(
                    "email",
                    lambda api_key=api_key, to_email=to_email, from_email=from_email: post_json(
                        "https://api.resend.com/emails",
                        {
                            "from": from_email,
                            "to": [to_email],
                            "subject": subject,
                            "text": text,
                        },
                        headers={"Authorization": f"Bearer {api_key}"},
                    ),
                )
            elif channel == "qqbot":
                app_id = config.get("QQBOT_APP_ID", "").strip()
                client_secret = config.get("QQBOT_CLIENT_SECRET", "").strip()
                target, resolved_account = resolve_qqbot_target(config, log_path)
                account_id = config.get("QQBOT_ACCOUNT", "").strip() or resolved_account or "default"
                openclaw_bin = config.get("OPENCLAW_BIN", "openclaw").strip() or "openclaw"
                if not app_id or not client_secret:
                    append_log(log_path, "[notify] qqbot skipped: QQBOT_APP_ID or QQBOT_CLIENT_SECRET missing")
                    continue
                if not target:
                    append_log(log_path, "[notify] qqbot skipped: target unresolved")
                    continue
                attempted += 1
                result = run_openclaw_qqbot(
                    openclaw_bin=openclaw_bin,
                    app_id=app_id,
                    client_secret=client_secret,
                    account_id=account_id,
                    target=target,
                    text=text,
                    dry_run=dry_run,
                )
                mode_label = "DRY_RUN" if dry_run else "delivered"
                append_log(
                    log_path,
                    f"[notify] {mode_label} qqbot target={target} account={account_id}: {result}",
                )
                succeeded += 1
            elif channel == "napcat":
                api_url = config.get("NAPCAT_API_URL", "http://127.0.0.1:3600").strip() or "http://127.0.0.1:3600"
                access_token = config.get("NAPCAT_ACCESS_TOKEN", "").strip()
                message_mode = config.get("NAPCAT_MESSAGE_MODE", "private").strip() or "private"
                user_id = config.get("NAPCAT_USER_ID", "").strip()
                group_id = config.get("NAPCAT_GROUP_ID", "").strip()
                transport = config.get("NAPCAT_TRANSPORT", "auto").strip().lower() or "auto"
                webui_url = config.get("NAPCAT_WEBUI_URL", "http://127.0.0.1:16099").strip() or "http://127.0.0.1:16099"
                webui_token = load_napcat_webui_token(config)
                attempted += 1
                mode_value = message_mode.lower()
                target_value = group_id if mode_value == "group" else user_id
                if dry_run:
                    append_log(
                        log_path,
                        f"[notify] DRY_RUN napcat transport={transport} api={api_url} webui={webui_url} mode={message_mode} target={target_value}: {json.dumps(payload, ensure_ascii=False)}",
                    )
                    succeeded += 1
                    continue

                last_error: Exception | None = None
                if transport in {"auto", "onebot"}:
                    try:
                        result = run_napcat_onebot(
                            api_url=api_url,
                            access_token=access_token,
                            message_mode=message_mode,
                            user_id=user_id,
                            group_id=group_id,
                            text=text,
                        )
                        append_log(
                            log_path,
                            f"[notify] delivered via napcat-onebot api={api_url} mode={message_mode}: {result}",
                        )
                        succeeded += 1
                        continue
                    except Exception as exc:
                        last_error = exc
                        append_log(log_path, f"[notify] napcat onebot failed: {exc}")
                        if transport == "onebot":
                            raise

                if transport in {"auto", "webui"}:
                    if not webui_token:
                        raise RuntimeError(
                            "NAPCAT_WEBUI_TOKEN missing and NAPCAT_WEBUI_CONFIG_PATH did not yield a token"
                        ) from last_error
                    result = run_napcat_via_webui(
                        webui_url=webui_url,
                        webui_token=webui_token,
                        message_mode=message_mode,
                        user_id=user_id,
                        group_id=group_id,
                        text=text,
                    )
                    append_log(
                        log_path,
                        f"[notify] delivered via napcat-webui webui={webui_url} mode={message_mode}: {result}",
                    )
                    succeeded += 1
                    continue

                raise RuntimeError(f"unsupported NAPCAT_TRANSPORT: {transport}") from last_error
            else:
                append_log(log_path, f"[notify] unknown channel skipped: {channel}")
        except Exception as exc:
            append_log(log_path, f"[notify] {channel} failed: {exc}")

    if attempted == 0:
        append_log(log_path, "[notify] no channels attempted")
        return 0

    return 0 if succeeded > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
