#!/usr/bin/python3
"""Scoped Kitani reverse proxy with Mihomo node failover and a retry budget."""

import ipaddress
import json
import os
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests


LISTEN_ADDRESS = os.environ.get("LISTEN_ADDRESS", "172.20.0.1")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "18445"))
UPSTREAM_PROXY = os.environ.get("UPSTREAM_PROXY", "http://127.0.0.1:7890")
UPSTREAM_ORIGIN = os.environ.get("UPSTREAM_ORIGIN", "https://api.kitani.ai").rstrip("/")
MIHOMO_CONTROLLER = os.environ.get("MIHOMO_CONTROLLER", "http://127.0.0.1:9090").rstrip("/")
MIHOMO_GROUP = os.environ.get("MIHOMO_GROUP", "KITANI_ROUTE")
ALLOWED_CLIENTS = ipaddress.ip_network(os.environ.get("ALLOWED_CLIENTS", "172.20.0.0/16"))
MAX_BODY_SIZE = int(os.environ.get("MAX_BODY_SIZE", str(128 * 1024 * 1024)))
RETRY_WINDOW_SECONDS = max(1, int(os.environ.get("RETRY_WINDOW_SECONDS", "300")))
CIRCUIT_OPEN_SECONDS = max(1, int(os.environ.get("CIRCUIT_OPEN_SECONDS", "120")))
DIRECT_FALLBACK = os.environ.get("DIRECT_FALLBACK", "true").lower() in {"1", "true", "yes"}

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}
RETRYABLE_STATUS = {429, 500, 502, 503, 504, 520, 521, 522, 523, 524}
RETRYABLE_EXCEPTIONS = (
    requests.exceptions.ConnectTimeout,
    requests.exceptions.ReadTimeout,
    requests.exceptions.ConnectionError,
    requests.exceptions.ProxyError,
    requests.exceptions.SSLError,
)
FAST_RETRIES = 4
BACKOFF_SECONDS = (30, 60, 120, 120)

rotation_lock = threading.Lock()
circuit_lock = threading.Lock()
circuit_open_until = 0.0


def controller_request(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    request = urllib.request.Request(
        MIHOMO_CONTROLLER + path,
        data=data,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        body = response.read()
        return json.loads(body) if body else {}


def rotate_kitani_node():
    with rotation_lock:
        try:
            group_path = "/proxies/" + urllib.parse.quote(MIHOMO_GROUP, safe="")
            group = controller_request("GET", group_path)
            members = group.get("all") or []
            current = group.get("now")
            if len(members) < 2:
                return None
            try:
                current_index = members.index(current)
            except ValueError:
                current_index = -1
            next_node = members[(current_index + 1) % len(members)]
            controller_request("PUT", group_path, {"name": next_node})
            print(
                f"Kitani upstream failed; switched {MIHOMO_GROUP} "
                f"from {current!r} to {next_node!r}",
                flush=True,
            )
            return next_node
        except Exception as exc:
            print(f"Kitani node rotation failed: {type(exc).__name__}", flush=True)
            return None


def circuit_is_open():
    with circuit_lock:
        return time.monotonic() < circuit_open_until


def open_circuit():
    global circuit_open_until
    with circuit_lock:
        circuit_open_until = time.monotonic() + CIRCUIT_OPEN_SECONDS


def close_circuit():
    global circuit_open_until
    with circuit_lock:
        circuit_open_until = 0.0


def retry_delay(failure_count):
    if failure_count <= FAST_RETRIES:
        return 0.25
    index = min(failure_count - FAST_RETRIES - 1, len(BACKOFF_SECONDS) - 1)
    return BACKOFF_SECONDS[index]


class KitaniProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"
    server_version = "PentAGI-Kitani-Proxy"
    sys_version = ""

    def log_message(self, _format, *args):
        return

    def _client_allowed(self):
        try:
            return ipaddress.ip_address(self.client_address[0]) in ALLOWED_CLIENTS
        except ValueError:
            return False

    def _send_json_error(self, status, message, retry_after=None):
        payload = json.dumps({"error": {"message": message}}).encode()
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            if retry_after is not None:
                self.send_header("Retry-After", str(retry_after))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self.close_connection = True

    def _single_upstream_request(self, headers, body, use_proxy, remaining):
        timeout = (min(15, max(1, remaining)), min(300, max(1, remaining)))
        session = requests.Session()
        session.trust_env = False
        try:
            response = session.request(
                method=self.command,
                url=UPSTREAM_ORIGIN + self.path,
                headers=headers,
                data=body,
                stream=True,
                allow_redirects=False,
                timeout=timeout,
                proxies={"http": UPSTREAM_PROXY, "https": UPSTREAM_PROXY} if use_proxy else {},
            )
            response._pentagi_session = session
            return response
        except Exception:
            session.close()
            raise

    @staticmethod
    def _close_upstream(upstream):
        if upstream is None:
            return
        session = getattr(upstream, "_pentagi_session", None)
        upstream.close()
        if session is not None:
            session.close()

    def _request_upstream(self, headers, body):
        deadline = time.monotonic() + RETRY_WINDOW_SECONDS
        failures = 0
        proxy_attempts = 0
        last_error = "unknown"

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break

            use_proxy = not DIRECT_FALLBACK or proxy_attempts < FAST_RETRIES

            upstream = None
            try:
                upstream = self._single_upstream_request(headers, body, use_proxy, remaining)
                if upstream.status_code not in RETRYABLE_STATUS:
                    close_circuit()
                    return upstream
                last_error = f"HTTP {upstream.status_code} via {'proxy' if use_proxy else 'direct'}"
                self._close_upstream(upstream)
            except RETRYABLE_EXCEPTIONS as exc:
                last_error = f"{type(exc).__name__} via {'proxy' if use_proxy else 'direct'}"
                self._close_upstream(upstream)
            except requests.RequestException:
                raise

            failures += 1
            if use_proxy:
                proxy_attempts += 1
                rotate_kitani_node()
            else:
                proxy_attempts = 0

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            delay = min(retry_delay(failures), remaining)
            if delay > 0:
                time.sleep(delay)

        open_circuit()
        print(
            f"Kitani unavailable after {RETRY_WINDOW_SECONDS}s and {failures} attempts: {last_error}",
            flush=True,
        )
        return None

    def _proxy(self):
        if not self._client_allowed():
            self._send_json_error(403, "forbidden")
            return

        if self.command == "GET" and self.path == "/healthz":
            payload = b'{"status":"ok"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(payload)
            self.close_connection = True
            return

        if circuit_is_open():
            self._send_json_error(
                503,
                "Kitani is temporarily unavailable after a five-minute retry window",
                retry_after=CIRCUIT_OPEN_SECONDS,
            )
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json_error(400, "invalid content length")
            return
        if content_length < 0 or content_length > MAX_BODY_SIZE:
            self._send_json_error(413, "request body is too large")
            return

        body = self.rfile.read(content_length) if content_length else None
        headers = {}
        for name, value in self.headers.items():
            lowered = name.lower()
            if lowered in HOP_BY_HOP_HEADERS or lowered in {
                "host",
                "content-length",
                "accept-encoding",
            }:
                continue
            headers[name] = value
        headers["Accept-Encoding"] = "identity"

        try:
            upstream = self._request_upstream(headers, body)
        except requests.RequestException:
            upstream = None
        if upstream is None:
            self._send_json_error(
                503,
                "Kitani is unavailable after automatic node failover and a five-minute retry window",
                retry_after=CIRCUIT_OPEN_SECONDS,
            )
            return

        try:
            self.send_response(upstream.status_code)
            for name in (
                "Content-Type",
                "Content-Length",
                "Cache-Control",
                "Retry-After",
                "X-Request-Id",
                "X-RateLimit-Limit-Requests",
                "X-RateLimit-Remaining-Requests",
                "X-RateLimit-Reset-Requests",
            ):
                value = upstream.headers.get(name)
                if value:
                    self.send_header(name, value)
            self.send_header("Connection", "close")
            self.end_headers()
            for chunk in upstream.iter_content(chunk_size=65536):
                if chunk:
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self._close_upstream(upstream)
            self.close_connection = True

    do_GET = _proxy
    do_POST = _proxy
    do_PUT = _proxy
    do_PATCH = _proxy
    do_DELETE = _proxy
    do_OPTIONS = _proxy


if __name__ == "__main__":
    server = ThreadingHTTPServer((LISTEN_ADDRESS, LISTEN_PORT), KitaniProxyHandler)
    server.daemon_threads = True
    server.serve_forever()
