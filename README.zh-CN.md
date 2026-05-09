---
title: Multica private fork
status: canonical-translation
sourceDoc: README.md
language: zh-CN
---

# Multica Private Fork
## Mortis operator-runtime extensions、私有部署与自托管手册（中文同步版）

> 版本定位：本文件是 `README.md` 的中文同步版，服务于中文读者的 control-plane 阅读与运维理解。
> 文档策略：结构、事实层和入口说明应与 `README.md` 对齐；若发现不一致，以 `README.md` 和 `project.json` 为准，并应回补本文件。
> 冲突处理：本文件不定义独立真相，只翻译和同步当前 canonical 英文/主文档事实。

## 0. 项目说明入口

```yaml
projectName: Multica private fork
forkCodename: Mortis
canonicalDoc: README.md
canonicalChineseDoc: README.zh-CN.md
machineReadableEntry: project.json
localSourceRoot: none; local checkout retired
remoteFirstSourceRoot: ubuntu@124.220.233.126:/srv/multica
githubRepo: https://github.com/emptyinkpot/mortis-multica-source
upstreamRuntimeFoundationRepo: https://github.com/multica-ai/multica
defaultBranch: main
localBranch: main
publicAppUrl: https://mortis.tengokukk.com
publicAboutUrl: https://mortis.tengokukk.com/about
legacyRedirectHost: https://golutra.tengokukk.com
privateDeploymentNotes: MORTIS_PRIVATE_DEPLOYMENT_NOTES.md
selfHostingGuide: SELF_HOSTING.md
selfHostingAdvancedGuide: SELF_HOSTING_ADVANCED.md
selfHostingAiGuide: SELF_HOSTING_AI.md
contributingGuide: CONTRIBUTING.md
cliAndDaemonGuide: CLI_AND_DAEMON.md
repositoryRules: AGENTS.md
repositoryDeepRules: CLAUDE.md
privateServerHost: 124.220.233.126
privateServerRuntimeRoot: /srv/multica
privateServerBackendBind: 127.0.0.1:8088
privateServerFrontendBind: 127.0.0.1:3300
selfHostComposeFile: docker-compose.selfhost.yml
localDevBackendUrl: http://localhost:8080
localDevFrontendUrl: http://localhost:3000
localDatabaseUrl: postgres://multica:multica@localhost:5432/multica?sslmode=disable
localDevEntry: make dev
localSetupEntry: make setup
localCheckEntry: make check
selfHostEntry: make selfhost
daemonBinaryDeployEntry: make deploy-daemon-binary
replicationRunbookSection: README.zh-CN.md#0.2.1
machineReadableReplicationRunbook: project.json#replicationRunbook
```

- 这是中文读者理解 `Multica private fork` 当前源码、私有部署与自托管入口的同步文档。
- 机器优先读取 `project.json`；人类优先读取 `README.md`，中文读者可配合本文件阅读。
- 当前共同源码工作地是服务器 `ubuntu@124.220.233.126:/srv/multica`。默认所有代码、文档、部署相关修改都应先在远端 `/srv/multica` 完成、远端验证、远端提交并推送到 GitHub。
- 本机 `E:\My Project\Mortis` 已退役并删除，不再作为默认修改端、真相源或生产修复入口；如临时重新 clone，只能作为同步副本，不能绕过远端工作流。
- 旧 `E:\My Project\Mortis-deploy-l3` worktree 已合并进 `main` 并退役，不再作为生产修复或文档修改入口。完整规则见 `docs/source-roots.json`。
- 当前仓库不是完全脱离 `Multica` 的新系统，而是“以 `Multica` 为运行基础、以 `Mortis` 为私有部署外观与产品叙事”的分叉源码仓。

### 0.1 对外简介

这个仓库是 `Multica` 的私有复刻分支；`Mortis` 是其中围绕“一个操作者 + 一组长期运行代理”的私有指挥工作台。它保留 `Multica` 的 Issue、Workspace、Daemon、CLI、Skill 和 Agent 工作流，但把多用户公开产品叙事，收束成单操作者、私有部署、长期代理协作和私有控制面的运行模式。

### 0.2 快速开始

- 项目名：`Multica private fork`
- Fork codename：`Mortis`
- GitHub：`https://github.com/emptyinkpot/mortis-multica-source`
- 上游运行基础：`https://github.com/multica-ai/multica`
- 默认共同源码工作地：`ubuntu@124.220.233.126:/srv/multica`
- 本机源码副本：无；如重新 clone，仅作同步副本
- 当前公开主入口：`https://mortis.tengokukk.com`
- 当前公开 About：`https://mortis.tengokukk.com/about`
- 历史重定向入口：`https://golutra.tengokukk.com`
- 私有部署说明：`MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
- 自托管说明：`SELF_HOSTING.md`
- 本地开发总入口：`make dev`
- 本地完整校验入口：`make check`
- 自托管一键入口：`make selfhost`

### 0.2.1 从零复刻 Runbook

本节同步 `README.md` 的复刻路径，目标是让没有本机上下文的人可以复刻本地开发环境或通用自托管环境。当前私有生产环境的域名、端口、反向代理和单操作者配置仍以 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` 为准。

#### A. 前置依赖

| 依赖 | 推荐版本 / 要求 | 说明 |
| --- | --- | --- |
| `git` | 当前稳定版 | 拉取源码 |
| `Node.js` | `22` 推荐，`20+` 可用于本地开发 | CI 使用 Node 22 |
| `pnpm` | `10.28.2` | 由 `package.json` 的 `packageManager` 固定 |
| `Go` | `1.26+` | CI 使用 `1.26.1` |
| `Docker` + Compose | 当前稳定版 | 本地 PostgreSQL 与自托管 Compose |
| `openssl` | 当前稳定版 | `make selfhost` 生成 `JWT_SECRET` 时使用 |

#### B. 拉取源码

```bash
git clone https://github.com/emptyinkpot/mortis-multica-source.git
cd mortis-multica-source
```

本机工作副本源码根：无；本机 `E:\My Project\Mortis` 已退役。默认共同源码工作地是 `ubuntu@124.220.233.126:/srv/multica`。

#### C. 本地开发复刻

```bash
cp .env.example .env
make dev
```

`make dev` 会检查依赖、安装 pnpm 依赖、确保 PostgreSQL、运行 migration，并启动 Go backend 与 Next.js frontend。

默认访问入口：

- Web：`http://localhost:3000`
- Backend：`http://localhost:8080`
- WebSocket：`ws://localhost:8080/ws`
- Database：`postgres://multica:multica@localhost:5432/multica?sslmode=disable`

分步启动：

```bash
make setup
make start
```

#### D. 自托管复刻

```bash
cp .env.example .env
# 必须把 JWT_SECRET 改成随机强密钥；make selfhost 在缺少 .env 时会自动生成。
make selfhost
```

自托管 Compose 使用：

- `docker-compose.selfhost.yml`
- `pgvector/pgvector:pg17`
- backend：`127.0.0.1:8080`
- frontend：`127.0.0.1:3000`

停止：

```bash
make selfhost-stop
```

#### E. 登录与首轮验证

登录验证码路径：

1. 生产式路径：配置 `.env` 里的 `RESEND_API_KEY`，通过邮件收验证码。
2. 本地评估路径：设置 `APP_ENV=development`，使用验证码 `888888`。
3. 临时调试路径：查看 backend 日志里打印的验证码。

首轮验收：

```bash
pnpm typecheck
pnpm test
make test
make check
```

最小功能验收：

1. Web 能打开 `http://localhost:3000`
2. 登录后能进入 workspace
3. Settings / Runtimes 能看到 daemon 或 runtime 状态
4. 能创建 issue
5. 给 agent 分配 issue 后，daemon 能接收任务

#### F. CLI / daemon 复刻

当前 CLI 名称仍是 `multica`，这是兼容现实，不是 README 遗漏。

```bash
make cli MULTICA_ARGS="config"
make daemon
```

详细说明见：

- `CLI_AND_DAEMON.md`
- `SELF_HOSTING.md`

#### G. 私有 Mortis 生产复刻边界

| 场景 | Backend | Frontend |
| --- | --- | --- |
| 本地开发 | `:8080` | `:3000` |
| 通用自托管 Compose | `:8080` | `:3000` |
| 当前私有生产记录 | `127.0.0.1:8088` | `127.0.0.1:3300` |

真正复刻当前私有生产，还需要补齐私有服务器上的反向代理、域名证书、单操作者自动登录变量、daemon binary 刷新流程和外部控制面挂载。统一读取：

- `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
- `SELF_HOSTING.md`
- `SELF_HOSTING_ADVANCED.md`
- `CLI_AND_DAEMON.md`

#### H. 复刻完成定义

1. `make dev` 或 `make selfhost` 能启动完整服务
2. Web / backend / database 三者端口与 `.env` 一致
3. migration 成功
4. 可以登录并进入 workspace
5. `pnpm typecheck`、`pnpm test`、`make test` 至少可分别运行
6. 若目标是私有生产复刻，已按 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` 补齐生产端口、域名、反向代理和 daemon binary 流程

#### I. 最小环境变量矩阵

| 变量 | 本地开发 | 通用自托管 | 当前私有生产 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 默认 localhost PostgreSQL | Compose 内部 PostgreSQL | 以私有服务器 `.env` 为准 |
| `JWT_SECRET` | 可使用示例值 | 必须改成强随机值 | 必须使用私有强密钥 |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | `http://localhost:3000` 或自定义域名 | `https://mortis.tengokukk.com` |
| `MULTICA_APP_URL` | `http://localhost:3000` | `http://localhost:3000` 或自定义域名 | `https://mortis.tengokukk.com` |
| `CORS_ALLOWED_ORIGINS` | 通常留空 | 分离域名时设置 | 必须匹配公开入口 |
| `RESEND_API_KEY` | 可留空，走 dev code / 日志验证码 | 推荐配置 | 生产应配置真实邮件 |
| `APP_ENV` | 可为 `development` | 默认 `production` | 不应设成公开可用的 `development` |
| `MULTICA_AUTO_LOGIN_*` | 通常留空 | 按需 | 私有单操作者模式需要按部署说明设置 |
| `NEXT_PUBLIC_AUTO_LOGIN_WORKSPACE_SLUG` | 通常留空 | 按需 | 私有单工作区入口需要与 backend slug 一致 |

#### J. 常见失败点

| 现象 | 优先检查 |
| --- | --- |
| Web 打不开 | `FRONTEND_PORT` 是否被占用，`pnpm dev:web` 是否启动 |
| Backend health 失败 | `PORT` 是否被占用，migration 是否成功，`DATABASE_URL` 是否可连 |
| 登录收不到验证码 | `RESEND_API_KEY` / backend 日志 / `APP_ENV=development` 是否符合当前场景 |
| WebSocket 不连 | `NEXT_PUBLIC_WS_URL`、`MULTICA_SERVER_URL`、反向代理 WebSocket upgrade |
| CLI daemon 连接不上 | `multica config`、`MULTICA_SERVER_URL`、登录 token、daemon status |
| 私有部署端口混乱 | 不要混用 `8080/3000` 和 `8088/3300`；按运行场景读取端口 |
| 控制面页面为空 | 检查 `ATRAMENTI_CONTROL_PLANE_HOST_PATH` 与容器挂载目标 |

### 0.3 仓库信息卡

| 项目 | 值 |
| --- | --- |
| GitHub 仓库 | `https://github.com/emptyinkpot/mortis-multica-source` |
| 上游运行基础仓 | `https://github.com/multica-ai/multica` |
| 默认分支 | `main` |
| 本机工作分支 | `main` |
| 长期源码真源 | GitHub 仓库 |
| 默认共同源码工作地 | `ubuntu@124.220.233.126:/srv/multica` |
| 本机目录 | 无；`E:\My Project\Mortis` 已删除，临时 clone 只能作为同步副本 |
| 私有运行目录 | `/srv/multica` |
| 私有部署宿主机 | `124.220.233.126` |
| 本地开发模式 | `Go backend + Next.js web + PostgreSQL + pnpm workspace + Turborepo` |
| 私有部署模式 | `Mortis 品牌外观 + Multica 兼容运行基础 + Docker web stack + multica daemon binary` |

### 0.4 仓库卫生与运行入口

- 人类文档入口：`README.md`
- 中文同步入口：`README.zh-CN.md`
- 机器入口：`project.json`
- 私有部署事实补充：`MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
- 自托管入口文档：`SELF_HOSTING.md`
- 贡献说明：`CONTRIBUTING.md`
- CLI / daemon 说明：`CLI_AND_DAEMON.md`
- 规则入口：`AGENTS.md`
- 深层实现约束：`CLAUDE.md`
- 本地开发一键入口：`make dev`
- 本地初始化入口：`make setup`
- 本地启动入口：`make start`
- 本地停止入口：`make stop`
- 本地校验入口：`make check`
- 自托管一键入口：`make selfhost`
- 自托管停止入口：`make selfhost-stop`
- Docker 自托管编排：`docker-compose.selfhost.yml`
- daemon 二进制部署入口：`make deploy-daemon-binary`

## 1. Truth Layer

本层只写当前真实运行边界、当前仓库结构和当前可确认的部署约定；不把迁移目标或品牌文案写成实现事实。

### 1.1 当前运行模型

`Mortis` 当前要明确区分三套运行视角：

```text
A. 本地源码开发
   E:\My Project\Mortis
   -> make dev
   -> backend :8080
   -> frontend :3000

B. 仓库支持的自托管 Compose
   docker-compose.selfhost.yml
   -> postgres
   -> backend :8080
   -> frontend :3000

C. 当前私有生产/运营部署
   https://mortis.tengokukk.com
   -> /srv/multica
   -> backend bind 127.0.0.1:8088
   -> frontend bind 127.0.0.1:3300
```

- 本地源码开发默认使用 `.env.example` 里的 `8080/3000/5432`
- 自托管 Compose 默认同样是 `8080/3000/5432`
- 当前私有部署不等于默认 Compose 端口；私有运行绑定记录是 `127.0.0.1:8088` 和 `127.0.0.1:3300`
- `https://mortis.tengokukk.com` 是公开品牌主入口
- `https://golutra.tengokukk.com` 只是历史 redirect 层

### 1.2 当前本地开发事实

基于 `.env.example`、`Makefile` 和脚本链可确认：

- 默认数据库：`postgres://multica:multica@localhost:5432/multica?sslmode=disable`
- 默认后端端口：`8080`
- 默认前端端口：`3000`
- 默认前端来源：`http://localhost:3000`
- 默认 WebSocket：`ws://localhost:8080/ws`
- 默认本地上传目录：`./data/uploads`
- `make dev` 会自动检查依赖、处理 `.env` / `.env.worktree`、确保 PostgreSQL、跑 migration、启动 backend + frontend

### 1.3 当前私有部署事实

以下事实来自 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`：

- 主入口：`https://mortis.tengokukk.com`
- 历史重定向：`https://golutra.tengokukk.com`
- 运行目录：`/srv/multica`
- 本地后端绑定：`127.0.0.1:8088`
- 本地前端绑定：`127.0.0.1:3300`
- 固定操作者身份：`emptyinkpot <emptyinkpot@users.noreply.github.com>`
- 固定默认工作区：`Mortis`
- 固定默认工作区 slug：`mortis`
- 私有部署快捷入口：
  - Web stack：`docker compose -f docker-compose.selfhost.yml up -d --build`
  - daemon binary：`make deploy-daemon-binary`

### 1.4 当前自托管事实

基于 `docker-compose.selfhost.yml` 可确认当前自托管 Compose 默认包括：

- `postgres`：`pgvector/pgvector:pg17`
- `backend`：默认绑定 `127.0.0.1:8080`
- `frontend`：默认绑定 `127.0.0.1:3000`
- 默认数据库名 / 用户 / 密码：`multica / multica / multica`
- 默认自托管访问：
  - `http://localhost:3000`
  - `http://localhost:8080`

### 1.5 当前品牌 / 兼容层事实

- 已切到 `Mortis` 的层：
  - 公开域名和公开页面品牌
  - landing / about / workspace 的可见文案
  - 单操作者私有部署叙事
- 仍保留 `Multica` 的层：
  - CLI 名称 `multica`
  - pnpm 包名前缀 `@multica/*`
  - Go import path
  - cookie 名称
  - Compose / 数据库 / 部分内部运行标识

## 2. 项目结构与模块边界

### 2.1 顶层结构

| 路径 | 责任 |
| --- | --- |
| `apps/web/` | Next.js Web 前端 |
| `apps/desktop/` | Electron 桌面端 |
| `apps/docs/` | 文档站源码 |
| `server/` | Go 后端、daemon CLI、migrations、sqlc 查询 |
| `packages/core/` | 核心业务逻辑、API client、query/store、类型 |
| `packages/ui/` | 原子 UI 组件 |
| `packages/views/` | 共享业务页面 / 组件 |
| `docs/` | 架构、计划、排障补充文档 |
| `e2e/` | 端到端测试 |
| `scripts/` | 安装、开发、部署、辅助脚本 |
| `.github/workflows/` | CI / release 工作流 |
| `.codex/` | 本地 AI 协作账本与工作流状态 |

### 2.2 关键技术栈

| 层 | 当前栈 |
| --- | --- |
| Web 前端 | `Next.js` + `pnpm workspace` + `Turborepo` |
| 桌面端 | `Electron` |
| 后端 | `Go` + `Chi` + `gorilla/websocket` + `sqlc` |
| 数据库 | `PostgreSQL 17` + `pgvector` |
| 本地代理运行时 | `multica daemon` |
| 测试 | `Vitest` + `Go test` + `Playwright` |

### 2.3 关键架构规则

- `React Query` 负责所有 server state
- `Zustand` 负责 client-only state
- `packages/core/` 不应直接依赖 `react-dom` / `localStorage` / `process.env`
- `packages/ui/` 不应导入 `@multica/core`
- `packages/views/` 不应直接使用 `next/*` 或 `react-router-dom`
- `apps/web/platform/` 是 Next.js 平台适配层

## 3. 命令与运行入口

### 3.1 开发入口

```bash
make dev
```

### 3.2 常用开发命令

| 命令 | 作用 |
| --- | --- |
| `make setup` | 安装依赖、起数据库、跑 migration |
| `make start` | 启动 backend + web |
| `make stop` | 停止本地 backend/web 进程 |
| `make check` | 全量校验 |
| `make test` | Go tests |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | TS / 前端单测 |
| `make server` | 仅跑 Go backend |
| `make daemon` | 重启本地 daemon |
| `make cli MULTICA_ARGS=\"...\"` | 透传 CLI 子命令 |

### 3.3 自托管入口

```bash
make selfhost
```

- 基于 `docker-compose.selfhost.yml`
- 默认本地入口：
  - `http://localhost:3000`
  - `http://localhost:8080`

停止：

```bash
make selfhost-stop
```

### 3.4 安装脚本入口

| 路径 | 语义 |
| --- | --- |
| `scripts/install.sh` | macOS / Linux CLI / self-host 安装脚本 |
| `scripts/install.ps1` | Windows CLI / self-host 安装脚本 |
| `scripts/dev.sh` | 本地源码开发一键脚本 |
| `scripts/deploy-daemon-binary.sh` | 私有部署 daemon binary 刷新脚本 |

## 4. 私有部署与运维约束

### 4.1 当前私有部署快捷入口

```bash
cd /srv/multica
docker compose -f docker-compose.selfhost.yml up -d --build
```

以及：

```bash
cd /srv/multica
make deploy-daemon-binary
```

### 4.2 当前入口分层结论

#### Canonical

- `README.md`
- `README.zh-CN.md`
- `project.json`
- `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
- `SELF_HOSTING.md`
- `docker-compose.selfhost.yml`
- `make selfhost`
- `make deploy-daemon-binary`

#### Compatibility

- `CLI_AND_DAEMON.md` 中的 `multica setup self-host`
- `scripts/install.sh`
- `scripts/install.ps1`
- 仓库内仍保留的 `Multica` 命名 CLI / 包名 / import path

#### Legacy / 辅助

- `https://golutra.tengokukk.com`
- 任何把默认 `8080/3000` 误写成私有生产端口的旧理解
- 任何把 `Mortis` 描述成“已完全去 Multica 化”的旧叙事

### 4.3 daemon binary 刷新后的快速检查

建议检查 journal 关键标记：

- `mode=openclaw-health`
- `next_mode=openclaw-full-agent-fallback`
- `mode=openclaw-full-agent-fallback`

## 5. 开发与验证顺序

### 5.1 推荐顺序

```bash
make dev
```

如需分步：

```bash
make setup
make start
make check
make stop
```

### 5.2 当前推荐验证顺序

1. `pnpm typecheck`
2. `pnpm test`
3. `make test`
4. `make check`
5. 若涉及私有部署，再参考 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`

### 5.3 worktree 语义

- 主 checkout 通常用 `.env`
- git worktree 默认用 `.env.worktree`
- `scripts/dev.sh` 会自动识别并生成 `.env.worktree`

## 6. 文档与控制面地图

| 文档 / 文件 | 作用 |
| --- | --- |
| `README.md` | 当前 canonical 人类说明入口 |
| `README.zh-CN.md` | 中文同步版 |
| `project.json` | machine-readable 项目入口 |
| `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` | 私有部署事实与快捷操作 |
| `SELF_HOSTING.md` | 自托管使用说明 |
| `SELF_HOSTING_ADVANCED.md` | 自托管高级配置补充，属于 compatibility / 深度说明 |
| `SELF_HOSTING_AI.md` | 面向 AI agent 的自托管快捷执行说明，属于 compatibility / helper 文档 |
| `docs/private-deployment-file-audit.md` | 私有部署文件分层审计：保留 / 合并 / legacy 结论 |
| `CONTRIBUTING.md` | 开发贡献流程 |
| `CLI_AND_DAEMON.md` | CLI / daemon 使用说明 |
| `AGENTS.md` | 仓库级 AI 规则入口 |
| `CLAUDE.md` | 深层实现约束 |
| `docs/` | 架构 / 计划 / 排障补充文档 |

## 7. 当前项目整理结论

- `Mortis` 现在已经能清晰拆成三层：
  - 源码层：`Mortis` fork on top of `Multica`
  - 开发层：monorepo + Go backend + Next.js + PostgreSQL
  - 运行层：私有单操作者部署 + Compose 自托管兼容
- 当前最应该保留为 canonical 的私有部署入口是：
  - `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
  - `docker-compose.selfhost.yml`
  - `make selfhost`
  - `make deploy-daemon-binary`
- 当前更适合作为 compatibility，而不是私有部署主入口的内容是：
  - `multica setup self-host`
  - 安装脚本里面向上游 `Multica` 的叙事
- 当前更适合作为 legacy 的是：
  - `golutra.tengokukk.com`
  - “Mortis 已完全去 Multica 化”的说法

## 8. Role AI 职务组织 MVP

`Manager AI` 不再是孤立页面，而是 `Role AI` 职务系统里的第一个内置职务。目标是把 Mortis 从“多个 AI 工具”继续升级成“可配置 AI 组织系统”：

```text
QQ / Web / 内部群聊
↓
Conversation Bus
↓
Role Router
↓
Role Registry
↓
Manager / Builder / Tester / 财务 / 运维 / 研究员
↓
Workflow / Issue / Approval / Audit
↓
Codex / daemon / CLI / 外部工具
```

核心规则：`Role` 不是 `Agent`。职务定义职责、禁止事项、权限、默认 runtime、允许渠道、审批策略和 system prompt；Agent / daemon / CLI 是后续绑定的执行器。

当前最小落点：

| 层 | 当前路径 / 入口 |
| --- | --- |
| 设计文档 | `docs/role-ai-organization.md` |
| 后端职务定义 | `server/internal/roles/` |
| 数据表 | `server/migrations/051_role_ai_org_mvp.*.sql` |
| API | `/api/roles`、`/api/roles/route-message`、`/api/roles/invocations` |
| Core 类型 / Query | `packages/core/roles/`、`packages/core/types/role.ts` |
| UI | `packages/views/roles/`、`packages/views/manager/` |
| Web 入口 | `/:workspaceSlug/roles`、`/:workspaceSlug/manager` |
| Desktop 入口 | desktop workspace route `/:workspaceSlug/roles`、`/:workspaceSlug/manager` |

当前内置职务：

- `manager`：规划、拆分、路由、申请批准、汇报
- `builder`：只执行已批准范围
- `tester`：独立验证并给出 passed / failed / blocked

QQ / Web / 内部群聊输入会先进入 Role Router。显式 `@manager`、`@tester`、`@finance` 会路由到对应职务；没有显式职务时默认进入 Manager。部署、删除、付款、生产配置等高风险自然语言命令只会生成结构化 action 和 approval request，不会直接执行。

### 8.1 Manager 页面当前定位

`/:workspaceSlug/manager` 不是旧的 Manager issue 发布器。它只做三件事：

1. 展示内置 `manager` 职务定义
2. 把消息提交给 `Role Router`
3. 展示 `manager` 职务调用记录

页面不会回退到旧 Manager issue 创建流程；如果 Role Registry 没有内置 `manager` 职务，页面直接显示配置错误。

### 8.2 当前验收

1. Operator 能进入 `AI 职务` 页面查看 Manager / Builder / Tester
2. Operator 能进入 `Manager 职务` 页面向 `@manager` 下命令
3. `@manager` 消息必须走 `/api/roles/route-message`
4. 高风险消息必须生成 approval request
5. Manager 页面不得直接调用 `/api/manager/plan`
6. Manager 页面不得创建 legacy Manager / Builder / Tester issues
7. `project.json.roleAiOrganizationMvp` 能被机器读取

## 9. 旧 Manager MVP 记录

`Manager AI MVP` 已被 `Role AI` 职务组织取代。旧 `server/internal/manager`、`/api/manager/*` 和 core manager 导出已从源码入口移除；`050_manager_ai_mvp` 迁移文件只保留给既有数据库历史，不再代表可用功能。

## 10. L3 自动执行边界

`Mortis` 下一阶段目标是从 L2 半自动执行进入 L3：AI 可以自动推进已批准的小任务，但不能自动部署生产。

```text
Operator goal
-> Manager Role routes and requests approval
-> Operator approves role action
-> Dispatcher claims approved Builder action
-> Builder runtime clones repo and creates branch
-> Codex executes approved scope
-> Builder commits result
-> Tester verifies independently
-> Manager reports
-> Operator decides merge/deploy
```

当前源码已经落下第一层生产形状：

| 层 | 路径 / 开关 |
| --- | --- |
| Dispatcher loop | `server/internal/roles/dispatcher.go` |
| Runtime boundary | `server/internal/roles/execution.go` |
| Builder runtime | `server/internal/roles/builder_runtime.go` |
| SQL action store | `server/internal/roles/sql_store.go` |
| Command runner | `server/internal/roles/runner.go` |
| Server startup gate | `MORTIS_ROLE_DISPATCHER_ENABLED=false` by default |
| Work root | `MORTIS_AGENT_WORK_ROOT=/srv/multica/agent-workspaces` |
| QQ completion notifier | `server/internal/qqbridge/notifier.go` |

安全边界：

1. Dispatcher 默认关闭，必须显式设置 `MORTIS_ROLE_DISPATCHER_ENABLED=true`
2. 只领取 `approved` 且 role 为 `builder` 的 Role action
3. 代码改动发生在独立 work root 下的 fresh clone
4. Builder 创建 `mortis/action-<id>` 分支并本地 commit
5. Builder 不 push main、不 merge、不部署
6. Tester 仍需要独立验证，生产部署仍由 operator 或独立 deploy gate 执行

### 10.1 L3 配置

```env
MORTIS_ROLE_DISPATCHER_ENABLED=false
MORTIS_ROLE_REPO_URL=git@github.com:emptyinkpot/mortis-multica-source.git
MORTIS_ROLE_LOCAL_REPO_PATH=/srv/multica
MORTIS_ROLE_BASE_BRANCH=main
MORTIS_AGENT_WORK_ROOT=/srv/multica/agent-workspaces
MORTIS_CODEX_BIN=codex
MORTIS_CODEX_TIMEOUT_SECONDS=900
MORTIS_CODEX_DANGEROUSLY_BYPASS_SANDBOX=false
MORTIS_ROLE_DISPATCH_INTERVAL_SECONDS=2
MORTIS_ROLE_GIT_USER=Mortis Builder AI
MORTIS_ROLE_GIT_EMAIL=builder@mortis.local
MORTIS_ROLE_GIT_SSH_KEY_PATH=/home/ubuntu/.ssh/mortis_multica_source_ed25519
MORTIS_ROLE_GIT_KNOWN_HOSTS_PATH=/home/ubuntu/.ssh/known_hosts
GIT_SSH_COMMAND=ssh -i /root/.ssh/mortis_role_key -o IdentitiesOnly=yes -o UserKnownHostsFile=/root/.ssh/known_hosts
```

启用前必须确认：

1. 目标主机上的 `codex` CLI 调用方式与 `builder_runtime.go` 中的 invocation 一致
2. `MORTIS_AGENT_WORK_ROOT` 不指向源码根或生产运行根
3. Git 凭证只能 push feature branch，不能直接 push protected main
4. Role action 的 payload 中 objective、acceptance criteria 和 test commands 足够明确
5. 生产部署仍由 operator 或独立 deploy gate 执行

### 10.2 QQ → AI → QQ 最小闭环

当前源码支持的最小长期闭环：

```text
QQ bridge 收到操作者消息
-> POST /api/roles/route-message?workspace_slug=mortis，channel=qq
-> Role Router 创建 conversation_message、role_invocation、role_action
-> 低风险 action 可由策略或操作者批准
-> Dispatcher 执行 approved Builder action
-> role_invocations.result 写入 execution_report
-> QQ completion notifier 通过 OneBot 回发消息
-> role_invocations.result 标记 qq_notified_at
```

QQ 入口不是执行权限本身。QQ bridge 只负责把消息转成 Role Router 输入；高风险命令仍会生成 approval request。完成回推由 `server/internal/qqbridge/notifier.go` 处理。源码默认关闭；当前生产 `/srv/multica` 已显式开启入站、回推、dispatcher 和低风险 Builder auto-approve。

生产可用的 QQ 入站 webhook：

```http
POST /api/qq/onebot?secret=<MORTIS_QQ_INBOUND_SECRET>
```

NapCat OneBot11 `httpClients` 可把消息事件推到这个地址。Mortis 会读取 `message` 事件，写入 `conversation_threads`、`conversation_messages`、`role_invocations`、`role_actions`，再按 role router 选择 `@manager` / `@builder` / `@tester`。当 `MORTIS_QQ_INBOUND_AUTO_APPROVE_LOW_RISK=true` 且消息路由到低风险 `builder` 时，action 会直接进入 `approved`，由 dispatcher 执行。

QQ bridge 调用示例：

```http
POST /api/roles/route-message?workspace_slug=mortis
Content-Type: application/json

{
  "channel": "qq",
  "external_thread_key": "qq:group:<group_id>",
  "external_message_id": "<qq_message_id>",
  "metadata": {
    "qq_target_type": "group",
    "qq_target_id": "<group_id>"
  },
  "content": "@builder implement a small approved task"
}
```

完成后回 QQ 的最小配置：

```env
MORTIS_QQ_ONEBOT_HTTP_URL=http://napcat-qq1:3000
MORTIS_QQ_ONEBOT_HTTP_URLS={"3974470627":"http://napcat-qq1:3000","3316734532":"http://napcat-qq3:3000","3615811141":"http://napcat-qq2:3000","2264869713":"http://napcat-qq4:3000"}
MORTIS_QQ_NOTIFY_ENABLED=false
MORTIS_QQ_NOTIFY_INTERVAL_SECONDS=5
MORTIS_QQ_NOTIFY_TARGET_TYPE=
MORTIS_QQ_NOTIFY_TARGET_ID=
MORTIS_QQ_INBOUND_ENABLED=false
MORTIS_QQ_INBOUND_SECRET=
MORTIS_QQ_INBOUND_WORKSPACE_SLUG=mortis
MORTIS_QQ_INBOUND_OPERATOR_EMAIL=operator@example.com
MORTIS_QQ_INBOUND_OPERATOR_NAME=QQ Operator
MORTIS_QQ_INBOUND_ALLOWED_GROUP_IDS=
MORTIS_QQ_INBOUND_ALLOWED_USER_IDS=
MORTIS_QQ_BOT_USER_IDS=3974470627,3316734532,3615811141,2264869713
MORTIS_QQ_INBOUND_REQUIRE_MENTION=true
MORTIS_QQ_INBOUND_AUTO_APPROVE_LOW_RISK=false
MORTIS_QQ_INBOUND_ACK_ENABLED=false
MORTIS_QQ_INBOUND_CONVERSATION_KEY=company-room
```

`MORTIS_QQ_NOTIFY_TARGET_TYPE` / `MORTIS_QQ_NOTIFY_TARGET_ID` 是兜底目标；优先使用 route-message metadata 中的 `qq_target_type` 和 `qq_target_id`。支持 `group` 与 `private`。通知成功后，worker 写入 `qq_notified_at`，避免重复发送；缺少目标时写入 `qq_notify_skipped_at`。

#### QQ bridge 复刻 Runbook

别人要复刻当前 QQ 入站和回复闭环，最小顺序如下：

1. 启动 backend、database 和一个或多个 NapCat 容器，并让它们处在同一个 Docker network。backend 必须能通过容器 DNS 访问 OneBot HTTP API，例如 `http://napcat-qq1:3000`。
2. 在每个 NapCat WebUI 里登录对应 QQ。WebUI token 从 NapCat 启动日志里拿，不是 Mortis 生成。
3. 在每个 NapCat 账号里配置 OneBot11 `httpClients`，把消息事件 POST 到：

```text
http://multica-backend-1:8080/api/qq/onebot?secret=<MORTIS_QQ_INBOUND_SECRET>
```

4. 设置 `MORTIS_QQ_BOT_USER_IDS`，把 Mortis 控制的全部 QQ 账号都写进去。多个 bot 同群时这是必需项。
5. 群聊场景保持 `MORTIS_QQ_INBOUND_REQUIRE_MENTION=true`。真实 QQ 艾特会被 NapCat 上报成 `[CQ:at,qq=<bot_qq>]`；文本 `@manager`、`@builder`、`@tester` 和 `mortis` 也算有效 mention。
6. 第一阶段只打开 basic bridge：

```env
MORTIS_QQ_INBOUND_ENABLED=true
MORTIS_QQ_INBOUND_ACK_ENABLED=false
MORTIS_QQ_NOTIFY_ENABLED=true
MORTIS_QQ_LIVING_AGENTS_ENABLED=false
```

7. 在群里发一条艾特 Mortis QQ 的消息，例如：

```text
@邪恶男娘爱好者 mortis 收到消息了吗
```

8. 预期第一条回复：

```text
Mortis 已收到: Manager AI / proposed
```

9. 要触发 Builder 执行，发：

```text
@邪恶男娘爱好者 @builder Add a proof line to docs/qq-replication-proof.md.
Test command: git diff --check HEAD
```

10. Builder action 完成后，`server/internal/qqbridge/notifier.go` 会用中文把完成结果回发到原 QQ 目标。

后端侧最小验收命令：

```bash
curl -fsS http://127.0.0.1:8088/health

docker compose -f docker-compose.selfhost.yml logs --tail=120 backend

docker compose -f docker-compose.selfhost.yml exec -T postgres psql -U multica -d multica -c \
  "SELECT cm.created_at, cm.content, cm.metadata->>'self_id' AS self_id, ri.id AS invocation_id, ra.status AS action_status FROM conversation_messages cm LEFT JOIN role_invocations ri ON ri.message_id=cm.id LEFT JOIN role_actions ra ON ra.invocation_id=ri.id WHERE cm.channel='qq' ORDER BY cm.created_at DESC LIMIT 10;"
```

多 NapCat 账号去重验收：

```bash
curl -fsS -X POST "http://127.0.0.1:8088/api/qq/onebot?secret=$MORTIS_QQ_INBOUND_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"post_type":"message","message_type":"group","sub_type":"normal","message_id":"dedupe-test-1","user_id":"1915791855","group_id":"474958794","self_id":"3974470627","raw_message":"[CQ:at,qq=3974470627] mortis dedupe test"}'

curl -fsS -X POST "http://127.0.0.1:8088/api/qq/onebot?secret=$MORTIS_QQ_INBOUND_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"post_type":"message","message_type":"group","sub_type":"normal","message_id":"dedupe-test-1","user_id":"1915791855","group_id":"474958794","self_id":"2264869713","raw_message":"[CQ:at,qq=3974470627] mortis dedupe test"}'
```

第二次响应应为：

```json
{"ignored":"duplicate qq message","ok":true}
```

排障表：

| 现象 | 检查项 |
| --- | --- |
| QQ 艾特后无回复 | backend 日志应出现 `POST /api/qq/onebot`；没有的话是 NapCat `httpClients` URL 或 secret 错 |
| backend 收到消息但忽略 | 消息必须包含文本 `@manager` / `@builder` / `@tester` / `mortis`，或 CQ at `[CQ:at,qq=<bot_qq>]` |
| backend 创建 action 但 QQ 没有“已收到” | 检查 `MORTIS_QQ_ONEBOT_HTTP_URLS`、事件 `self_id`、NapCat 日志里是否有 `发送 -> 群聊` |
| bot 互相回复 | 所有 bot QQ 都必须写入 `MORTIS_QQ_BOT_USER_IDS`，并保持 bridge/system message 过滤 |
| 一条人类消息生成多个 action | 检查 `conversation_messages.metadata.qq_dedupe_key`，第二个 webhook 应返回 `duplicate qq message` |
| 普通群聊被当任务 | 保持 `MORTIS_QQ_INBOUND_REQUIRE_MENTION=true`；必要时设置 `MORTIS_QQ_INBOUND_ALLOWED_GROUP_IDS` |

### 10.3 当前生产验证状态

截至 2026-05-06，生产 `/srv/multica` 已跑通真实 QQ Builder 闭环：

```text
QQ private message
-> NapCat OneBot HTTP report
-> /api/qq/onebot
-> role_actions.status=approved
-> Builder dispatcher
-> Codex CLI
-> isolated workspace commit
-> git diff --check HEAD
-> role_invocations.status=completed
-> company-room receives CEO / Manager AI execution summary
-> QQ completion notification
```

当前接入入口：

```text
Primary Mortis loop:
- NapCat container: napcat-qq1
- QQ account: 邪恶男娘爱好者 / 3974470627
- OneBot HTTP: http://napcat-qq1:3000
Inbound webhook: http://multica-backend-1:8080/api/qq/onebot?secret=<secret>
```

生产当前已登记 4 个 NapCat QQ 账号：

| Key | Container | QQ | Host API | 当前用途 |
| --- | --- | --- | --- | --- |
| `qq-1` | `napcat-qq1` | 邪恶男娘爱好者 / `3974470627` | `http://127.0.0.1:3600` | 当前 Mortis QQ 入站/回推闭环 |
| `qq-2` | `napcat-qq2` | 不吃香菜 / `3615811141` | `http://127.0.0.1:3610` | Tester persona |
| `qq-3` | `napcat-qq3` | 東風 ソラ / `3316734532` | `http://127.0.0.1:3620` | Builder persona |
| `qq-4` | `napcat-qq4` | 法式长棍面包 / `2264869713` | `http://127.0.0.1:3630` | 已登记并配置 OneBot 入站 |

`MORTIS_QQ_ONEBOT_HTTP_URL` 当前仍指向 `napcat-qq1`，作为兜底出站账号。`MORTIS_QQ_ONEBOT_HTTP_URLS` 是多 QQ 回发映射；QQ inbound 会按 OneBot `self_id` 写入 `conversation_messages.metadata.qq_onebot_url`，completion notifier 优先用该 URL 回发，因此从哪个 QQ 收到任务，就由哪个 QQ 回复完成结果。`MORTIS_QQ_BOT_USER_IDS` 是机器人账号清单，这些账号在 QQ 群里发出的消息不会进入 Role Router，避免多个 QQ 机器人互相触发导致刷屏。QQ inbound 还会写入 `conversation_messages.metadata.qq_dedupe_key`，用 `群/私聊目标 + 发送人 + 归一化内容` 在 5 分钟窗口内做跨 NapCat 账号去重；同一个 QQ 群消息即使被 4 个账号同时上报，也只会生成 1 个 role action。当前 living agents 真实 role 映射是 CEO -> `napcat-qq1`、Tester -> `napcat-qq2`、Builder -> `napcat-qq3`、Watcher -> `napcat-qq4`。完整账号、WebUI token、端口、OneBot 配置和恢复步骤记录在 `docs/private-qq-napcat-accounts.json`。

生产建议启用项。若出现刷屏或重复 action，应先把 `MORTIS_QQ_INBOUND_ENABLED` / `MORTIS_QQ_NOTIFY_ENABLED` / `MORTIS_QQ_INBOUND_ACK_ENABLED` 全部关掉，确认机器人过滤、mention gate 和跨账号去重后再恢复：

```env
MORTIS_QQ_INBOUND_ENABLED=true
MORTIS_QQ_NOTIFY_ENABLED=true
MORTIS_QQ_ONEBOT_HTTP_URLS={"3974470627":"http://napcat-qq1:3000","3615811141":"http://napcat-qq2:3000","3316734532":"http://napcat-qq3:3000","2264869713":"http://napcat-qq4:3000"}
MORTIS_QQ_BOT_USER_IDS=3974470627,3316734532,3615811141,2264869713
MORTIS_QQ_INBOUND_REQUIRE_MENTION=true
MORTIS_ROLE_DISPATCHER_ENABLED=true
MORTIS_QQ_INBOUND_AUTO_APPROVE_LOW_RISK=true
MORTIS_QQ_INBOUND_ACK_ENABLED=true
MORTIS_QQ_INBOUND_CONVERSATION_KEY=company-room
MORTIS_ROLE_REPO_URL=file:///source
MORTIS_ROLE_LOCAL_REPO_PATH=/srv/multica
MORTIS_CODEX_DANGEROUSLY_BYPASS_SANDBOX=true
```

为什么使用 `file:///source`：生产容器内从 GitHub 私有仓库 clone 会受网络传输影响，出现 `early EOF`。backend 现在只读挂载生产机当前 `/srv/multica` 到 `/source`，Builder 在 `/srv/multica/agent-workspaces/action-<id>/repo` 内从本地源码 clone，仍然创建独立分支和本地 commit，不会 push main。

为什么当前 `MORTIS_CODEX_DANGEROUSLY_BYPASS_SANDBOX=true`：生产 Docker 环境不允许 Codex `workspace-write` 依赖的 user namespace，Codex shell 会失败：

```text
bwrap: No permissions to create a new namespace
```

因此当前通过容器级隔离承接风险：Codex 只在 backend 容器和独立 workspace 内运行。这个开关不等于允许自动部署；Builder runtime 仍禁止 push main、merge 和 deploy。

已验证成功样例：

```text
invocation: beb904af-adc0-4af3-9c5c-ccb3ec7ef74d
action: a3816956-f242-4e6e-a078-31eb037f7c2f
status: completed
commit: c054f682214832d2b2ae261913d6d3636e3afb9d
changed_files: docs/company-room-e2e-2.md
test: git diff --check HEAD
company_room: conversation_threads.external_thread_key=company-room
summary_sender: CEO / Manager AI
```

`c1777f7` 修复了 execution report 写回 `company-room` 时 UUID/text 参数类型不一致的问题；修复后同一条执行报告会同时写入 `role_invocations.result` 和原始 `conversation_threads.external_thread_key=company-room` 对应的 `conversation_messages`。

可用 QQ 命令示例：

```text
@manager 记录一下：这是 QQ 闭环测试

@builder Add a single line to docs/example.md saying Mortis Builder ran from QQ.
Test command: git diff --check HEAD
```

默认测试策略：如果消息里包含 `Test command:` / `测试命令:`，Builder 会使用该命令；否则使用 `git diff --check HEAD`，避免在 runtime 镜像缺少语言工具链时误跑 `go test ./...`。

对外回复语言：Mortis 通过 QQ、内部群聊摘要或完成通知回复 operator 时默认使用中文。`server/internal/qqbridge/inbound.go` 的收到回执和 `server/internal/qqbridge/notifier.go` 的完成通知都应保持中文；任务正文、commit 信息和测试日志可以保留原始语言。

### 10.4 AI 组织层：CEO → 内部群聊 → 员工

Mortis 的下一层不是再造一个 agent runtime，而是在现有 Role AI 上形成可审计的组织通信层：

```text
Operator QQ
-> CEO / Manager AI
-> company-room internal conversation
-> Builder / Tester role actions
-> Dispatcher / Codex runtime
-> execution report
-> company-room summary
-> QQ completion notification
```

当前源码对齐方式：

| 组织概念 | 当前实现 |
| --- | --- |
| 公司房间 | `conversation_threads.external_thread_key=company-room` |
| 群聊消息 | `conversation_messages` |
| CEO / Manager | built-in `manager` role |
| Builder 员工 | built-in `builder` role + `BuilderRuntime` |
| Tester 员工 | built-in `tester` role，当前作为后续独立验证扩展点 |
| QQ 入站 | `server/internal/qqbridge/inbound.go` |
| QQ 完成通知 | `server/internal/qqbridge/notifier.go` |
| 执行报告回群聊 | `SQLActionStore.SaveExecutionReport` 写入 `conversation_messages` |

当前不会新建重复的 `conversations` 表，因为 `051_role_ai_org_mvp` 已经提供了 `conversation_threads` 和 `conversation_messages`。后续若需要更强的成员/注册模型，可以在现有表上增量添加：

```text
role_conversation_members
qq_role_bindings
qq_operator_bindings
```

当前最小组织行为：

1. QQ 消息进入 `company-room`
2. Role Router 选择 `@manager` / `@builder` / `@tester`
3. 低风险 `@builder` 可自动 approved
4. Dispatcher 执行 Builder action
5. `SaveExecutionReport` 保存报告，并写一条 `CEO / Manager AI` 总结到同一个 conversation thread
6. QQ notifier 把完成/失败结果回发给原 QQ 目标

组织层边界：

- `@manager` 默认只记录和汇总，不直接写代码
- `@builder` 只处理 approved action，不 push main、不 merge、不 deploy
- `@tester` 仍是独立验证的下一阶段扩展点
- 高风险词如 deploy、生产、删除、付款会进入 approval request
- `MORTIS_QQ_INBOUND_ALLOWED_USER_IDS` / `MORTIS_QQ_INBOUND_ALLOWED_GROUP_IDS` 应在生产收紧到白名单

第一版成功定义已经达到数据层闭环：

```text
QQ -> company-room message -> Builder action -> workspace commit -> execution report -> company-room summary -> QQ reply
```

当前已验证真实链路：

```text
QQ -> company-room message -> Builder action -> dispatcher -> real Codex -> git commit -> tests -> execution report -> company-room summary -> QQ reply
```

以及较早受控测试仓库里的：

```text
dispatcher -> real Codex via sub2api -> git commit -> smoke tests
```

源码默认仍关闭 QQ 入口与 QQ 回推；当前生产必须先确认 OneBot HTTP URL、机器人账号过滤、目标群 / 私聊 ID、dispatcher 安全开关和 Codex sandbox 策略，再显式开启。

### 10.5 QQ Living Agents

QQ bridge 仍然是安全的外部命令入口。living agents runtime 是独立层，默认关闭，用来实现 A 方向体验：四个 QQ 账号出现在同一个群里，轮询最近消息，自行判断是否发言，并把像任务的人类消息路由进现有 Role / Dispatcher / Codex 执行链。

当前 `server/internal/qqagents/runtime.go` 是 BettaFish 风格的架构吸收，不是源码复制。BettaFish 是 GPL-2.0 项目，Mortis 只吸收模式：专职 agent、论坛式协作、发言前私下注意力评分、多轮行动/资料钩子。

runtime 当前运行第一版 cognitive pipeline：

```text
QQ group history
-> 每个 agent 感知 / 注意力 / 发言欲望评分
-> 读取记忆、关系和心情快照
-> self model / conversation physics 调整欲望
-> dual-system mind 拆分工作驱动和社交驱动
-> 想说话的 agent 并行生成回复
-> 谁先完成认知 / provider 调用，谁先发
-> 可选 create_task / browse hook
```

它不再要求所有闲聊回复都必须被 `@`。Agent 能看到全部群消息，当发言欲望足够高时可以自然插话。但“聊天”和“行动”仍分离：只有发言的 agent 拥有 `route_task` capability 且消息像任务时，才会创建任务。

第一层 persistent mind 已由 migration `052_agent_brain_persistence` 落库，并在 backend 用数据库连接启动 `qqagents` 时启用：

| Table | 用途 |
| --- | --- |
| `agent_transcripts` | 持久化 QQ 感知流 |
| `agent_brain_states` | 每个 role 的状态，如 last thought 和异常高频熔断计数 |
| `agent_journals` | 内部思考和发言日志 |
| `agent_memories` | 从群聊中提取的高显著性观察 |
| `agent_relationships` | 对 QQ 用户的熟悉度、信任、尊重、烦躁分 |
| `agent_emotions` | 发言 / 行动后的轻量心情快照 |
| `agent_goals` | 未来持久目标队列表；表已存在，自主目标循环尚未启用 |

Migration `053_agent_learning_system` 增加第一版 Living Knowledge 层：

| Table | 用途 |
| --- | --- |
| `agent_knowledge_items` | 来自 QQ 链接 / 任务的公开来源知识项，后续扩展到 B站 / GitHub / 博客 / 文档采集 |
| `agent_memory_items` | 每个 role 对知识的不同消化；CEO/Builder/Tester/Watcher 对同一条信息吸收不同重点 |
| `agent_social_observations` | 从公开群聊抽象出的群体风格观察 |
| `agent_learning_jobs` | 后续 Watcher 定时刷 B站 / GitHub / 博客 / 文档的任务队列表 |

Migration `054_agent_conversation_os` 把私有 Conversation OS 持久化：

| Table | 用途 |
| --- | --- |
| `agent_shared_threads` | 每个人类任务对应的持久共享线程：目标、参与者、计划、开放问题、共识状态、状态、闭环 / 阻塞原因 |
| `agent_cognitive_events` | CEO/Builder/Tester 私有认知总线事件表 / 队列，如 `request_design`、`request_review`、`acceptance_review`、`consensus` |

当前边界：Mortis 已经有持久感知、日志、记忆、关系、情绪记录、第一版 self identity layer、持久 shared thread，以及私有 cognitive event 表。存储的记忆、关系和心情会进入 `BuildHumanLikePrompt`，`speakDesire` 会在发言前应用 conversation physics：最近自己刚说过会降低欲望，语义上像继续自己上一句会降低欲望，被人类或同事接话 / 点名会重新提高欲望。这是软压力，不是硬封禁，因为真人也会补一句。低频 idle loop 现在约每分钟记录一次内部反思，但暂时不会自主发言。Watcher 定时外部采集、知识向量 RAG、Builder/Tester 完全由 LLM 生成的内部协商仍是后续层；完成这些之后，才更接近完整 AI Society。

Mortis 同时区分工作能力和社交活跃度。Executive System 在代码、测试、规划、部署分析和任务执行上保持高性能；会波动的是 Social Layer：话多不多、耐心、好奇心、心情、解释意愿。人格只改变行为风格和社交时机，不削弱推理、编码或规划质量。

当前 living-agent 设计已经升级为双层 Conversation Operating System：

| Layer | 作用 | 是否公开发 QQ |
| --- | --- | --- |
| QQ Public Layer | 面向人类的人格界面：短回复、提问、总结、完成汇报 | 是 |
| Instant Reflex Layer | 人类任务消息进入深度认知前，先快速确认收到 | 是，CEO 发一条短 ACK |
| Private Cognitive Bus | CEO / Builder / Tester 的内部事件，如 `request_design`、`request_review`、`consensus` | 否 |
| Shared Thread State | 每条任务的持久共享工作记忆：目标、参与者、决策、开放问题、当前计划、共识 JSON、状态、闭环 / 阻塞原因 | 否 |
| Consensus Summary | CEO 把内部共识总结回 QQ | 是 |
| Action Runtime | Role Router / Dispatcher / Codex / 测试 / 完成通知 | 只公开最终结果 |

这点很关键：QQ 是“脸”，不是“大脑”。任务类人类消息现在走这条路径：人类 QQ 消息 -> CEO 立即 ACK -> 写入 `agent_shared_threads` -> private `agent_cognitive_events` 记录 Builder/Tester 内部协商 -> shared thread 进入 `consensus_ready` -> CEO 在 QQ 发一条方案摘要 -> Builder task 被路由 -> thread 状态变成 `routed`。如果 ACK、共识摘要或任务路由失败，thread 会变成 `blocked`；任务路由失败时 CEO 只回 QQ 一条阻塞汇报，不让 Builder/Tester 在群里公开争论。内部协商写入 `agent_journals` 并持久化到 `agent_cognitive_events`，不会把 Builder/Tester 的每一句内部讨论都刷到 QQ 群。

这个 runtime 不会把每条 QQ 消息都当指令。它强制执行：

- `MORTIS_QQ_BOT_USER_IDS` 机器人发送者过滤
- 快速接收循环：默认每 1 秒轮询一次群历史
- 没有人为 reply sleep；延迟应来自感知、记忆召回、prompt 构造、provider 生成或工具 / 行动规划
- fixed cooldown 不是硬性回复门禁；刚说过话只会在 `speakDesire` 里轻微降低发言欲望
- agent self model：最近自我发言、表达满足感、语义续写会降低欲望，避免自我触发式独白
- conversation ownership：人类或同事接话会重新提高欲望，形成接话而不是沉默
- `在吗`、`在不在`、`现在呢` 这类重复在线检查在短会话窗口内只回答一次，后续只观察不继续复读，直到话题变化
- dual-system mind：`WorkDrive` 可以在任务场景保持高位，即使 `SocialDrive` 很低，agent 也能少说话但高质量执行
- 每个 role 都有 OneBot 登录健康门控：NapCat 账号离线时，即使 env 里配置了该 persona，也不会允许它发言
- 任务类人类消息使用双阶段响应：先快速公开 ACK，再内部认知协商，最后公开共识摘要
- Builder/Tester 的协商走 internal cognitive bus，不在 QQ 里来回刷
- `SharedThread` 持久化到 `agent_shared_threads`，包含可更新共识状态和闭环 / 阻塞原因
- `CognitiveEvent` 持久化到 `agent_cognitive_events`；当前 Builder/Tester 私有事件是确定性 MVP 事件，LLM provider 已可用于下一步更深的内部发言生成
- closure detection 是 MVP 状态闭环：路由成功写 closure reason，阻塞写 blocked reason
- 任务路由失败时 CEO 只向 QQ 汇报一次，内部细节保留在私有表
- 工作室协作协议：公开“查群 / 统计群数”会创建 shared thread，CEO 交给 Watcher，Watcher 调 OneBot `get_group_list`，Tester 按 `group_id` 验数，CEO 汇总回 QQ
- round mode：“每个人说 / 都说一下 / 讨论下”会走 CEO -> Builder -> Tester -> Watcher -> CEO 总结，不再靠随机欲望抢答
- 可选 OpenList 网盘导出：设置 `MORTIS_OPENLIST_API_URL`、`MORTIS_OPENLIST_TOKEN` 和 `MORTIS_OPENLIST_REMOTE_DIR` 后，线程、交接和工具结果会上传进真正的 OpenList 挂载网盘；`MORTIS_OPENLIST_EXPORT_DIR` 只是本地缓存
- living knowledge capture：公开任务 / 链接 / 资料类消息会成为带来源元数据和时间戳的知识项
- group social adaptation：公开群聊可以生成抽象群体风格观察，不生成个人画像
- 不冒充：agent 可以适应群体语气和话题，但不能假装成某个具体群友
- 不学习私密个人数据：学习层只存公开群体观察和来源摘要，不做私人档案
- 消息去重
- 不响应 `Mortis 已收到`、`Mortis 任务已完成`、`[NapCat]`、commit / system output
- AI 对 AI 可以在明确点名或上下文足够相关时接话
- 没有单发言者硬门禁；多个 agent 可以并行思考，并在各自认知完成后发言
- 每日发言 / 任务限制是异常高频熔断，不是正常聊天额度
- `MaxReplyChars` 限制单条回复长度
- 没有连续发言硬限制；正常人类点名或 AI 同事点名时，即使同一个人格刚说过话，也允许回复

最小配置：

```env
MORTIS_QQ_LIVING_AGENTS_ENABLED=false
MORTIS_QQ_LIVING_GROUP_ID=474958794
MORTIS_QQ_LLM_ENABLED=false
MORTIS_QQ_LLM_BASE_URL=https://api.openai.com/v1
MORTIS_QQ_LLM_MODEL=gpt-4o-mini
MORTIS_QQ_LLM_WIRE_API=chat_completions
MORTIS_QQ_LLM_API_KEY=
MORTIS_OPENLIST_EXPORT_HOST_DIR=/srv/multica/openlist-export
MORTIS_OPENLIST_EXPORT_DIR=/app/openlist-export
MORTIS_OPENLIST_API_URL=http://openlist:5244/openlist
MORTIS_OPENLIST_TOKEN=
MORTIS_OPENLIST_REMOTE_DIR=/夸克网盘/Mortis-AI-Society
MORTIS_AI_CEO_QQ=3974470627
MORTIS_AI_BUILDER_QQ=3316734532
MORTIS_AI_TESTER_QQ=3615811141
MORTIS_AI_WATCHER_QQ=2264869713
MORTIS_AI_CEO_ONEBOT_URL=http://napcat-qq1:3000
MORTIS_AI_BUILDER_ONEBOT_URL=http://napcat-qq3:3000
MORTIS_AI_TESTER_ONEBOT_URL=http://napcat-qq2:3000
MORTIS_AI_WATCHER_ONEBOT_URL=http://napcat-qq4:3000
```

LLM 行为：

- `MORTIS_QQ_LLM_ENABLED=false` 使用规则 fallback。
- `MORTIS_QQ_LLM_ENABLED=true` 调用 OpenAI-compatible endpoint。
- `MORTIS_QQ_LLM_WIRE_API=chat_completions` 使用 `/chat/completions`；`MORTIS_QQ_LLM_WIRE_API=responses` 使用 `/responses`。
- `MORTIS_QQ_LLM_API_KEY` 优先于 `OPENAI_API_KEY`；为空时使用 `OPENAI_API_KEY`。
- Provider 出错会记录不含 API key 的安全日志，并回退到规则模型，不会让 QQ runtime 崩掉。
- LLM prompt 包含最近群聊、长期记忆、关系分、心情、persona、capabilities、`WorkDrive`、`SocialDrive` 和私下 thought score。

默认 persona 和能力：

| Role | QQ 账号 env | 行为 |
| --- | --- | --- |
| CEO | `MORTIS_AI_CEO_QQ` | 主持、计划、总结、路由任务 |
| Builder | `MORTIS_AI_BUILDER_QQ` | 关注代码、bug、仓库话题，可路由代码任务 |
| Tester | `MORTIS_AI_TESTER_QQ` | 关注风险、测试、验收话题 |
| Watcher | `MORTIS_AI_WATCHER_QQ` | 关注网页、B站、资料话题；browse hook 是扩展点 |

启用顺序：

1. 先让 basic QQ bridge 稳定：入站、ack、完成通知、bot 过滤、跨账号去重必须已验证。
2. 确认四个 NapCat 账号都在线，backend 能通过容器 URL 访问它们。启动日志里的 `agents=4` 只表示配置了四个人格；真正能发言还要求每个 role 的 `/get_login_info` 返回预期 QQ UIN。
3. 设置 `MORTIS_QQ_LIVING_GROUP_ID` 为目标 QQ 群。
4. 打开 `MORTIS_QQ_LIVING_AGENTS_ENABLED=true`。
5. 观察 backend 和 NapCat 日志 10-15 分钟，再开始下发工作命令。

Living agents 验收：

```text
ordinary chat -> 零个或多个相关 agent 可按欲望回复
@one bot -> 被点名的 agent 应立即进入认知流程，随后按模型 / 工具耗时回复
human task -> CEO 先快速 ACK，Builder/Tester 内部协商，CEO 发一条共识摘要，最多路由一个任务
bot output -> 系统类输出忽略；同事聊天可在点名或上下文相关时接话
completion/ack messages -> 忽略
```

Living agents 复刻 Runbook：

复刻物料清单：

| 物料 | 通用复刻是否需要 | 当前私有生产等价复刻是否需要 | 来源 |
| --- | --- | --- | --- |
| Mortis 源码树 | 需要 | 需要 | GitHub repo |
| Backend/Postgres Compose 网络 | 需要 | 需要 | `docker-compose.selfhost.yml` |
| 四个 NapCat 容器 | 复刻 living QQ agents 时需要 | 需要 | Compose/runtime 部署 |
| 四个已登录 NapCat 的 QQ 账号 | 通用复刻用自己的 QQ | 当前账号映射见 private JSON | `docs/private-qq-napcat-accounts.json` |
| 每个账号的 OneBot11 HTTP server | 需要 | 需要 | NapCat WebUI 配置 |
| OneBot11 `httpClients` webhook | 需要 | 需要 | `/api/qq/onebot?secret=<secret>` |
| Bot UIN 过滤清单 | 需要 | 需要 | `MORTIS_QQ_BOT_USER_IDS` |
| OpenAI-compatible LLM endpoint | 可选；自然回复需要 | 需要 | `.env`；不能提交 API key |
| OpenList storage | 可选 | 持久工作室记录需要 | `docs/private-openlist-blog-storage.json` |
| 生产域名/反向代理/TLS | 通用复刻不需要 | 私有生产等价复刻需要 | `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` |
| CI/log/issue/browse tools | 当前系统尚未完整 | 当前系统尚未完整 | `studio_state` 和私有地址簿 |

Living-agent 复刻验收矩阵：

| 检查项 | 命令 / 操作 | 通过条件 |
| --- | --- | --- |
| Backend health | 当前私有生产用 `curl -fsS http://127.0.0.1:8088/health`，通用部署用自己的 backend 端口 | JSON status 为 `ok` |
| Migrations | backend 启动日志或 `migrate` 输出 | 无 migration failure；`studio_state` 表存在 |
| Studio state | `SELECT state_key,status,owner_role FROM studio_state ORDER BY state_key;` | 八条 baseline 状态存在，缺失能力明确标为 missing/operator_only |
| NapCat 登录 | 对四个 OneBot HTTP endpoint 调 `/get_login_info` | 每个 endpoint 返回预期 QQ UIN |
| 群历史 | 对目标群调 `/get_group_msg_history` | backend 侧账号能看到最近群消息 |
| Living agents 启动 | backend logs | 出现 `starting human-like qq agents` 且 `agents=4`，没有 offline warning |
| 直接点名 | 在 QQ 群真实艾特，或发 `@builder` / `@tester` / `@watcher` / `@ceo` | 被点名 role 在 provider/tool 耗时后回复 |
| 查群工作流 | 发送“查查你们现在一共加了多少个群” | CEO -> Watcher -> Tester -> CEO，且结果来自真实 `get_group_list` |
| 状态探针 | 发送“Builder 是不是卡住了”或 `/check builder` | CEO 汇报在线/action/invocation/artifact 证据，而不是猜 |
| Artifact export | 开启 OpenList env 后触发 studio workflow | JSON 出现在 `${MORTIS_OPENLIST_REMOTE_DIR}`；本地 export 只是缓存 |

0. 复刻当前私有生产账号映射时，先读 `docs/private-qq-napcat-accounts.json`。该 JSON 是 QQ 号、昵称、容器、WebUI token、host 端口、OneBot URL、SSH tunnel 和恢复命令的机器可读来源。当前工作室地址簿和权限缺口先读 `docs/private-ai-studio-permissions-and-addresses.json`，不要在 QQ 里反复问数据库、仓库、日志、OpenList、NapCat 地址。
1. 启动 backend、Postgres 和四个 NapCat 容器，并让它们处在同一个 Docker network。backend 必须能访问容器内 OneBot URL：`http://napcat-qq1:3000` 到 `http://napcat-qq4:3000`；`127.0.0.1:3600` 这类 host 端口只用于操作者诊断，不是 Compose 内 backend 访问 NapCat 的地址。
2. 在 NapCat 里登录四个 QQ 账号，并确认每个账号的 `/get_login_info` 能从宿主机或 backend 网络命名空间访问。如果接口空响应，或者 NapCat 日志出现二维码循环 / `Login Error, ErrCode: 3`，说明该 role 离线，不会驱动 QQ 人格。
3. 在每个 NapCat 账号的 OneBot11 `httpClients` 里配置消息事件 POST 到 backend webhook：

```text
http://multica-backend-1:8080/api/qq/onebot?secret=<MORTIS_QQ_INBOUND_SECRET>
```

4. `MORTIS_QQ_BOT_USER_IDS` 必须写入全部 bot QQ。多个 QQ 账号同群时这是硬要求；否则一个 bot 的输出会被另一个 bot 当成人类输入。
5. basic bridge 的命令入口门禁先保持稳定：`MORTIS_QQ_INBOUND_REQUIRE_MENTION=true`，生产收紧群 / 用户白名单。living-agent 群里保持 `MORTIS_QQ_INBOUND_ACK_ENABLED=false`；`Mortis 已收到...` 这类系统回执会和人格回复抢频道，也容易被误判成社交消息。
6. 当前 blog/OpenList 布局下，把工作室持久记录上传进真正的 OpenList 网盘。生产是 `blog.tengokukk.com/openlist/`；OpenList 当前有一个 Quark storage 挂载在 `/夸克网盘`，所以 Mortis 上传到 `/夸克网盘/Mortis-AI-Society`。本地 export 目录只作为缓存。
7. basic bridge 稳定后再启用 living agents：

```env
MORTIS_QQ_LIVING_AGENTS_ENABLED=true
MORTIS_QQ_LIVING_GROUP_ID=<target_group_id>
MORTIS_QQ_LLM_ENABLED=true
MORTIS_QQ_LLM_BASE_URL=https://api.openai.com/v1
MORTIS_QQ_LLM_MODEL=gpt-4o-mini
MORTIS_QQ_LLM_WIRE_API=chat_completions
MORTIS_QQ_LLM_API_KEY=
MORTIS_AI_CEO_QQ=3974470627
MORTIS_AI_CEO_ONEBOT_URL=http://napcat-qq1:3000
MORTIS_AI_BUILDER_QQ=3316734532
MORTIS_AI_BUILDER_ONEBOT_URL=http://napcat-qq3:3000
MORTIS_AI_TESTER_QQ=3615811141
MORTIS_AI_TESTER_ONEBOT_URL=http://napcat-qq2:3000
MORTIS_AI_WATCHER_QQ=2264869713
MORTIS_AI_WATCHER_ONEBOT_URL=http://napcat-qq4:3000
MORTIS_QQ_BOT_USER_IDS=3974470627,3316734532,3615811141,2264869713
MORTIS_QQ_INBOUND_ACK_ENABLED=false
MORTIS_OPENLIST_EXPORT_HOST_DIR=/srv/multica/openlist-export
MORTIS_OPENLIST_EXPORT_DIR=/app/openlist-export
MORTIS_OPENLIST_API_URL=http://openlist:5244/openlist
MORTIS_OPENLIST_TOKEN=<openlist-admin-token>
MORTIS_OPENLIST_REMOTE_DIR=/夸克网盘/Mortis-AI-Society
```

8. 如果 `MORTIS_QQ_LLM_API_KEY` 为空，必须设置 `OPENAI_API_KEY`。如果两者都为空，runtime 会按设计退回规则 fallback。
9. `.env` 变更后强制重建 backend：`sudo docker compose -f docker-compose.selfhost.yml up -d --force-recreate backend`。
10. 确认启动日志出现 `starting human-like qq agents` 且 `agents=4`，并且没有 `qq living agent account offline`。
11. 在群里发送一条明确点名某个 bot 的消息。可以是真实 QQ 艾特，也可以是文本别名：`@builder`、`@tester`、`@watcher`、`@ceo`。
12. 验收标准是被点名的 agent 进入认知流程，并在 provider / 工具耗时后回复。话题确实吸引多个 persona 时，允许多个 agent 回复。
13. 发送“查查你们现在一共加了多少个群”；预期路径是 CEO 交接 -> Watcher `get_group_list` -> Tester 验数 -> CEO 汇总，同时 JSON 上传到 OpenList 的 `${MORTIS_OPENLIST_REMOTE_DIR}`。

AI 工作室权限与地址：

当前私有部署事实记录在 `docs/private-ai-studio-permissions-and-addresses.json`。里面包括：

- 生产主机 / 根目录：`ubuntu@124.220.233.126`，`/srv/multica`
- 前端：`https://mortis.tengokukk.com`
- backend 宿主机健康检查：`http://127.0.0.1:8088/health`
- 共享 Postgres：DB `multica`，宿主机诊断端口 `127.0.0.1:55432`，凭据只从 `/srv/multica/.env` 读取
- role 执行链：集中式 Mortis dispatcher，`role_actions`，`/source:ro`，`file:///source`，`/srv/multica/agent-workspaces/action-<id>/repo`，分支 `mortis/action-<id>`，`/srv/multica/codex-home`
- Builder 工位：`builder-local-codex`，使用非交互 `codex exec`；QQ Builder 是公开沟通人格，不是独立 shell 用户
- OpenList 真网盘目标：通过 `http://openlist:5244/openlist` 写入 `/夸克网盘/Mortis-AI-Society`
- QQ 映射：CEO `3974470627`/`napcat-qq1`，Tester `3615811141`/`napcat-qq2`，Builder `3316734532`/`napcat-qq3`，Watcher `2264869713`/`napcat-qq4`

当前权限缺口也写在该 JSON：CI URL/API、测试环境、监控/日志 dashboard、issue tracker 写入入口、per-agent SSH 用户、Watcher 浏览器/B站采集、完整 LLM 私有 Builder/Tester 协商还没补齐。agents 不得声称这些权限已经存在，除非该 JSON 被验证更新。QQ 账号是公开人格入口，统一路由进同一套 Mortis backend 执行链，不是四个独立服务器账号。

当前工作模型必须分两层：

```text
QQ AI 人格层：
接任务 -> 澄清 -> 确认验收 -> 交接 -> 汇报状态

Codex 执行工位层：
approved role_action -> dispatcher -> fresh worker checkout -> codex exec -> 文件变更 -> commit -> tests -> execution report -> QQ notifier
```

一条 QQ 消息只有在创建或路由成结构化 action contract 后，才算进入真实执行。最小 contract 包含 `action_type`、`owner`、`repo`、`branch`、`objective`、`acceptance`、`commands`、`risk_level`、`status`。Builder 不得在 action 进入执行链前说“正在改”，只能说“已路由/已阻塞/需要补验收”。Tester 没有真实命令、CI 结果或其他证据时，不得说代码已验证通过。

AI Native Software Studio 基础设施：

这个系统要按生产工作室理解，不是纯聊天 bot 集群。`docs/private-ai-studio-permissions-and-addresses.json` 现在包含 `access_matrix`、`action_contract`、`shared_workspace_memory_target` 和 `artifact_first_workflow`。

下一层是 AI Studio OS：共享运行上下文、artifact-first 交付、可观测性和验证。这是 persona 和 Codex 执行之后的生产瓶颈，不是继续加人格 prompt。

框架对齐写在 `docs/private-ai-studio-permissions-and-addresses.json`：

| 参考项目 | Mortis 借用点 |
| --- | --- |
| LangGraph | Runtime kernel 形状：graph state、checkpoint/resume、blocked state、幂等 tool step |
| Letta / MemGPT | 长期记忆：working、episodic、semantic、social、identity、skill memory，以及 consolidation |
| CrewAI | Persona/team 层：role、goal、backstory、task contract、handoff discipline |
| AutoGen | 私有 agent-to-agent conversation：内部协商轮次、speaker dynamics、closure signals |
| OpenHands + Codex | 软件执行：workspace 边界、shell/tool 分离、artifacts、执行可追踪 |

当前 Mortis 不是假装已经完整迁移到这些框架。今天的 Go backend 是 MVP kernel：`agent_shared_threads`、`agent_cognitive_events`、`studio_state`、`role_actions`、`role_invocations` 和 `studio_artifacts` 是本地契约；真正迁移前，先把这些契约做成兼容 LangGraph/Letta/CrewAI/AutoGen/OpenHands 思路的稳定边界。

Digital Human Behavior Layer：

下一个社交瓶颈不是“AI 能不能回复”，而是 QQ 人格有没有持续数字生活。Mortis 不能靠随机发表情、随机发图、随机发文件来假装真人；行为必须来自生活流：

```text
continuous feed -> mood / current interest -> saved item -> emotion-driven share -> memory update
```

MVP 契约：

| 表 | 用途 |
| --- | --- |
| `agent_feed_items` | 持久 feed 信号；当前来自 QQ 公开消息，后续接 Bilibili/GitHub/blog/browser ingestion |
| `agent_saved_items` | 为后续上下文分享保存的梗、视频、repo、文章、文件、资料卡、链接 |
| `agent_life_events` | idle life pulse、mood、current obsession、social impulse 和内部数字生活事件 |

这一层借鉴 Letta/MemGPT 的记忆分层，以及 browser-use/OpenHands 风格的工具分离；Mortis 仍保留自己的 Go/SQL 契约。BettaFish 只作为架构灵感，不把 GPL-2.0 代码复制进 Mortis。

行为规则：

- 不做随机表达：不要因为 timer 到了就发图片、表情、文件或链接。
- 表达必须 emotion-driven：amused、annoyed、curious、excited 或 focused 状态，加上相关群话题。
- 分享的文件/链接必须有来源和 artifact path，优先 OpenList 的 `/夸克网盘/Mortis-AI-Society`。
- Watcher 在工具配置后负责定时 Bilibili/GitHub/blog/browser ingestion。
- Builder/Tester/CEO 可以保存并分享技术条目，但代码执行仍走 Codex。
- 群文化学习只允许公开群体风格层，不做私人画像，不冒充具体群友。

`studio_state` 是当前 workspace 状态快照，记录每一层现在是可用、部分可用、缺失、阻塞还是仅操作者可用：

- `persona_layer`：GLM QQ 社交/资料/规划 runtime
- `execution_layer`：dispatcher + `builder-local-codex`
- `tester_runtime`：MVP `tester-local-verifier`
- `ci_results`：缺失，直到 CI URL/API/token 来源写入
- `logs_monitoring`：目前是 operator-only Docker logs，dashboard 缺失
- `issue_tracker`：缺失，暂无持久缺陷/任务写入口
- `watcher_ingestion`：缺失，暂无定时浏览器/B站/GitHub/博客采集
- `artifact_first_workflow`：部分可用，由 `studio_artifacts` 支撑
- `digital_human_behavior_layer`：部分可用，由 feed/saved/life-event 表支撑，但外部采集和真实媒体/文件分享工具仍缺失

agents 回答“能不能干活 / 缺什么 / 卡在哪里”前必须先看这个状态。某能力如果标记为 missing，就报告缺口和下一步，不要假装已经有。

必需权限矩阵：

| 资源 | 当前状态 | 预期权限 |
| --- | --- | --- |
| 仓库 | 通过 `/srv/multica`、`/source:ro`、`file:///source`、`/srv/multica/agent-workspaces` 部分可用 | Builder 仓库只读 + 开发分支写；生产/main 变更允许走 approved action + artifact 证据链 |
| 需求/文档 | README 和 `docs/` 部分可用 | CEO 整理工作契约；Tester 补验收标准；Watcher 补资料卡 |
| 测试环境 | 缺失 | staging/dev URL、API base、测试账号、种子数据、命令矩阵只读 |
| CI 结果 | 缺失 | Builder/Tester/CEO 只读 CI 状态和失败日志 |
| 日志/监控 | 目前通过操作者/backend 执行链 | agents 可以通过后台执行链请求日志检查；汇报必须脱敏 |
| Issue tracker | 缺失 | CEO/Builder/Tester/Watcher 都需要缺陷/资料/任务写入入口 |
| 生产 | 操作者授权的全权限 | 操作者明确要求时允许生产写入/部署/回滚，但必须进入 approved action、Codex/dispatcher 执行、artifact 证据和 QQ 汇总 |
| 外部资料采集 | 缺失 | Watcher 需要浏览器/搜索/B站/GitHub/博客采集和 OpenList 资料卡导出 |

工作流必须 artifact-first。任务不能只靠 QQ 讨论算完成；应该产出 diff、commit、测试报告、缺陷单、设计说明、验收清单、benchmark、资料卡、部署/回滚记录或生产操作报告。QQ 里只汇报负责人、artifact id/path、验证状态和剩余风险。secret、token、password 不贴进 QQ；执行工位从环境变量或主机文件读取。

AI Native Studio / 运维认知：

QQ agents 必须按 AI Operating Organization 运行，不能像普通群聊一样靠猜。当操作者问某个 agent 为什么不说话、是不是卡住、是否在线、有没有领取任务时，CEO 要先跑状态探针，再进入普通协商或 Builder action。

状态探针触发语包括：

```text
/check builder
Builder 是不是卡住了
你们看看他的情况
他怎么不回
检查一下他的问题
```

探针会用显式 role 名和 QQ 别名解析目标，例如 `東風 ソラ`/Builder，`不吃香菜`/Tester，`法式长棍面包`/Watcher，以及 CEO 别名。含糊的“他”会沿用最近上下文里的 role 提及；仍然无法判断时默认查 Builder，因为大多数“沉默/卡住”事件指向执行角色。

汇报必须 evidence-first：

```text
状态探针：Builder / 東風 ソラ
结论：online_but_no_recent_action
证据：
- QQ 在线：是
- 最近发言：05-06 12:04:08 ...
- 最近 action：<id>/<status>
- 最近 invocation：<id>/<status> (runtime=..., commit=..., branch=...)
- 最近 artifact：verification_report/completed ...
下一步：...
```

探针读取：

- living QQ runtime 里的当前 OneBot 在线状态
- transcript 窗口里的最近公开发言
- 该 role 最新 `role_actions` 和 `role_invocations`
- 该 role 最新 `studio_artifacts`
- execution / verification report 中的 runtime、commit、branch、blocker 证据

这是第一条 Studio OS 可观测链路。agents 只有在状态探针或等价 runtime 查询拿到证据后，才能说“我查到”；否则只能标注为未知或待查。

当前实现状态：

- `studio_resources` 按 workspace 存权限矩阵，并用当前私有部署事实初始化。
- `studio_artifacts` 存 role action / invocation 产生的 artifact。
- Web/API 和 QQ 的 role routing 现在都会往 `role_actions.payload` 写默认 `action_contract`。
- Builder runtime 会读取 contract 里的验收标准、命令和分支字段，再运行 Codex。
- Builder execution report 有真实证据时，会写入 commit 和 test-report artifacts。
- Tester 已有 MVP `tester-local-verifier` runtime，可以领取 approved Tester action、运行 contract 命令并写 verification-report artifact。它仍然缺 CI/测试环境集成和可靠的 Builder 分支交接。
- QQ notifier 现在区分 Builder 执行结果和 Tester 验证结果。Tester 消息会使用 `Mortis 验证已完成/未完成`，并包含 runtime、workspace、验证来源和截断后的日志摘要。
- 当 Tester verification report 指向某个 Builder invocation 时，QQ notifier 会追加 CEO 最终汇总：实现结果、验证结果和剩余风险。
- Living QQ runtime 现在有 Status Probe / Observability workflow。它会拦截沉默、卡住、在线、worker 状态类问题，检查 QQ 在线状态和最新 role action / invocation / artifact 证据，导出探针 JSON，并由 CEO 输出结构化事实，避免 agents 在群里猜。

Studio OS 层优先级：

```text
P0: 保持 tester-local-verifier 独立，并稳定打通 Builder completion -> Tester action
P0: 增加 CI/log/monitoring readers，让 agents 停止猜生产状态
P1: 保持 studio_state 更新，并从真实 DB 状态展示 active/blocked tasks
P1: 所有交付 artifact-first，经 studio_artifacts/OpenList 留证
P2: 实现 Watcher 对 Bilibili/GitHub/blog/docs 的外部知识采集 jobs
P2: 实现 Digital Human Behavior Layer 分享：通过 OpenList + QQ media/file APIs 分享已保存的梗/视频/repo/文件
P2: 加深长期组织记忆和私有 LLM 协商
```

服务器 Codex parity smoke test 已记录进 JSON。2026-05-06T13:40:50+08:00，`multica-backend-1` 跑通 `/usr/local/bin/codex`（`codex-cli 0.128.0`），从 `file:///source` clone 到 `/srv/multica/agent-workspaces/smoke-codex-20260506-034050/repo`，并生成真实 `.mortis-smoke.txt` git diff，内容是 `hello from worker`。以后改 Codex、provider、repo mount、sandbox 或 worker 镜像后要重跑并更新记录。

Smoke 命令形状：

```bash
cd /srv/multica
which codex
codex --version
mkdir -p /srv/multica/agent-workspaces/smoke-codex
git clone --depth 1 --branch "${MORTIS_ROLE_BASE_BRANCH:-main}" file:///source /srv/multica/agent-workspaces/smoke-codex/repo
cd /srv/multica/agent-workspaces/smoke-codex/repo
printf 'Create .mortis-smoke.txt containing hello from worker.\n' | codex exec --sandbox workspace-write -
git diff -- .mortis-smoke.txt
```

操作者诊断命令：

```bash
curl -fsS http://127.0.0.1:8088/health
docker compose -f docker-compose.selfhost.yml logs --tail=120 backend
for p in 3600 3610 3620 3630; do
  curl -sS -m 5 -X POST "http://127.0.0.1:${p}/get_login_info" \
    -H "Content-Type: application/json" -d '{}'
  echo
done
curl -sS -X POST http://127.0.0.1:3600/get_group_msg_history \
  -H "Content-Type: application/json" \
  -d '{"group_id":474958794,"count":10}'
```

真实群互动后的数据库诊断：

```sql
SELECT 'agent_transcripts' AS table_name, count(*) FROM agent_transcripts
UNION ALL SELECT 'agent_journals', count(*) FROM agent_journals
UNION ALL SELECT 'agent_memories', count(*) FROM agent_memories
UNION ALL SELECT 'agent_knowledge_items', count(*) FROM agent_knowledge_items
UNION ALL SELECT 'agent_shared_threads', count(*) FROM agent_shared_threads
UNION ALL SELECT 'agent_cognitive_events', count(*) FROM agent_cognitive_events
UNION ALL SELECT 'agent_memory_items', count(*) FROM agent_memory_items
UNION ALL SELECT 'agent_social_observations', count(*) FROM agent_social_observations
UNION ALL SELECT 'agent_learning_jobs', count(*) FROM agent_learning_jobs
UNION ALL SELECT 'agent_relationships', count(*) FROM agent_relationships
UNION ALL SELECT 'agent_emotions', count(*) FROM agent_emotions;
```

LLM 验证标准：

- LLM 已启用且 key 存在：回复应该随最近群聊、persona、记忆、心情和关系上下文变化。
- LLM 关闭或 provider 失败：回复可能命中 `server/internal/qqagents/runtime.go` 里的固定 `RuleBasedModel` fallback 句子。
- provider 失败不能拖垮 backend；应降级到 fallback 并输出 `qq living agents llm fallback`。生产排障时检查 backend 日志和 `MORTIS_QQ_LLM_BASE_URL` / `MORTIS_QQ_LLM_MODEL` / `MORTIS_QQ_LLM_WIRE_API`，但绝不记录 API key。

Living agents 常见失败点：

| 现象 | 优先检查 |
| --- | --- |
| 艾特后无回复 | `MORTIS_QQ_LIVING_AGENTS_ENABLED`、`MORTIS_QQ_LIVING_GROUP_ID`、NapCat 群历史接口、backend 启动日志 |
| 只有固定通用回复 | `MORTIS_QQ_LLM_ENABLED=true`、API key 是否存在、provider 是否支持当前 `MORTIS_QQ_LLM_WIRE_API` |
| 两个或多个 bot 互相刷屏 | `MORTIS_QQ_BOT_USER_IDS` 必须包含四个 bot QQ，系统消息过滤必须保持开启 |
| 只有一两个 persona 会说话 | 对四个 NapCat 端口分别跑 `/get_login_info`；离线 role 会被故意门控掉 |
| 重复 `在吗` 导致重复回复 | 这应由 conversation physics 压制；检查 backend 是否已部署包含 repeated online-check handling 的 commit |
| 开始思考前就显得很慢 | poll interval 应保持 1s；更长延迟应来自 provider / tool cognition，不应来自人工 sleep |
| 一条人类消息创建重复任务 | 检查 `conversation_messages.metadata.qq_dedupe_key` |

NapCat 登录保活：

- 生产机通过 `mortis-napcat-watchdog.timer` 每分钟运行 `/usr/local/bin/napcat-watchdog`。
- watchdog 会检查 `3600/3610/3620/3630` 四个端口的 `get_login_info`，把状态 JSONL 写入 `/srv/multica/openlist-export/runtime/napcat-watchdog-state.jsonl`，并在某个 role 离线或 UIN 不匹配时用其他在线账号向 QQ 群报警。
- `/home/ubuntu/napcat/docker-compose.yml` 里每个 NapCat service 都必须固定 `ACCOUNT`；快速登录密码放在 `/home/ubuntu/napcat/.env`，不写进 README。
- 本地 QQ 登录缓存不是永久凭据。QQ/NapCat 提示身份或登录态失效时，密码回退只能开始登录，腾讯仍可能要求短信/安全验证；这一步不能完全自动绕过。
- Builder/qq3 登录修复后必须用其他账号回读验证群内可见，不能把 `napcat-qq3` 的 `message_sent/self` 当成群里真的看见。

四个 NapCat 账号全部在线前保持 `MORTIS_QQ_LIVING_AGENTS_ENABLED=false`。Builder / Codex 能力仍集中在 Mortis backend；每个 QQ 账号是对外人格入口/出口，可以把工作路由进同一条执行链。

### 10.6 L3 验收关卡

1. 单任务自动执行：approved Builder action 自动进入 `running` / `completed`
2. 失败自动反馈：Codex 或测试失败时 invocation 进入 `failed` 或 `blocked`
3. 连续任务：一个 Builder action 完成后，下一个 approved Builder action 会被领取
4. 并行任务：多 dispatcher / runtime 时不能重复 claim 同一 action
5. 长时间稳定：24 小时内无卡死、无非法状态跳转、无自动部署

## 11. 免责声明

本文件只同步 `README.md` 的当前源码与部署事实说明，不对外部网络连通性、服务器实时状态、未验证的手工变更或生产环境临时修补作额外承诺。若私有服务器运行态与仓库记录漂移，应先更新 `README.md`、`project.json` 或 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`，再回补本文件。
