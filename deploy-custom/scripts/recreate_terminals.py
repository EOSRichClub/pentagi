#!/usr/bin/env python3
"""Recreate pentagi-terminal containers for all active flows with new bind mounts."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

DATA_ROOT = Path("/var/lib/docker/volumes/pentagi_pentagi-data/_data")
IMAGE = "pentagi-tools:latest"
BASE_PORT = 28000
PORTS_PER_FLOW = 2
PORT_LIMIT = 2000


def run(cmd, check=True, capture=True):
    r = subprocess.run(cmd, shell=True, text=True, capture_output=capture)
    if check and r.returncode != 0:
        raise RuntimeError(f"cmd failed ({r.returncode}): {cmd}\n{r.stderr}")
    return r


def ports_for(flow_id: int):
    return [BASE_PORT + (flow_id * PORTS_PER_FLOW + i) % PORT_LIMIT for i in range(PORTS_PER_FLOW)]


def ensure_dirs(flow_id: int):
    root = DATA_ROOT / f"flow-{flow_id}-data"
    for sub in (
        "work",
        "uploads",
        "resources",
        "container",
        "data",
        "reports",
        "source",
        "work/uploads",
        "work/resources",
        "work/data",
        "work/reports",
        "work/source",
    ):
        (root / sub).mkdir(parents=True, exist_ok=True)
    return root


def container_name(flow_id: int) -> str:
    return f"pentagi-terminal-{flow_id}"


def remove_container(name: str):
    run(f"docker rm -f {name} 2>/dev/null || true", check=False)


def create_container(flow_id: int, image: str):
    name = container_name(flow_id)
    root = ensure_dirs(flow_id)
    work = root / "work"
    uploads = root / "uploads"
    resources = root / "resources"
    data = root / "data"
    reports = root / "reports"
    source = root / "source"
    p0, p1 = ports_for(flow_id)

    # hostname style matches pentagi (crc32 hex) - not required for function
    cmd = [
        "docker",
        "run",
        "-d",
        "--name",
        name,
        "--restart",
        "on-failure:5",
        "--workdir",
        "/work",
        "--cap-add",
        "NET_ADMIN",
        "--cap-add",
        "NET_RAW",
        "-v",
        f"{work}:/work",
        "-v",
        f"{uploads}:/work/uploads",
        "-v",
        f"{resources}:/work/resources",
        "-v",
        f"{data}:/work/data",
        "-v",
        f"{reports}:/work/reports",
        "-v",
        f"{source}:/work/source",
        "-v",
        "/var/run/docker.sock:/var/run/docker.sock",
        "-p",
        f"0.0.0.0:{p0}:{p0}",
        "-p",
        f"0.0.0.0:{p1}:{p1}",
        "-e",
        "PATH=/usr/local/bin:/opt/tools/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin",
        "-e",
        "GOPROXY=https://goproxy.cn,direct",
        "--entrypoint",
        "tail",
        image,
        "-f",
        "/dev/null",
    ]
    r = subprocess.run(cmd, text=True, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"create {name} failed: {r.stderr}")
    cid = r.stdout.strip()
    return cid, name, str(work)


def db_password() -> str:
    env = Path("/opt/pentagi/.env").read_text()
    for line in env.splitlines():
        if line.startswith("PENTAGI_POSTGRES_PASSWORD="):
            return line.split("=", 1)[1]
    raise RuntimeError("no db password")


def active_flows(pw: str):
    sql = """
    SELECT f.id, f.status, COALESCE(c.image,'') as image
    FROM flows f
    LEFT JOIN LATERAL (
      SELECT image FROM containers WHERE flow_id=f.id ORDER BY id DESC LIMIT 1
    ) c ON true
    WHERE f.deleted_at IS NULL
      AND f.status IN ('waiting','running','finished')
    ORDER BY f.id;
    """
    r = run(
        f"docker exec -e PGPASSWORD={pw!s} pgvector psql -U postgres -d pentagidb -t -A -F'|' -c \"{sql}\""
    )
    rows = []
    for line in r.stdout.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) < 2:
            continue
        fid = int(parts[0])
        status = parts[1]
        image = parts[2] if len(parts) > 2 and parts[2] else IMAGE
        if not image or image == "debian:latest":
            image = IMAGE
        rows.append((fid, status, image))
    return rows


def update_db(pw: str, flow_id: int, cid: str, local_dir: str, image: str, name: str):
    # upsert container row: set latest primary-like row for flow to running
    sql = f"""
    UPDATE containers SET
      status='running',
      local_id='{cid}',
      local_dir='{local_dir}',
      image='{image}',
      name='{name}'
    WHERE id = (
      SELECT id FROM containers WHERE flow_id={flow_id} ORDER BY id DESC LIMIT 1
    );
    """
    run(
        f"docker exec -e PGPASSWORD={pw!s} pgvector psql -U postgres -d pentagidb -c \"{sql}\""
    )


def main():
    pw = db_password()
    flows = active_flows(pw)
    print(f"Active flows to repair: {len(flows)}")
    ok = fail = 0
    for fid, status, image in flows:
        name = container_name(fid)
        print(f"\n=== flow {fid} ({status}) image={image} ===")
        try:
            # ensure image present
            run(f"docker image inspect {image} >/dev/null 2>&1 || docker pull {image}", check=False)
            remove_container(name)
            # also remove legacy named volume? keep for backup, don't auto-delete
            cid, name, work = create_container(fid, image if image else IMAGE)
            update_db(pw, fid, cid, work, image if image else IMAGE, name)
            # verify running
            st = run(f"docker inspect -f '{{{{.State.Status}}}}' {name}").stdout.strip()
            print(f"  started {name} id={cid[:12]} status={st} work={work}")
            if st != "running":
                raise RuntimeError(f"not running: {st}")
            # quick exec test
            t = run(f"docker exec {name} sh -c 'pwd && ls /work | head'", check=False)
            print(f"  exec: {t.stdout.strip()[:200]}")
            ok += 1
        except Exception as e:
            print(f"  FAIL: {e}")
            fail += 1
    print(f"\nDone ok={ok} fail={fail}")
    # summary
    run("docker ps --filter name=pentagi-terminal- --format 'table {{.Names}}\t{{.Status}}'", check=False, capture=False)


if __name__ == "__main__":
    main()
