#!/usr/bin/env bash
set -euo pipefail

cd /opt/pentagi
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
cp -a docker-compose.yml "docker-compose.yml.backup-egress-$stamp"
cp -a .env ".env.backup-egress-$stamp"

if ! grep -q '^  pentagi-egress:' docker-compose.yml; then
  sed -i "/^  observability-network:/i\\  pentagi-egress:\\n    external: true\\n    name: \${PENTAGI_EGRESS_NETWORK:-pentagi-egress}" docker-compose.yml
fi

perl -0777 -i -pe '
  s{(  scraper:\n.*?\n    networks:\n)      - pentagi-network\n}
   {$1      pentagi-network: {}\n      pentagi-egress:\n        gw_priority: 1\n}s
' docker-compose.yml

if ! grep -q 'SCRAPER_DEFAULT_LAUNCH_ARGS=' docker-compose.yml; then
  sed -i '/PASSWORD=${LOCAL_SCRAPER_PASSWORD:-somepass}/a\      - HTTP_PROXY=${WORKER_PROXY_URL:-}\n      - HTTPS_PROXY=${WORKER_PROXY_URL:-}\n      - ALL_PROXY=${WORKER_PROXY_URL:-}\n      - NO_PROXY=localhost,127.0.0.1,::1,scraper,pentagi\n      - DEFAULT_LAUNCH_ARGS=${SCRAPER_DEFAULT_LAUNCH_ARGS:-[]}' docker-compose.yml
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

set_env SCRAPER_PUBLIC_URL ""
set_env DOCKER_NETWORK "pentagi-egress"
set_env PENTAGI_EGRESS_NETWORK "pentagi-egress"
set_env WORKER_PROXY_URL "http://172.29.0.1:7890"
set_env SCRAPER_DEFAULT_LAUNCH_ARGS '["--proxy-server=http://172.29.0.1:7890"]'

docker compose config --quiet
docker compose up -d scraper pentagi

printf '%s\n' '== configured env =='
grep -E '^(SCRAPER_PUBLIC_URL|DOCKER_NETWORK|PENTAGI_EGRESS_NETWORK)=' .env
printf '%s\n' '== services =='
docker ps --format '{{.Names}}|{{.Status}}|{{.Networks}}' | grep -E '^(pentagi|scraper)\|'
