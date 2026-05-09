#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
TMP_DIR="${TMP_DIR:-$SERVER_DIR/.tmp}"
OUT_PATH="${OUT_PATH:-$TMP_DIR/multica-new}"
INSTALL_PATH="${INSTALL_PATH:-/usr/local/bin/multica}"
SERVICE_NAME="${SERVICE_NAME:-multica-daemon.service}"
GO_IMAGE="${GO_IMAGE:-golang:1.26.2}"
GOPROXY_VALUE="${GOPROXY:-https://goproxy.cn,direct}"
GOSUMDB_VALUE="${GOSUMDB:-off}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="${BACKUP_PATH:-$INSTALL_PATH.bak-$TIMESTAMP}"

build_with_local_go() {
  command -v go >/dev/null 2>&1 || return 1
  local goversion
  goversion="$(go env GOVERSION 2>/dev/null || true)"
  case "$goversion" in
    go1.26*) ;;
    *) return 1 ;;
  esac
  mkdir -p "$TMP_DIR"
  (cd "$SERVER_DIR" && go build -o "$OUT_PATH" ./cmd/multica)
}

build_with_docker() {
  command -v docker >/dev/null 2>&1 || {
    echo "docker is required when a suitable local go toolchain is unavailable" >&2
    return 1
  }

  local -a docker_cmd
  if docker info >/dev/null 2>&1; then
    docker_cmd=(docker)
  elif sudo -n docker info >/dev/null 2>&1; then
    docker_cmd=(sudo -n docker)
  else
    echo "docker is installed but not reachable; ensure the current user or sudo can access the Docker daemon" >&2
    return 1
  fi

  mkdir -p "$TMP_DIR"
  "${docker_cmd[@]}" run --rm --entrypoint /bin/sh \
    -e PATH=/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin \
    -e GOPROXY="$GOPROXY_VALUE" \
    -e GOSUMDB="$GOSUMDB_VALUE" \
    -v "$SERVER_DIR:/src" \
    -w /src \
    "$GO_IMAGE" \
    -c 'go version && go build -o /src/.tmp/multica-new ./cmd/multica'
}

service_exists=false
if systemctl list-unit-files "$SERVICE_NAME" --no-legend >/dev/null 2>&1; then
  service_exists=true
fi

echo "==> Building multica binary from $SERVER_DIR"
if build_with_local_go; then
  echo "==> Built with local go toolchain"
else
  echo "==> Falling back to Docker builder $GO_IMAGE"
  build_with_docker
fi

if [ ! -f "$OUT_PATH" ]; then
  echo "Expected built binary at $OUT_PATH" >&2
  exit 1
fi

echo "==> Backing up current binary to $BACKUP_PATH"
sudo install -m 755 "$INSTALL_PATH" "$BACKUP_PATH"

if [ "$service_exists" = true ]; then
  echo "==> Stopping $SERVICE_NAME before replacing binary"
  sudo systemctl stop "$SERVICE_NAME"
fi

echo "==> Installing new binary to $INSTALL_PATH"
sudo install -m 755 "$OUT_PATH" "$INSTALL_PATH"

if [ "$service_exists" = true ]; then
  echo "==> Restarting $SERVICE_NAME"
  sudo systemctl restart "$SERVICE_NAME"
  sleep 3
  sudo systemctl status "$SERVICE_NAME" --no-pager --lines=20
else
  echo "==> $SERVICE_NAME not found; skipped service restart"
fi

echo "==> Active binary"
ls -lh "$OUT_PATH"
ls -lh "$INSTALL_PATH"

echo "==> Backup binary"
ls -lh "$BACKUP_PATH"

echo "==> Daemon health"
multica daemon status --output json || true
