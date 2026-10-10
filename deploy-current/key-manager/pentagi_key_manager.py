#!/usr/bin/env python3
"""Authenticated host-side API for managing PentAGI provider credentials."""

from __future__ import annotations

import json
import os
import re
import shutil
import ssl
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


PENTAGI_DIR = Path(os.environ.get("PENTAGI_DIR", "/opt/pentagi"))
ENV_FILE = Path(os.environ.get("PENTAGI_ENV_FILE", str(PENTAGI_DIR / ".env")))
COMPOSE_FILE = Path(os.environ.get("PENTAGI_COMPOSE_FILE", str(PENTAGI_DIR / "docker-compose.yml")))
BACKUP_DIR = Path(os.environ.get("PENTAGI_KEY_BACKUP_DIR", str(PENTAGI_DIR / "backups" / "key-manager")))
INFO_URL = os.environ.get("PENTAGI_INFO_URL", "https://127.0.0.1:8443/api/v1/info")
ALLOWED_ORIGIN = os.environ.get("PENTAGI_ALLOWED_ORIGIN", "https://pentagi.pzcmtech.com").rstrip("/")
LISTEN_HOST = os.environ.get("PENTAGI_KEY_MANAGER_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("PENTAGI_KEY_MANAGER_PORT", "18443"))

MAX_BODY_BYTES = 16 * 1024
MAX_SECRET_BYTES = 8192
UPDATE_LOCK = threading.Lock()
SAFE_ENV_NAME = re.compile(r"^[A-Z][A-Z0-9_]*$")


@dataclass(frozen=True)
class KeyDefinition:
    name: str
    label: str
    description: str
    group: str
    server_url_name: str | None = None


KEY_DEFINITIONS = (
    KeyDefinition("OPEN_AI_KEY", "OpenAI", "OpenAI 及兼容模型服务", "model", "OPEN_AI_SERVER_URL"),
    KeyDefinition("ANTHROPIC_API_KEY", "Anthropic", "Claude 模型服务", "model", "ANTHROPIC_SERVER_URL"),
    KeyDefinition("GEMINI_API_KEY", "Google Gemini", "Google Gemini 模型服务", "model", "GEMINI_SERVER_URL"),
    KeyDefinition("DEEPSEEK_API_KEY", "DeepSeek", "DeepSeek 模型服务", "model", "DEEPSEEK_SERVER_URL"),
    KeyDefinition("GLM_API_KEY", "智谱 GLM", "智谱 GLM 模型服务", "model", "GLM_SERVER_URL"),
    KeyDefinition("KIMI_API_KEY", "Kimi / Moonshot", "月之暗面 Kimi 模型服务", "model", "KIMI_SERVER_URL"),
    KeyDefinition("QWEN_API_KEY", "通义千问 Qwen", "阿里云百炼通义千问模型服务", "model", "QWEN_SERVER_URL"),
    KeyDefinition("MINIMAX_API_KEY", "MiniMax", "MiniMax 模型服务", "model", "MINIMAX_SERVER_URL"),
    KeyDefinition("LLM_SERVER_KEY", "自定义模型服务", "OpenAI 兼容的自定义模型接口", "model", "LLM_SERVER_URL"),
    KeyDefinition("OLLAMA_SERVER_API_KEY", "Ollama Cloud", "Ollama Cloud 或受保护的 Ollama 服务", "model", "OLLAMA_SERVER_URL"),
    KeyDefinition("BEDROCK_BEARER_TOKEN", "AWS Bedrock Bearer", "AWS Bedrock Bearer Token", "model", "BEDROCK_SERVER_URL"),
    KeyDefinition("EMBEDDING_KEY", "Embedding 服务", "独立的向量嵌入模型服务", "shared", "EMBEDDING_URL"),
    KeyDefinition("GOOGLE_API_KEY", "Google Search", "Google Custom Search API", "search"),
    KeyDefinition("TAVILY_API_KEY", "Tavily", "Tavily 网络搜索服务", "search"),
    KeyDefinition("TRAVERSAAL_API_KEY", "Traversaal", "Traversaal 搜索服务", "search"),
    KeyDefinition("FIRECRAWL_API_KEY", "Firecrawl", "Firecrawl 网页抓取服务", "search", "FIRECRAWL_API_URL"),
    KeyDefinition("PERPLEXITY_API_KEY", "Perplexity", "Perplexity 搜索服务", "search"),
)
KEYS_BY_NAME = {item.name: item for item in KEY_DEFINITIONS}


def decode_env_value(raw: str) -> str:
    value = raw.strip()
    if len(value) >= 2 and value[0] == value[-1] == "'":
        return value[1:-1].replace("\\'", "'").replace("\\\\", "\\")
    if len(value) >= 2 and value[0] == value[-1] == '"':
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value[1:-1]
    return value


def read_env(path: Path = ENV_FILE) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        if stripped.startswith("export "):
            stripped = stripped[7:].lstrip()
        name, raw_value = stripped.split("=", 1)
        name = name.strip()
        if SAFE_ENV_NAME.fullmatch(name):
            values[name] = decode_env_value(raw_value)
    return values


def encode_env_value(value: str) -> str:
    if "\n" in value or "\r" in value or "\x00" in value:
        raise ValueError("密钥不能包含换行符或空字符")
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def update_env_text(text: str, updates: dict[str, str]) -> str:
    pending = dict(updates)
    output: list[str] = []
    for line in text.splitlines(keepends=True):
        match = re.match(r"^(\s*)(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=", line)
        if match and match.group(2) in pending:
            name = match.group(2)
            newline = "\r\n" if line.endswith("\r\n") else "\n" if line.endswith("\n") else ""
            output.append(f"{match.group(1)}{name}={encode_env_value(pending.pop(name))}{newline}")
        else:
            output.append(line)
    if pending:
        if output and not output[-1].endswith(("\n", "\r\n")):
            output[-1] += "\n"
        output.append("\n# Managed from PentAGI Settings → Model API Keys\n")
        for name, value in pending.items():
            output.append(f"{name}={encode_env_value(value)}\n")
    return "".join(output)


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:3]}••••••{value[-3:]}"


def serialize_key(definition: KeyDefinition, values: dict[str, str]) -> dict[str, Any]:
    secret = values.get(definition.name, "")
    return {
        "description": definition.description,
        "group": definition.group,
        "hasValue": bool(secret),
        "label": definition.label,
        "masked": mask_secret(secret),
        "name": definition.name,
        "serverUrl": values.get(definition.server_url_name or "", ""),
        "serverUrlName": definition.server_url_name,
    }


def validate_url(value: str) -> None:
    if not value:
        return
    if len(value) > 2048:
        raise ValueError("接口地址过长")
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("接口地址必须是有效的 HTTP 或 HTTPS URL")
    if parsed.username or parsed.password:
        raise ValueError("接口地址不能包含用户名或密码")


def atomic_write_env(new_text: str) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    backup = BACKUP_DIR / f"env-{stamp}.bak"
    shutil.copy2(ENV_FILE, backup)
    backup.chmod(0o600)
    stat = ENV_FILE.stat()
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=ENV_FILE.parent, delete=False) as handle:
        handle.write(new_text)
        handle.flush()
        os.fsync(handle.fileno())
        temp_path = Path(handle.name)
    temp_path.chmod(stat.st_mode & 0o777)
    os.replace(temp_path, ENV_FILE)
    return backup


def wait_for_pentagi(timeout: float = 60.0) -> None:
    context = ssl._create_unverified_context()
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(INFO_URL, timeout=3, context=context) as response:
                if response.status == HTTPStatus.OK:
                    return
        except (OSError, urllib.error.URLError) as error:
            last_error = error
        time.sleep(1)
    raise RuntimeError(f"PentAGI 重载后未能及时恢复：{last_error or '健康检查超时'}")


def restart_pentagi() -> None:
    command = [
        "docker",
        "compose",
        "--project-directory",
        str(PENTAGI_DIR),
        "-f",
        str(COMPOSE_FILE),
        "up",
        "-d",
        "--force-recreate",
        "--no-deps",
        "pentagi",
    ]
    completed = subprocess.run(
        command,
        cwd=PENTAGI_DIR,
        capture_output=True,
        check=False,
        text=True,
        timeout=180,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()[-1200:]
        raise RuntimeError(f"PentAGI 重载失败：{detail}")
    wait_for_pentagi()


def apply_updates(updates: dict[str, str]) -> None:
    with UPDATE_LOCK:
        original = ENV_FILE.read_text(encoding="utf-8")
        updated = update_env_text(original, updates)
        if updated == original:
            return
        backup = atomic_write_env(updated)
        try:
            restart_pentagi()
        except Exception:
            shutil.copy2(backup, ENV_FILE)
            try:
                restart_pentagi()
            except Exception:
                pass
            raise


class KeyManagerHandler(BaseHTTPRequestHandler):
    server_version = "PentAGIKeyManager/1.0"

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.client_address[0]} - {format % args}", flush=True)

    def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def require_admin(self) -> bool:
        cookie = self.headers.get("Cookie", "")
        if not cookie:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "请先登录 PentAGI"})
            return False
        request = urllib.request.Request(INFO_URL, headers={"Cookie": cookie, "User-Agent": "PentAGI-Key-Manager"})
        try:
            with urllib.request.urlopen(request, timeout=5, context=ssl._create_unverified_context()) as response:
                payload = json.load(response)
        except (OSError, ValueError, urllib.error.URLError):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "无法验证 PentAGI 登录状态"})
            return False
        data = payload.get("data") or {}
        role = data.get("role") or {}
        user = data.get("user") or {}
        is_admin = str(role.get("name", "")).lower() == "admin" or user.get("role_id") == 1
        if data.get("type") != "user" or not is_admin:
            self.send_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "只有管理员可以管理 API 密钥"})
            return False
        return True

    def require_mutation_headers(self) -> bool:
        origin = self.headers.get("Origin", "").rstrip("/")
        marker = self.headers.get("X-Pentagi-Key-Manager", "")
        if origin != ALLOWED_ORIGIN or marker != "1":
            self.send_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "请求来源校验失败"})
            return False
        return True

    def read_json(self) -> dict[str, Any] | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY_BYTES:
            self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "error": "请求内容过大"})
            return None
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "请求 JSON 格式无效"})
            return None
        if not isinstance(payload, dict):
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "请求内容必须是 JSON 对象"})
            return None
        return payload

    def do_GET(self) -> None:
        if self.path == "/v1/health":
            self.send_json(HTTPStatus.OK, {"ok": True})
            return
        if self.path != "/v1/keys":
            self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "接口不存在"})
            return
        if not self.require_admin():
            return
        values = read_env()
        self.send_json(HTTPStatus.OK, {"ok": True, "keys": [serialize_key(item, values) for item in KEY_DEFINITIONS]})

    def do_PUT(self) -> None:
        if self.path != "/v1/keys":
            self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "接口不存在"})
            return
        if not self.require_mutation_headers() or not self.require_admin():
            return
        payload = self.read_json()
        if payload is None:
            return
        try:
            name = str(payload.get("name", ""))
            definition = KEYS_BY_NAME.get(name)
            if definition is None:
                raise ValueError("不支持此 API 密钥类型")
            current = read_env()
            updates: dict[str, str] = {}
            value = payload.get("value")
            if value is not None:
                if not isinstance(value, str) or not value.strip():
                    raise ValueError("API 密钥不能为空")
                value = value.strip()
                if len(value.encode("utf-8")) > MAX_SECRET_BYTES:
                    raise ValueError("API 密钥过长")
                encode_env_value(value)
                updates[name] = value
            elif not current.get(name):
                raise ValueError("请先输入 API 密钥")
            if definition.server_url_name and "serverUrl" in payload:
                server_url = str(payload.get("serverUrl") or "").strip()
                validate_url(server_url)
                updates[definition.server_url_name] = server_url
            apply_updates(updates)
            values = read_env()
            self.send_json(HTTPStatus.OK, {"ok": True, "key": serialize_key(definition, values)})
        except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(error)})

    def do_DELETE(self) -> None:
        prefix = "/v1/keys/"
        if not self.path.startswith(prefix):
            self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "接口不存在"})
            return
        if not self.require_mutation_headers() or not self.require_admin():
            return
        name = urllib.parse.unquote(self.path[len(prefix) :])
        definition = KEYS_BY_NAME.get(name)
        if definition is None:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "不支持此 API 密钥类型"})
            return
        try:
            apply_updates({name: ""})
            self.send_json(HTTPStatus.OK, {"ok": True, "key": serialize_key(definition, read_env())})
        except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(error)})

    def do_OPTIONS(self) -> None:
        self.send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "error": "不支持跨域请求"})


def main() -> None:
    if not ENV_FILE.is_file() or not COMPOSE_FILE.is_file():
        raise SystemExit("PentAGI .env or docker-compose.yml is missing")
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), KeyManagerHandler)
    print(f"PentAGI key manager listening on {LISTEN_HOST}:{LISTEN_PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
