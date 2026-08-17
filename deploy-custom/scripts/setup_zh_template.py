
import json, urllib.request, ssl, http.cookiejar
ctx = ssl._create_unverified_context()
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), urllib.request.HTTPCookieProcessor(cj))
BASE = "https://127.0.0.1:8443"

def post(path, data):
    req = urllib.request.Request(BASE+path, data=json.dumps(data).encode(), headers={"Content-Type":"application/json"}, method="POST")
    try:
        return json.loads(opener.open(req, timeout=30).read().decode())
    except Exception as e:
        body = e.read().decode() if hasattr(e, "read") else str(e)
        return {"error": str(e), "body": body}

opener.open(urllib.request.Request(
    BASE+"/api/v1/auth/login",
    data=json.dumps({"mail":"admin@pentagi.com","password":"PentAGI@YunShang2026"}).encode(),
    headers={"Content-Type":"application/json"}, method="POST"))

prompt = """对目标 Web 应用进行授权渗透测试（资产归属本人/已获书面授权）。

目标 URL: https://www.yunshanghl.com/login?redirect=%2Fdata
测试范围: https://www.yunshanghl.com 及其直接相关 API/子路径。

规则与要求:
1. 仅测试上述域名，禁止攻击第三方与内网无关资产。
2. 全程使用中文输出：任务拆解、过程说明、最终报告都必须是中文。
3. 重点检查：认证绕过、登录逻辑、redirect 参数、会话管理、越权、注入、XSS、SSRF、文件上传、敏感信息泄露。
4. 优先从登录页与 redirect 参数切入。
5. 每个发现需包含：风险等级、复现步骤、证据摘要、修复建议。
6. 禁止破坏性操作（删库、大规模 DoS、真实业务数据篡改）。
7. 最终输出完整中文渗透测试报告。

请按：信息收集 → 端点枚举 → 漏洞检测 → 手工验证 → 中文报告 执行。"""

print("template", post("/api/v1/graphql", {
    "query": "mutation($input: CreateFlowTemplateInput!){ createFlowTemplate(input:$input){ id title } }",
    "variables": {"input": {"title": "云商互联-中文Web渗透", "text": prompt}}
}))
print("list", post("/api/v1/graphql", {"query": "{ flowTemplates { id title } }"}))
print("flow gql", post("/api/v1/graphql", {
    "query": "mutation($provider:String!,$input:String!){ createFlow(modelProvider:$provider, input:$input){ id title status } }",
    "variables": {"provider": "custom", "input": prompt}
}))
print("flow rest", post("/api/v1/flows/", {"input": prompt, "provider": "custom"}))
# inspect createFlow args
print("createFlow", post("/api/v1/graphql", {"query": "{ __type(name: \"Mutation\") { fields { name args { name type { name kind ofType { name kind ofType { name } } } } } } }"}))
