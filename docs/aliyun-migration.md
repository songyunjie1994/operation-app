# 阿里云部署与切换（2026-10-28）

正式运营入口：`https://39.105.205.48/ops/`。采集控制台：`https://39.105.205.48/collector-console/`。

原 GitHub Pages 入口自动跳转，并保留查询参数和页面片段。阿里云页面使用相同界面及权限规则，按用户要求仅提供账号密码登录；原账号密码继续有效。

## 服务器

- ECS 北京，现有实例 `i-2ze4ocieuvi0wmsrxeoy`。
- 应用目录 `/opt/anbito-ops`，五个容器：db/auth/rest/storage/functions。
- 网关配置 `/etc/nginx/conf.d/anbito-public.conf`，内部网关 `/etc/nginx/conf.d/anbito-backend-internal.conf`。
- 证书 `/etc/letsencrypt/live/anbito-ip/`，短期 IP 证书每小时检查续期，带有限重试；服务 `anbito-certbot-renew.timer`。
- 原 `/opt/cost-app` 独立保留，其业务数据校验未变。

寄样管理继续使用原 Supabase，与本次迁移的25张业务/控制表分开；源 Supabase 业务数据暂作回退快照保留，不应未经核验清理。

## 采集机

运行版本1.4.68，源码提交 `4d2dbe9709f67ce230e93be83725acce746a605b`，控制、投流读写、账户中心地址均已切换。设备身份及登录档案保留。

投流每日03:00、账户中心每日09:00（北京时间），计划版本13。迁移只验证通道及读写授权，没有重新启动投流或账户中心全量采集。

设备本地回退配置：`state/deploy.json.pre-aliyun-20261028`、账户中心 `auto/cloud-device.json.pre-aliyun-20261028`。这些文件含私密配置，不得上传到Git或公开网页。回退需要同步协调网页、控制和数据端，避免新旧数据库分别接收写入。

## 凭据与发版

服务器 `.env`、迁移证据目录 `private/` 包含凭据，只能私密保存。公开前端仅有公开匿名密钥。现有开发机 `collector-secrets/anbito-service-role.txt` 仍是旧 Supabase 凭据，不能用来向阿里云发布。

后续采集机发版必须显式指定新的 `QCA_SUPABASE_URL=https://39.105.205.48` 及阿里云服务密钥，不能沿用旧发布脚本的默认源项目。当前设备的 `state/deploy.json` 中 `cloud.functionUrl` 和 `cloud.trafficUrl` 是已迁移地址。

完整备份和验收证据在开发机 `D:/AI数据存放/codex/outputs/aliyun-migration-20261028`，包括源数据清单、逐表摘要核对、204文件哈希、真实网页逐日明细、凭证签名下载、设备迁移标记与诊断回执。该目录的 `private/` 不得加入仓库。
