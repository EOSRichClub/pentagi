# PentAGI 自定义部署资源（汉化 / 企微 / 工具）

本目录为相对上游 vxcontrol/pentagi 的运维与汉化补充，来自生产服务器 `/opt/pentagi` 整理导出。

## 内容

- `zh/i18n.js`：前端中文汉化注入脚本（运行时 DOM 翻译）
- `custom-fe/`：已构建的前端静态资源（含汉化后的构建产物）
- `codex-tools/`：
  - `pentagi_wechat_watch.py` 企微机器人自动续跑/监控
  - `provider_secret_api.py` 模型密钥相关辅助
  - `flow_artifact_pack.py` 任务流交付包打包
  - `pentagi-assistant-reaper.sh` 助手清理
- `scripts/`：中文模板、终端重建、工作目录迁移等
- `providers/`：DeepSeek / GLM 等 provider 配置示例
- `docker-compose.custom.yml`：服务器使用的 compose（可能与上游有差异）

## 注意

- **不含** `.env`、API Token、数据库密码等密钥
- 二进制 `custom-bin/pentagi` 体积大，未纳入本仓库，需本地编译或从镜像获取
- 使用 `custom-fe` 时请按你的 nginx/静态目录挂载方式部署，并加载 `zh/i18n.js`（若构建产物已内嵌则可忽略）

## 源码改动

业务源码改动（文件下载/报告导出/状态 UI 等）在仓库根目录 `backend/`、`frontend/` 中，与本目录并列。
