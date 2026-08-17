
import json, urllib.request, ssl, http.cookiejar, time
ctx = ssl._create_unverified_context()
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), urllib.request.HTTPCookieProcessor(cj))
BASE = "https://127.0.0.1:8443"

def post(path, data, timeout=300):
    req = urllib.request.Request(BASE+path, data=json.dumps(data).encode(), headers={"Content-Type":"application/json"}, method="POST")
    try:
        return json.loads(opener.open(req, timeout=timeout).read().decode())
    except Exception as e:
        body = e.read().decode() if hasattr(e, "read") else str(e)
        return {"error": str(e), "body": body}

opener.open(urllib.request.Request(
    BASE+"/api/v1/auth/login",
    data=json.dumps({"mail":"admin@pentagi.com","password":"PentAGI@YunShang2026"}).encode(),
    headers={"Content-Type":"application/json"}, method="POST"))

prompt = """对目标 Web 应用进行授权渗透测试（资产归属本人/已获书面授权）。

目标域名: hnssbuxi.cn
入口参考: https://hnssbuxi.cn/
测试范围: hnssbuxi.cn 及其 www 子域、同站点直接相关 API/子路径。

规则与要求:
1. 仅测试 hnssbuxi.cn / www.hnssbuxi.cn，禁止攻击第三方与无关内网资产。
2. 全程使用中文输出：任务拆解、过程说明、最终报告都必须是中文。
3. 初步指纹：Nginx + PHP/7.4.33，部分路径返回 404，请先做完整信息收集与目录/入口发现。
4. 重点检查：未授权访问、弱口令/默认后台、注入、XSS、文件上传、路径遍历、SSRF、敏感文件泄露、配置错误、PHP 相关漏洞。
5. 每个发现需包含：风险等级、复现步骤、证据摘要、修复建议。
6. 禁止破坏性操作（删库、大规模 DoS、真实业务数据篡改）。
7. 最终输出完整中文渗透测试报告。

请按：信息收集 → 端点枚举 → 漏洞检测 → 手工验证 → 中文报告 执行。"""

# create/update template
print("template", json.dumps(post("/api/v1/graphql", {
    "query": "mutation($input: CreateFlowTemplateInput!){ createFlowTemplate(input:$input){ id title } }",
    "variables": {"input": {"title": "河南/hnssbuxi.cn-中文Web渗透", "text": prompt}}
}), ensure_ascii=False))

# create flow with custom glm-5.2
print("createFlow", json.dumps(post("/api/v1/graphql", {
    "query": "mutation($provider:String!,$input:String!){ createFlow(modelProvider:$provider, input:$input){ id title status } }",
    "variables": {"provider": "custom", "input": prompt}
}, timeout=300), ensure_ascii=False, indent=2))
