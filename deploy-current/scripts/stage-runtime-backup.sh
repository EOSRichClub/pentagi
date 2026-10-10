#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

stamp="${1:-$(date +%Y%m%d-%H%M%S)}"
stage="/var/tmp/pentagi-recovery-${stamp}"
recovery_doc="${2:-/tmp/pentagi-RECOVERY.md}"

if [[ -e "${stage}" ]]; then
  echo "backup staging path already exists: ${stage}" >&2
  exit 1
fi

umask 077
mkdir -p "${stage}"/{database,host,runtime,volumes}

restart_needed=0
declare -a running_containers=()

restart_pentagi() {
  local name
  if [[ "${restart_needed}" -ne 1 ]]; then
    return
  fi

  if printf '%s\n' "${running_containers[@]}" | grep -Fxq pgvector; then
    docker start pgvector >/dev/null || true
    for _ in {1..30}; do
      if docker exec pgvector pg_isready -U postgres -d pentagidb >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
  fi

  for name in scraper ollama-embedding pgexporter pentagi; do
    if printf '%s\n' "${running_containers[@]}" | grep -Fxq "${name}"; then
      docker start "${name}" >/dev/null || true
    fi
  done

  for name in "${running_containers[@]}"; do
    case "${name}" in
      pgvector|scraper|ollama-embedding|pgexporter|pentagi) ;;
      *) docker start "${name}" >/dev/null || true ;;
    esac
  done

  restart_needed=0
}

trap restart_pentagi EXIT

date --iso-8601=seconds >"${stage}/runtime/captured-at.txt"
hostnamectl >"${stage}/runtime/hostnamectl.txt" 2>&1 || true
uname -a >"${stage}/runtime/uname.txt"
df -hT >"${stage}/runtime/df.txt"
docker version >"${stage}/runtime/docker-version.txt" 2>&1
docker info >"${stage}/runtime/docker-info.txt" 2>&1
docker ps -a --no-trunc >"${stage}/runtime/docker-ps.txt"
docker image ls --digests --no-trunc >"${stage}/runtime/docker-images.txt"
docker network ls --no-trunc >"${stage}/runtime/docker-networks.txt"
docker volume ls >"${stage}/runtime/docker-volumes.txt"
iptables-save >"${stage}/runtime/iptables-save.txt" 2>&1 || true
nft list ruleset >"${stage}/runtime/nft-ruleset.txt" 2>&1 || true
systemctl list-unit-files 'pentagi-*' 'mihomo*' >"${stage}/runtime/systemd-units.txt" 2>&1 || true

mapfile -t selected_volumes < <(docker volume ls --format '{{.Name}}' | grep -E '^pentagi(_|-terminal-)' | sort)
printf '%s\n' "${selected_volumes[@]}" >"${stage}/runtime/volume-names.txt"

while IFS= read -r container_id; do
  [[ -n "${container_id}" ]] || continue
  name="$(docker inspect --format '{{.Name}}' "${container_id}" | sed 's#^/##')"
  project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${container_id}" 2>/dev/null || true)"
  mounts="$(docker inspect --format '{{range .Mounts}}{{.Name}} {{end}}' "${container_id}")"
  if [[ "${project}" == "pentagi" || "${name}" == pentagi* || "${mounts}" =~ (^|[[:space:]])pentagi(_|-terminal-) ]]; then
    running_containers+=("${name}")
  fi
done < <(docker ps -q)

printf '%s\n' "${running_containers[@]}" | sort -u >"${stage}/runtime/running-containers.txt"

mapfile -t relevant_container_ids < <(while IFS= read -r name; do [[ -n "${name}" ]] && docker inspect --format '{{.Id}}' "${name}"; done <"${stage}/runtime/running-containers.txt")
if [[ "${#relevant_container_ids[@]}" -gt 0 ]]; then
  docker inspect "${relevant_container_ids[@]}" >"${stage}/runtime/container-inspect.json"
fi

if [[ "${#selected_volumes[@]}" -gt 0 ]]; then
  docker volume inspect "${selected_volumes[@]}" >"${stage}/runtime/volume-inspect.json"
fi

if docker network inspect pentagi_default >/dev/null 2>&1; then
  docker network inspect pentagi_default >"${stage}/runtime/network-inspect.json"
fi

docker image inspect pentagi-local:2.1.0-cn-hotfix.8-assistant-model-switch-r1 pentagi-tools-unified:20261003.1 pentagi-kali-safe:5.0.0-cn-hotfix.1 >"${stage}/runtime/custom-image-inspect.json"

docker exec pgvector pg_dump -U postgres -d pentagidb -Fc >"${stage}/database/pentagidb.dump"
docker exec pgvector pg_dumpall -U postgres --globals-only >"${stage}/database/globals.sql"
docker exec -i pgvector pg_restore -l <"${stage}/database/pentagidb.dump" >"${stage}/database/pentagidb.toc"

host_paths=(
  opt/pentagi
  etc/mihomo
  etc/nginx/sites-enabled/pentagi
  etc/systemd/system/mihomo.service
  etc/systemd/system/pentagi-bai-proxy.service
  etc/systemd/system/pentagi-egress.service
  etc/systemd/system/pentagi-key-manager.service
  etc/systemd/system/pentagi-kitani-proxy.service
  etc/systemd/system/pentagi-worker-limiter.service
  usr/local/sbin/pentagi-egress-firewall
  usr/local/sbin/pentagi-worker-limiter
  usr/local/libexec/pentagi_bai_proxy.py
  usr/local/libexec/pentagi_kitani_proxy.py
)
declare -a existing_host_paths=()
for path in "${host_paths[@]}"; do
  [[ -e "/${path}" ]] && existing_host_paths+=("${path}")
done
tar --xattrs --acls --numeric-owner -I 'zstd -T0 -6' -cpf "${stage}/host/host-config.tar.zst" -C / "${existing_host_paths[@]}"

if [[ -f "${recovery_doc}" ]]; then
  cp -a "${recovery_doc}" "${stage}/RECOVERY.md"
fi
cp -a "${BASH_SOURCE[0]}" "${stage}/stage-runtime-backup.sh"

if [[ "${#running_containers[@]}" -gt 0 ]]; then
  restart_needed=1
  docker stop --time 30 "${running_containers[@]}" >/dev/null
fi

for volume in "${selected_volumes[@]}"; do
  mountpoint="$(docker volume inspect --format '{{.Mountpoint}}' "${volume}")"
  tar --xattrs --acls --numeric-owner -I 'zstd -T0 -6' -cpf "${stage}/volumes/${volume}.tar.zst" -C "${mountpoint}" .
done

restart_pentagi
sleep 5
docker ps --filter label=com.docker.compose.project=pentagi --format '{{.Names}}|{{.Image}}|{{.Status}}' >"${stage}/runtime/pentagi-status-after.txt"

jq -n --arg createdAt "$(date --iso-8601=seconds)" --arg instanceId "i-f8z64hmn7t1g302fposu" --arg region "cn-heyuan" --rawfile containers "${stage}/runtime/running-containers.txt" --rawfile volumes "${stage}/runtime/volume-names.txt" '{schemaVersion: 1, createdAt: $createdAt, cloud: "aliyun", region: $region, instanceId: $instanceId, runningContainers: ($containers | split("\n") | map(select(length > 0))), volumes: ($volumes | split("\n") | map(select(length > 0)))}' >"${stage}/MANIFEST.json"

(
  cd "${stage}"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum >SHA256SUMS
)

chmod -R go-rwx "${stage}"
du -sh "${stage}"
printf '%s\n' "${stage}"
