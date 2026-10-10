#!/usr/bin/env python3
"""Keep PentAGI's isolated task ingress settings across subscription refreshes."""

from pathlib import Path


path = Path("/usr/local/bin/mihomo-refresh-sub")
text = path.read_text()

mixed = '        "mixed-port: 7890",\n'
redir = '        "redir-port: 7892",\n'
if redir not in text:
    if mixed not in text:
        raise SystemExit("mihomo refresh template has no mixed-port anchor")
    text = text.replace(mixed, mixed + redir, 1)

replacements = {
    '        "allow-lan: false",': '        "allow-lan: true",',
    '        "bind-address: 127.0.0.1",': '        "bind-address: \'*\'",',
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise SystemExit(f"mihomo refresh template has no expected anchor: {old}")

path.write_text(text)
