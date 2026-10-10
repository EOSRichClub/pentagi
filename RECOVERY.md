# PentAGI 服务器恢复手册

本文档对应 2026-10-11 从阿里云 ECS 实例
`i-f8z64hmn7t1g302fposu`（`cn-heyuan`）采集的运行状态。源码分支、
容器镜像和加密运行数据三者缺一不可。

## 恢复材料

1. Git 分支：`server-backup-2026-10-11`
2. Git 标签：`server-backup-2026-10-11`
3. 镜像清单：`deploy-current/images.lock.json`
4. 加密运行数据：服务器
   `/opt/pentagi-recovery-backups/pentagi-recovery-20261011-0545.tar.enc`
5. 外层校验文件：同目录下的
   `pentagi-recovery-20261011-0545.tar.enc.sha256`
6. 解密口令：保存在管理电脑 macOS 钥匙串的
   `PentAGI Recovery 2026-10-11` 项目中

加密包内包含数据库、Docker 卷、`/opt/pentagi/.env`、服务配置和
运行时检查信息。任何情况下都不要把加密包解密后的内容提交到 Git。

## 重要约束

- `model_credentials.secret` 使用由 `COOKIE_SIGNING_SALT`（以及设置时的
  `TENANT_ID`）派生的密钥加密。因此 PostgreSQL 数据库与原始
  `/opt/pentagi/.env` 必须成对恢复，否则前端保存的模型 API Key 无法解密。
- 恢复时必须使用镜像锁定清单中的 digest，不要仅依赖 `latest`。
- 只操作 PentAGI 的容器、网络和卷；不要删除或覆盖服务器上的其他项目。
- 先完成数据库和卷恢复，再启动 PentAGI。

## 新服务器准备

建议使用 Ubuntu 24.04、Docker Engine 及 Compose v2，并准备至少 100 GB
磁盘空间。安装 OpenSSL 3、`zstd`、PostgreSQL 客户端和 `jq`。

登录 GitHub Container Registry：

```bash
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u EOSRichClub --password-stdin
```

拉取锁定镜像，并验证远端 digest 与
`deploy-current/images.lock.json` 一致。不要把 `GHCR_TOKEN` 写入脚本或
命令历史。

## 解密与校验

外层采用 AES-256-CBC、PBKDF2-HMAC-SHA-256、600000 次迭代加密。从 macOS
钥匙串读取口令时，不要把口令打印到终端。先用旁边的 `.sha256` 文件校验
密文，再解密到权限为 `0700` 的临时目录。解密示例：

```bash
export PENTAGI_BACKUP_PASSPHRASE="$(security find-generic-password \
  -a "$(id -un)" -s 'PentAGI Recovery 2026-10-11' -w)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 \
  -pass env:PENTAGI_BACKUP_PASSPHRASE \
  -in pentagi-recovery-20261011-0545.tar.enc | tar -xpf -
unset PENTAGI_BACKUP_PASSPHRASE
```

解密后先执行内部 `SHA256SUMS` 校验，再按 `MANIFEST.json` 和本文恢复。

解密后应看到：

- `pentagi-recovery-20261011-0545/database/pentagidb.dump`：PostgreSQL
  自定义格式逻辑备份
- `pentagi-recovery-20261011-0545/database/globals.sql`：数据库角色/全局对象
- `pentagi-recovery-20261011-0545/volumes/`：所有 `pentagi_*` 与
  `pentagi-terminal-*` 卷的独立 `.tar.zst`
- `pentagi-recovery-20261011-0545/host/host-config.tar.zst`：运行目录
  （包含未脱敏的 `.env`）、PentAGI 专用 systemd、Nginx、网络出口配置和脚本
- `pentagi-recovery-20261011-0545/runtime/`：容器、网络、卷和镜像检查信息
- `pentagi-recovery-20261011-0545/RECOVERY.md`：本恢复手册副本

## 推荐恢复顺序

1. 校验并解密备份。
2. 将 `host/opt/pentagi` 恢复到 `/opt/pentagi`，权限和所有者保持不变。
3. 恢复 PentAGI 专用的 systemd、Nginx 与 `/usr/local` 脚本，但逐项检查后
   再 `systemctl daemon-reload`。
4. 创建锁定清单中的 Docker 卷，把 `volumes/` 对应内容恢复进去。
5. 只启动 `pgvector`，等待健康检查通过。
6. 使用 `pg_restore --clean --if-exists` 恢复 `pentagidb.dump`；需要时先
   恢复 `globals.sql`。
7. 按 `deploy-current/images.lock.json` 把远端镜像 tag 映射为
   `.env`/Compose 期望的本地 tag。
8. 启动 PentAGI 其余服务，然后启动 PentAGI 专用 systemd 服务和 Nginx。
9. 执行下方验收，不通过时不要清理备份或旧服务器。

## 恢复验收

- `docker compose ps` 中 PentAGI 与 PostgreSQL 健康。
- `https://pentagi.pzcmtech.com/` 可登录。
- 前端“模型 API 密钥”能列出原有条目，且至少一次模型连通性测试成功。
- 前端能看到原任务流、聊天记录、文件和报告。
- 新建一个最小任务流，验证终端容器、固定工具镜像和外网出口。
- 对话助手可以在同一任务流内切换模型，停止原因能显示在窗口中。
- 删除测试任务流时，其对应容器与卷能一并清理。

## 回滚

如果验收失败，停止新服务器上的 PentAGI，保留所有解密数据和日志，不要重新
运行迁移。重新以锁定 digest 创建容器，或回到旧服务器/系统盘快照。确认新环境
完整可用后，才允许删除旧备份。
