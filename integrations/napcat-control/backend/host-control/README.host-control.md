# Mortis Public Watch Control

## 1. 调整公开范围

直接编辑：

- /home/ubuntu/multica-public-watch/control/public-sync.exclude

规则：

- 一行一个 pattern
- 空行忽略
- `#` 开头是注释
- 改完后手动跑一次：`bash /home/ubuntu/multica-public-watch/control/sync.sh`

## 2. 开启通知

编辑：

- /home/ubuntu/multica-public-watch/control/notify.env

至少填一个真实通道，然后把：

- `NOTIFY_ENABLED=1`

可选通道：

- `webhook`
- `telegram`
- `feishu`
- `email`（通过 Resend API）
- `qqbot`（通过 OpenClaw 自带 qqbot 插件）
- `napcat`（通过个人 QQ 登录后的 NapCat OneBot HTTP）

多个通道可写成：

- `NOTIFY_CHANNELS=telegram,qqbot`

## 3. QQ Bot 最短接法

1. 去 `https://q.qq.com/` 创建 Bot，拿到 `AppID` 和 `AppSecret`。
2. 确认 124 上 `openclaw gateway status` 仍是 running。
3. 用你自己的 QQ 给这个 Bot 发一条消息，让 OpenClaw 在 `/home/ubuntu/.openclaw/qqbot/data/known-users.json` 里记住最近私聊对象。
4. 在 `notify.env` 里填：
   - `NOTIFY_CHANNELS=qqbot` 或 `webhook,qqbot`
   - `QQBOT_APP_ID=...`
   - `QQBOT_CLIENT_SECRET=...`
   - 默认保持 `QQBOT_TARGET_MODE=latest_c2c`
5. 如果你要固定发到某个对象，也可以显式写：
   - `QQBOT_TARGET=qqbot:c2c:<openid>`
   - 或 `QQBOT_TARGET=qqbot:group:<group_openid>`

说明：

- `latest_c2c` 会自动选 `known-users.json` 里最近与你 Bot 私聊过的 QQ 用户。
- `qqbot` 通道在 `NOTIFY_DRY_RUN=1` 时不会只打印 payload，而是实际调用一次 `openclaw message send --dry-run --json`，所以能顺手验证 target / credential 注入链是否通。


## 3.5 NapCat（个人 QQ 登录）最短接法

这条线不是 `q.qq.com` 官方 Bot，而是让 `124` 上的 NapCat 直接登录一个个人 QQ 号，然后由 `notify.py` 调它暴露出来的 OneBot HTTP API。

当前推荐口径：

- NapCat 部署目录：`/home/ubuntu/napcat`
- WebUI 宿主端口：`127.0.0.1:16099`
- OneBot HTTP 宿主端口：`127.0.0.1:3600`
- OneBot WS 宿主端口：`127.0.0.1:3601`

我已把 `notify.py` 扩成支持 `napcat` 通道；你后面只需要完成一次登录和目标 ID 填写。

### 第一步：把 WebUI 隧穿到你本机

在你本机开一个 SSH 隧道：

- `ssh -L 16099:127.0.0.1:16099 -i ~/.ssh/id_rsa ubuntu@124.220.233.126`

然后在本机浏览器打开：

- `http://127.0.0.1:16099/webui`

### 第二步：登录 NapCat

- 容器默认登录 Token 可先看：`sudo -n docker logs napcat | tail -n 50`
- 按 NapCat-Docker 默认文档，默认 Token 一般是：`napcat`
- 用 WebUI 扫码或完成你自己的 QQ 登录

### 第三步：在 NapCat 里启用 OneBot HTTP

建议：

- 启用 OneBot 11 HTTP 服务端
- 容器内监听默认 `3000`
- 设置一个你自己知道的 `access token`
- 宿主机实际访问地址保持：`http://127.0.0.1:3600`

### 第四步：把 notify.env 切到 NapCat

填下面这些：

- `NOTIFY_CHANNELS=napcat` 或 `webhook,napcat`
- `NAPCAT_API_URL=http://127.0.0.1:3600`
- `NAPCAT_ACCESS_TOKEN=<可留空；当前机器默认走 WebUI 代理回退>`
- `NAPCAT_MESSAGE_MODE=private` 或 `group`
- `NAPCAT_USER_ID=<对方 QQ 号>`（private 模式）
- `NAPCAT_GROUP_ID=<目标群号>`（group 模式）
- `NAPCAT_TRANSPORT=webui`（当前机器推荐，避免宿主直连 3600 时的 reset 问题）
- `NAPCAT_WEBUI_URL=http://127.0.0.1:16099`
- `NAPCAT_WEBUI_TOKEN=<可留空；默认从 /home/ubuntu/napcat/data/config/webui.json 读取>`
- `NAPCAT_WEBUI_CONFIG_PATH=/home/ubuntu/napcat/data/config/webui.json`

说明：

- 如果你登录的是“通知专用 QQ 小号”，最常见是 `private` 发给你的主 QQ。
- 如果你坚持登录主号本身，那更实用的目标一般是一个你自己的测试群，而不是“给自己发私聊”。

### 第五步：先做 dry-run

- `NOTIFY_ENABLED=1 NOTIFY_DRY_RUN=1 NOTIFY_CHANNELS=napcat NAPCAT_API_URL=http://127.0.0.1:3600 NAPCAT_MESSAGE_MODE=private NAPCAT_USER_ID=123456 python3 /home/ubuntu/multica-public-watch/control/notify.py --repo-path /home/ubuntu/multica-public-watch/repo --repo-url https://github.com/emptyinkpot/mortis-multica-watch --source /srv/multica --sha $(git -C /home/ubuntu/multica-public-watch/repo rev-parse --short HEAD) --test-message "napcat dry-run"`

真正发信前，把：

- `NOTIFY_DRY_RUN=0`

## 4. 手动测试

无源码变更情况下：

- `bash /home/ubuntu/multica-public-watch/control/sync.sh`

Telegram dry-run 示例：

- `NOTIFY_ENABLED=1 NOTIFY_DRY_RUN=1 NOTIFY_CHANNELS=telegram TELEGRAM_BOT_TOKEN=test TELEGRAM_CHAT_ID=123 python3 /home/ubuntu/multica-public-watch/control/notify.py --repo-path /home/ubuntu/multica-public-watch/repo --repo-url https://github.com/emptyinkpot/mortis-multica-watch --source /srv/multica --sha $(git -C /home/ubuntu/multica-public-watch/repo rev-parse --short HEAD) --test-message "manual dry-run"`

QQ 显式目标 dry-run 示例：

- `NOTIFY_ENABLED=1 NOTIFY_DRY_RUN=1 NOTIFY_CHANNELS=qqbot QQBOT_APP_ID=123456 QQBOT_CLIENT_SECRET=abcdef1234567890abcdef1234567890 QQBOT_TARGET=qqbot:c2c:12345678-1234-1234-1234-123456789abc python3 /home/ubuntu/multica-public-watch/control/notify.py --repo-path /home/ubuntu/multica-public-watch/repo --repo-url https://github.com/emptyinkpot/mortis-multica-watch --source /srv/multica --sha $(git -C /home/ubuntu/multica-public-watch/repo rev-parse --short HEAD) --test-message "qqbot explicit dry-run"`

QQ 自动最近私聊目标 dry-run 示例（前提是 known-users.json 已有数据）：

- `NOTIFY_ENABLED=1 NOTIFY_DRY_RUN=1 NOTIFY_CHANNELS=qqbot QQBOT_APP_ID=123456 QQBOT_CLIENT_SECRET=abcdef1234567890abcdef1234567890 QQBOT_TARGET_MODE=latest_c2c python3 /home/ubuntu/multica-public-watch/control/notify.py --repo-path /home/ubuntu/multica-public-watch/repo --repo-url https://github.com/emptyinkpot/mortis-multica-watch --source /srv/multica --sha $(git -C /home/ubuntu/multica-public-watch/repo rev-parse --short HEAD) --test-message "qqbot latest_c2c dry-run"`

日志：

- sync: `/home/ubuntu/multica-public-watch/control/sync.log`
- notify: `/home/ubuntu/multica-public-watch/control/notify.log`
