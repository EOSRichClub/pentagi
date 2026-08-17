#!/bin/bash
# Migrate legacy pentagi-terminal-{id}-data volumes into flow-{id}-data/work
# Usage: stop terminals first, then: bash migrate_flow_workdirs.sh [--apply]
set -euo pipefail

APPLY=0
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=1
fi

DATA_ROOT="/var/lib/docker/volumes/pentagi_pentagi-data/_data"
VOL_ROOT="/var/lib/docker/volumes"

echo "=== PentAGI flow workdir migration ==="
echo "DATA_ROOT=$DATA_ROOT"
echo "MODE=$([ $APPLY -eq 1 ] && echo APPLY || echo DRY-RUN)"
echo

if [[ ! -d "$DATA_ROOT" ]]; then
  echo "ERROR: data root not found: $DATA_ROOT"
  exit 1
fi

# Stop all pentagi terminal containers for safe copy
mapfile -t TERMS < <(docker ps -aq --filter name=pentagi-terminal- 2>/dev/null || true)
if [[ ${#TERMS[@]} -gt 0 ]]; then
  echo "Stopping ${#TERMS[@]} pentagi-terminal containers..."
  if [[ $APPLY -eq 1 ]]; then
    docker stop "${TERMS[@]}" || true
  else
    echo "  (dry-run) would stop: $(docker ps --filter name=pentagi-terminal- --format '{{.Names}}' | tr '\n' ' ')"
  fi
fi

migrated=0
for volpath in "$VOL_ROOT"/pentagi-terminal-*-data; do
  [[ -d "$volpath" ]] || continue
  name=$(basename "$volpath")
  # pentagi-terminal-28-data -> 28
  id=${name#pentagi-terminal-}
  id=${id%-data}
  if [[ ! "$id" =~ ^[0-9]+$ ]]; then
    echo "skip unknown volume $name"
    continue
  fi

  src="$volpath/_data"
  dest="$DATA_ROOT/flow-${id}-data/work"
  uploads="$DATA_ROOT/flow-${id}-data/uploads"
  resources="$DATA_ROOT/flow-${id}-data/resources"
  container_cache="$DATA_ROOT/flow-${id}-data/container"

  if [[ ! -d "$src" ]]; then
    echo "skip $name (no _data)"
    continue
  fi

  size=$(du -sh "$src" 2>/dev/null | awk '{print $1}')
  echo "--- flow $id ($size) ---"
  echo "  from: $src"
  echo "  to:   $dest"

  if [[ $APPLY -eq 1 ]]; then
    mkdir -p "$dest" "$uploads" "$resources" "$container_cache" "$dest/uploads" "$dest/resources"
    # rsync contents; exclude obvious package caches
    rsync -a --exclude='.cache/' --exclude='apt/' --exclude='var/cache/' \
      "$src"/ "$dest"/
    echo "  migrated."
  else
    echo "  (dry-run) would rsync"
  fi
  migrated=$((migrated + 1))
done

# Ensure empty flow-*-data trees for flows that only have flow-N dirs
for d in "$DATA_ROOT"/flow-*; do
  base=$(basename "$d")
  if [[ "$base" =~ ^flow-([0-9]+)$ ]]; then
    id="${BASH_REMATCH[1]}"
    target="$DATA_ROOT/flow-${id}-data"
    if [[ $APPLY -eq 1 ]]; then
      mkdir -p "$target/work" "$target/uploads" "$target/resources" "$target/container"
    fi
  fi
done

echo
echo "Done. volumes considered: $migrated"
if [[ $APPLY -eq 0 ]]; then
  echo "Re-run with --apply to perform migration."
fi
