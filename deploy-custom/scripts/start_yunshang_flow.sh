#!/bin/bash
set -e
BASE="${PENTAGI_URL:-https://127.0.0.1:8443}"
MAIL="${PENTAGI_MAIL:-admin@pentagi.com}"
PASS="${PENTAGI_PASS:-PentAGI@YunShang2026}"
PROVIDER="${1:-deepseek}"
CK=$(mktemp)
trap "rm -f $CK" EXIT
curl -sk -c "$CK" -b "$CK" -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"mail\":\"$MAIL\",\"password\":\"$PASS\"}" >/dev/null
INPUT=$(cat <<EOF
对目标 Web 应用进行授权渗透测试（资产归属本人/已获书面授权）。

目标 URL: https://www.yunshanghl.com/login?redirect=%2Fdata
主站范围: https://www.yunshanghl.com 及其直接相关 API/子路径。

规则:
1. 仅测试上述域名，禁止攻击第三方与内网无关资产。
2. 以发现并验证高价值漏洞为目标：认证绕过、注入、越权、文件上传、SSRF、XSS、敏感信息泄露等。
3. 优先从登录页与 redirect 参数切入，检查认证、会话、授权与重定向相关问题。
4. 对每个发现给出：风险等级、复现步骤、证据（请求/响应摘要）、修复建议。
5. 避免破坏性操作（删库、大规模 DoS、真实数据篡改）。

请按标准 Web 渗透流程：信息收集 → 端点枚举 → 漏洞检测 → 手工验证 → 输出完整中文报告。
EOF
)
curl -sk -c "$CK" -b "$CK" -X POST "$BASE/api/v1/flows/" \
  -H "Content-Type: application/json" \
  -d "$(python3 - <<PY
import json,os
print(json.dumps({"input": """$INPUT""", "provider": "$PROVIDER"}))
PY
)"
echo
