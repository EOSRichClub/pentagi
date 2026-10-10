#!/usr/bin/python3
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
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "18444"))
UPSTREAM_PROXY = os.environ.get("UPSTREAM_PROXY", "http://127.0.0.1:7890")
UPSTREAM_ORIGIN = "https://api.b.ai"
MIHOMO_CONTROLLER = "http://127.0.0.1:9090"
MIHOMO_GROUP = "BAI_ROUTE"
ALLOWED_CLIENTS = ipaddress.ip_network("172.20.0.0/16")
MAX_BODY_SIZE = 128 * 1024 * 1024
MAX_UPSTREAM_ATTEMPTS = 3

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
RETRYABLE_STATUS = {502, 503, 504}
RETRYABLE_EXCEPTIONS = (
    requests.exceptions.ConnectTimeout,
    requests.exceptions.ConnectionError,
    requests.exceptions.ProxyError,
    requests.exceptions.SSLError,
)
rotation_lock = threading.Lock()


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


def rotate_bai_node():
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
                f"B.AI upstream failed; switched {MIHOMO_GROUP} from {current!r} to {next_node!r}",
                flush=True,
            )
            return next_node
        except Exception as exc:
            print(f"B.AI node rotation failed: {type(exc).__name__}", flush=True)
            return None


class BAIProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"
    server_version = "PentAGI-BAI-Proxy"
    sys_version = ""

    def log_message(self, _format, *args):
        return

    def _client_allowed(self):
        try:
            return ipaddress.ip_address(self.client_address[0]) in ALLOWED_CLIENTS
        except ValueError:
            return False

    def _send_json_error(self, status, message):
        payload = json.dumps({"error": {"message": message}}).encode()
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self.close_connection = True

    def _request_upstream(self, headers, body):
        last_error = None
        for attempt in range(MAX_UPSTREAM_ATTEMPTS):
            upstream = None
            try:
                upstream = requests.request(
                    method=self.command,
                    url=UPSTREAM_ORIGIN + self.path,
                    headers=headers,
                    data=body,
                    stream=True,
                    allow_redirects=False,
                    timeout=(15, 1800),
                    proxies={"http": UPSTREAM_PROXY, "https": UPSTREAM_PROXY},
                )
                if upstream.status_code not in RETRYABLE_STATUS:
                    return upstream
                last_error = f"HTTP {upstream.status_code}"
                upstream.close()
            except RETRYABLE_EXCEPTIONS as exc:
                last_error = type(exc).__name__
                if upstream is not None:
                    upstream.close()
            except requests.RequestException:
                raise

            if attempt + 1 >= MAX_UPSTREAM_ATTEMPTS:
                break
            rotate_bai_node()
            time.sleep(0.25)

        print(
            f"B.AI upstream unavailable after {MAX_UPSTREAM_ATTEMPTS} node attempts: {last_error}",
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
            self._send_json_error(502, "B.AI upstream is unavailable after automatic failover")
            return

        try:
            self.send_response(upstream.status_code)
            for name in ("Content-Type", "Content-Length", "Cache-Control", "Retry-After", "X-Request-Id"):
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
            upstream.close()
            self.close_connection = True

    do_GET = _proxy
    do_POST = _proxy
    do_PUT = _proxy
    do_PATCH = _proxy
    do_DELETE = _proxy
    do_OPTIONS = _proxy


if __name__ == "__main__":
    server = ThreadingHTTPServer((LISTEN_ADDRESS, LISTEN_PORT), BAIProxyHandler)
    server.daemon_threads = True
    server.serve_forever()
