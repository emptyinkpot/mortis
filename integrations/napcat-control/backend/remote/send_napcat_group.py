#!/usr/bin/env python3
import argparse
import base64
import importlib.util
import sys
from pathlib import Path


NOTIFY_PATH = "/home/ubuntu/multica-public-watch/control/notify.py"
NOTIFY_ENV_PATH = "/home/ubuntu/multica-public-watch/control/notify.env"
ALLOWED_GROUP_ID = "689863409"
MAX_BODY_LENGTH = 600

SOURCE_CONFIG = {
    "mortis-ai": {
        "notify_source": "mortis-ai",
        "prefix": "[Mortis AI]",
    },
    "mortis-watch": {
        "notify_source": "mortis-watch",
        "prefix": "[Mortis Watch]",
    },
    "mortis-ops": {
        "notify_source": "mortis-ops",
        "prefix": "[Mortis Ops]",
    },
}

TEMPLATE_CONFIG = {
    "notify": "通知",
    "status": "状态",
    "alert": "告警",
}


def decode_b64(value: str) -> str:
    return base64.b64decode(value.encode("utf-8")).decode("utf-8")


def normalize_body(value: str) -> str:
    body = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    body = "\n".join(line.rstrip() for line in body.split("\n")).strip()
    if not body:
        raise SystemExit("body is empty")
    if len(body) > MAX_BODY_LENGTH:
        raise SystemExit(f"body exceeds {MAX_BODY_LENGTH} characters")
    return body


def render_message(template_key: str, source_tag: str, body: str) -> tuple[str, str]:
    source_config = SOURCE_CONFIG.get(source_tag)
    template_label = TEMPLATE_CONFIG.get(template_key)
    if source_config is None:
        raise SystemExit(f"source_tag is not allowed: {source_tag}")
    if template_label is None:
        raise SystemExit(f"template_key is not allowed: {template_key}")

    header = f"{source_config['prefix']}[{template_label}]"
    message = f"{header}\n来源标识：{source_tag}\n{body}"
    return source_config["notify_source"], message


def load_notify_module():
    notify_path = Path(NOTIFY_PATH)
    spec = importlib.util.spec_from_file_location("host_notify", notify_path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"unable to load notify module from {notify_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a constrained NapCat group message through host notify.py")
    parser.add_argument("--group-id", required=True)
    parser.add_argument("--template-key", required=True)
    parser.add_argument("--source-tag", required=True)
    parser.add_argument("--body-b64", required=True)
    args = parser.parse_args()

    group_id = args.group_id.strip()
    if group_id != ALLOWED_GROUP_ID:
        raise SystemExit(f"group_id is not allowed: {group_id}")

    body = normalize_body(decode_b64(args.body_b64))
    source, message = render_message(args.template_key.strip(), args.source_tag.strip(), body)
    notify = load_notify_module()
    config = notify.load_env_file(Path(NOTIFY_ENV_PATH))
    webui_url = str(config.get("NAPCAT_WEBUI_URL", "http://127.0.0.1:16099")).strip()
    webui_token = notify.load_napcat_webui_token(config)
    if not webui_token:
        raise SystemExit("NAPCAT webui token is missing")
    log_path = Path(config.get("NOTIFY_LOG_PATH", "/home/ubuntu/multica-public-watch/control/notify.log"))

    result = notify.run_napcat_via_webui(
        webui_url=webui_url,
        webui_token=webui_token,
        message_mode="group",
        user_id="",
        group_id=ALLOWED_GROUP_ID,
        text=message,
    )
    log_line = (
        f"[napcat-control] delivered group={ALLOWED_GROUP_ID} template={args.template_key.strip()} "
        f"source={args.source_tag.strip()}: {result}"
    )
    notify.append_log(log_path, log_line)
    sys.stdout.write(
        f"[napcat-control] group={ALLOWED_GROUP_ID} template={args.template_key.strip()} "
        f"source={args.source_tag.strip()}\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
