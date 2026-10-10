# 当前服务器部署文件

这里保存 2026-10-11 运行中的 PentAGI 自定义部署代码和配置骨架，便于从
Git 仓库重建服务。目录内容已排除 `.env`、数据库、订阅链接、API Key、
SSH 私钥和其他运行时秘密。

- `docker-compose.server.yml`：服务器当前 Compose 结构，秘密由环境变量注入。
- `providers/`：自定义模型提供商结构；令牌字段只引用环境变量或留空。
- `key-manager/`：前端/运维密钥管理辅助服务代码。
- `systemd/`、`sbin/`、`libexec/`：网络出口、并发限制和代理服务。
- `nginx/`：PentAGI 站点反向代理配置。
- `images.lock.json`：自定义镜像的不可变身份与远端位置。

真实秘密只进入加密运行数据备份，绝不进入这个公共仓库。
