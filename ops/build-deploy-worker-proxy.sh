#!/usr/bin/env bash
set -euo pipefail

source_commit="ea665308baaff015b226f308438a68d929d0f29b"
image_name="pentagi-local:2.1.0-cn-hotfix.6-task-egress"
build_dir="/opt/pentagi-build-task-egress-$(date -u +%Y%m%dT%H%M%SZ)"
overlay_dir="/tmp/pentagi-overlay-20260915"

mkdir -p "$build_dir"
git clone --quiet --filter=blob:none https://github.com/vxcontrol/pentagi.git "$build_dir/source"
git -C "$build_dir/source" checkout --quiet "$source_commit"
cat "$overlay_dir"/overlay-v2.part.* > "$build_dir/backend-overlay.tgz"
tar -xzf "$build_dir/backend-overlay.tgz" -C "$build_dir/source"
# Archives produced on macOS may contain AppleDouble sidecars. Migration files
# are embedded at compile time, so these metadata entries must never reach the
# Go build or they are parsed as migrations at application startup.
find "$build_dir/source" -type f -name '._*' -delete

docker run --rm \
  --network pentagi-egress \
  -e HTTP_PROXY=http://172.29.0.1:7890 \
  -e HTTPS_PROXY=http://172.29.0.1:7890 \
  -e ALL_PROXY=http://172.29.0.1:7890 \
  -v "$build_dir/source/backend:/src" \
  -v pentagi-go-mod-cache:/go/pkg/mod \
  -w /src \
  golang:1.26-bookworm \
  sh -lc '
    set -e
    export PATH="/usr/local/go/bin:$PATH"
    go test ./pkg/config ./pkg/docker ./pkg/tools
    mkdir -p .build
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath \
      -ldflags "-X pentagi/pkg/version.PackageName=pentagi -X pentagi/pkg/version.PackageVer=2.1.0-cn-hotfix.6-task-egress -X pentagi/pkg/version.PackageRev=ea665308baaff015b226f308438a68d929d0f29b" \
      -o .build/pentagi ./cmd/pentagi
  '

mkdir -p "$build_dir/image"
cp "$build_dir/source/backend/.build/pentagi" "$build_dir/image/pentagi"
printf 'FROM %s\nCOPY --chown=pentagi:pentagi pentagi /opt/pentagi/bin/pentagi\n' \
  "$(grep '^PENTAGI_IMAGE=' /opt/pentagi/.env | tail -n1 | cut -d= -f2-)" \
  > "$build_dir/image/Dockerfile"
docker build --quiet -t "$image_name" "$build_dir/image" >/dev/null

cd /opt/pentagi
if ! grep -q 'WORKER_PROXY_URL=' docker-compose.yml; then
  sed -i '/DOCKER_DEFAULT_IMAGE_FOR_PENTEST=${DOCKER_DEFAULT_IMAGE_FOR_PENTEST:-}/a\      - WORKER_PROXY_URL=${WORKER_PROXY_URL:-}' docker-compose.yml
fi

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${value}#" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

set_env WORKER_PROXY_URL "http://172.29.0.1:7890"
set_env PENTAGI_IMAGE "$image_name"

docker compose config --quiet
docker compose up -d pentagi

for _ in $(seq 1 30); do
  if curl -ksSf --connect-timeout 3 --max-time 5 https://127.0.0.1:8443/ >/dev/null; then
    break
  fi
  sleep 2
done

docker inspect pentagi --format '{{.Config.Image}}|{{.State.Status}}'
docker inspect pentagi --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^WORKER_PROXY_URL='
curl -ksS -o /dev/null -w 'health=%{http_code}|%{time_total}\n' --connect-timeout 5 --max-time 10 https://127.0.0.1:8443/
