# PentAGI unified worker tool selection — 2026-10-03

Source: all `stdin` terminal logs currently retained by the production PentAGI database.

- 9,505 terminal inputs across 26 flows.
- 93 package-install commands across 16 flows.
- Existing base image: `pentagi-kali-safe:5.0.0-cn-hotfix.1`.
- New image target: `pentagi-tools-unified:20261003.1`.

## Already present in the base image

`curl`, `wget`, `git`, `jq`, `nmap`, `nuclei`, `sqlmap`, `ffuf`, `nikto`, `dig`, `openssl`, `file`, `netcat`, `socat`, Chromium, Node.js, and the ProjectDiscovery/Go reconnaissance suite.

## Added to the unified image

- OCR and captcha support: Tesseract (English and Simplified Chinese), Pillow, pytesseract, ddddocr.
- Image/document conversion: CairoSVG, librsvg2, fonttools, openpyxl.
- Browser automation: Playwright, Patchright, Xvfb, and a pre-downloaded Chromium runtime.
- Crypto/protocol/data clients: pycryptodome, websocket-client, PyJWT, PyMySQL, pymongo, redis.
- Mobile/reverse engineering: apktool, jadx, lief.
- General CLI gaps: ripgrep, yq, whois, sshpass, testssl.sh, npm, and Go.

The image is intentionally derived from the existing hardened worker image so its current network and security-tool behavior is preserved.
