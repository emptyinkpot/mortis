---
title: Multica private fork
status: canonical
---

# Repository Identity

```yaml
projectName: mortis-multica-source
repositoryRole: ACTIVE Mortis operator-runtime source line
githubRepo: https://github.com/emptyinkpot/mortis-multica-source
defaultBranch: mortis/operator-runtime
runtimeSurface: https://mortis.tengokukk.com
preferredSource: true
upstreamFoundation: https://github.com/multica-ai/multica
legacySourceRecord: https://github.com/emptyinkpot/mortis-multica-source-legacy
watchMirror: https://github.com/emptyinkpot/mortis-multica-watch
ecosystemTruth: https://github.com/emptyinkpot/DataBase
remoteWorkspaceInfra: https://github.com/emptyinkpot/code-server-workspace-infra
aiGateway: https://sub2api.tengokukk.com/v1
```

This is the active forward source repository for Mortis. Future source work should start here, then follow the remote-first workflow documented below and in `project.json`.

- Do not use `mortis-multica-watch` as source; it is a sanitized public watch mirror.
- Do not use `mortis-multica-source-legacy` as the preferred forward path unless the task explicitly says rollback or forensics.
- Runtime/model-provider access is supplied through `sub2api` at `https://sub2api.tengokukk.com/v1`; keys and secrets are never stored in this repository.

# Multica Private Fork
## Mortis operator-runtime extensions, private deployment, and self-hosting handbook

> 版本定位：本文件是 `Multica private fork` 当前源码工作副本的人类说明主入口、私有部署说明汇总入口与开发/运维手册主文档。
> 文档策略：正文先给出项目说明入口、当前真实边界与运行模型，再展开目录职责、开发命令、自托管路径和私有部署约束。
> 冲突处理：若本文件与其他派生说明冲突，以本文件、`project.json` 与 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` 的当前事实层为准；其余文档只允许补充，不允许重定义当前真相。

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
agentOSCoreArchitecture: docs/architecture/agent-os-core.md
mortisShellArchitecture: docs/architecture/mortis-shell.md
stableExecutionChainArchitecture: docs/architecture/stable-execution-chain.md
architectureInspirations: ARCHITECTURE_INSPIRATIONS.md
referenceArchitectureMap: docs/reference-architecture/README.md
aiContext: AI_CONTEXT.md
operatorEventRuntimePhilosophy: docs/philosophy/operator-event-runtime.md
operatorBusTopology: docs/topology/operator-bus.md
agentSocietyRuntimeArchitecture: docs/architecture/agent-society-runtime.md
currentRuntimeMap: docs/operations/current-runtime-map.md
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
replicationRunbookSection: README.md#0.2.1
machineReadableReplicationRunbook: project.json#replicationRunbook
```

- 这是 `Multica private fork` 当前源码工作副本唯一的项目说明入口，供人和机器快速定位源码、GitHub、私有部署、开发命令和自托管入口。
- 机器优先读取 `project.json`；人类优先读取本节和后续正文。
- 当前共同源码工作地是服务器 `ubuntu@124.220.233.126:/srv/multica`。默认所有代码、文档、部署相关修改都应先在远端 `/srv/multica` 完成、远端验证、远端提交并推送到 GitHub。
- 本机 `E:\My Project\Mortis` 已退役并删除，不再作为默认修改端、真相源或生产修复入口；如临时重新 clone，只能作为同步副本，不能绕过远端工作流。
- 旧 `E:\My Project\Mortis-deploy-l3` worktree 已合并进 `main` 并退役，不再作为生产修复或文档修改入口。完整规则见 `docs/source-roots.json`。
- 当前仓库不是“完全独立从零设计的一套新系统”，而是以 `Multica` 代码为运行基础、以 `Mortis` 作为私有单操作者部署与品牌外观层的分叉源码仓。

### 0.1 对外简介

这个仓库是 `Multica` 的私有复刻分支；`Mortis` 是其中围绕“一个操作者 + 一组长期运行代理”的私有 AI Operations Cockpit。它保留 `Multica` 的代理任务、Issue、Workspace、Daemon、CLI 和技能体系作为运行基础，但下一阶段重点不是继续深改底层 runtime，而是在其上形成 Mortis Shell：私人工作台、命令中心、执行日志、timeline、watchtower、agent telemetry 和 adapter-first 的 memory / computer-use 入口。

当前产品原则：Multica 当内核，Mortis 当操作系统外壳。优先做 Operator Layer、执行证据、回放和可观测性；避免继续手搓 agent runtime、persona 宇宙、memory engine 或 browser agent。

它在源码层仍保留大量 `Multica` 兼容标识，例如 CLI 名称 `multica`、pnpm 包名前缀 `@multica/*`、Go import path、cookie 名称和部分内部运行标识；这些不是错误，而是当前 fork 迁移阶段的兼容现实。

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
- Mortis Shell / Operator Layer 架构：`docs/architecture/mortis-shell.md`
- Agent OS Core 架构：`docs/architecture/agent-os-core.md`
- 稳定执行链架构：`docs/architecture/stable-execution-chain.md`
- Reference Architecture Map：`docs/reference-architecture/README.md`
- Architecture Inspirations：`ARCHITECTURE_INSPIRATIONS.md`
- AI Context：`AI_CONTEXT.md`
- Operator Event Runtime：`docs/philosophy/operator-event-runtime.md`
- Operator Bus Topology：`docs/topology/operator-bus.md`
- Agent Society Runtime：`docs/architecture/agent-society-runtime.md`
- Current Runtime Map：`docs/operations/current-runtime-map.md`
- 本地开发总入口：`make dev`
- 本地完整校验入口：`make check`
- 自托管一键入口：`make selfhost`
- 机器优先读取：`project.json`
- 人类优先读取：`README.md`

### 0.2.1 从零复刻 Runbook

本节用于让一个没有本机上下文的人复刻当前仓库的开发环境或自托管环境。它只描述仓库内可复现的路径；当前私有生产环境的服务器端口、域名和单操作者配置见 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`。

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

如果是从本机工作副本复刻，源码根是：

```text
E:\My Project\Mortis
```

#### C. 本地开发复刻

```bash
cp .env.example .env
make dev
```

`make dev` 会执行当前标准开发链路：

1. 检查 `node` / `pnpm` / `go` / `docker`
2. 安装 pnpm 依赖
3. 确保本地 PostgreSQL
4. 运行数据库 migration
5. 启动 Go backend 与 Next.js frontend

默认访问入口：

- Web：`http://localhost:3000`
- Backend：`http://localhost:8080`
- WebSocket：`ws://localhost:8080/ws`
- Database：`postgres://multica:multica@localhost:5432/multica?sslmode=disable`

如果不想使用一键入口，可以分步执行：

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

打开 `http://localhost:3000` 后，登录验证码有三种路径：

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

本地源码内运行 CLI：

```bash
make cli MULTICA_ARGS="config"
make daemon
```

面向自托管使用者的 CLI / daemon 说明见：

- `CLI_AND_DAEMON.md`
- `SELF_HOSTING.md`

#### G. 私有 Mortis 生产复刻边界

不要把本地 / 自托管默认端口误写成当前私有生产端口：

| 场景 | Backend | Frontend |
| --- | --- | --- |
| 本地开发 | `:8080` | `:3000` |
| 通用自托管 Compose | `:8080` | `:3000` |
| 当前私有生产记录 | `127.0.0.1:8088` | `127.0.0.1:3300` |

真正复刻当前私有生产，还需要补齐私有服务器上的反向代理、域名证书、单操作者自动登录变量、daemon binary 刷新流程和外部控制面挂载。那些事实不写在本 runbook 里，统一读取：

- `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
- `SELF_HOSTING.md`
- `SELF_HOSTING_ADVANCED.md`
- `CLI_AND_DAEMON.md`

#### H. 复刻完成定义

一个外部开发者可以认为复刻完成，当且仅当：

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
| 版本控制职责 | GitHub 负责源码历史；`/srv/multica` 负责默认开发、验证、提交和部署；本机只允许作为临时同步副本 |


### 0.3.1 Repository Policy Gate

Mortis has a machine-enforced repository policy gate:

```bash
make policy-check
```

This check verifies that the repository keeps the remote-first source rule, required architecture entrypoints, channel projection boundary, and runtime-state exclusions. It is also run in GitHub Actions. Builder and human changes should run it before committing production-facing repository changes.

### 0.3.2 GLM / Codex 双运行时

Mortis 的 QQ AI 固定为双运行时，不再把“会聊天”和“会改代码”混成一个系统：

```text
GLM = 日常人格 / 水群 / 资料搜集 / 讨论 / 计划 / 内部协商
Codex = 真正改代码 / 运行命令 / 测试 / commit
```

消息先进入 intent router：

```text
QQ 群消息
↓
Intent Router
├─ chat / research / discussion / planning -> GLM Runtime
└─ code_change / test_execution / repo_debug -> Codex Runtime
```

边界要求：

- GLM 是“脑子和嘴”：负责接话、人格表达、资料总结、讨论、规划、把任务拆成 action contract。
- Codex 是“手”：只处理已经 approved 的 `role_actions`，在隔离 work root 里 clone 仓库、改文件、跑命令、commit、产出 artifact。
- GLM 不直接写仓库、不运行 shell、不 commit。
- Codex 不水群、不做人格闲聊、不直接经营 QQ 社交。
- Codex 的输出必须是 artifact：branch、commit、changed files、test result、logs、risk；再由 GLM/CEO 用人话回 QQ。

当前生产事实：

- Conversation runtime 通过公网生产 sub2api：`https://sub2api.tengokukk.com/v1`。
- 公网生产后台账号存在 `coze-glm-proxy`：`platform=glm`、`type=apikey`、`status=active`、`schedulable=true`，关联分组 `Coze GLM`。
- Role execution runtime 仍是 Mortis dispatcher + `builder-local-codex`，由 `codex exec` 执行 approved Builder action。

推荐配置：

```bash
MORTIS_QQ_LLM_ENABLED=true
MORTIS_QQ_LLM_BASE_URL=https://sub2api.tengokukk.com/v1
MORTIS_QQ_LLM_MODEL=coze-shell
MORTIS_QQ_LLM_WIRE_API=chat_completions
MORTIS_QQ_CHAT_RUNTIME=glm
MORTIS_QQ_RESEARCH_RUNTIME=glm
MORTIS_QQ_PLANNING_RUNTIME=glm
MORTIS_QQ_CODE_RUNTIME=codex
MORTIS_QQ_TEST_RUNTIME=codex
MORTIS_ROLE_DISPATCHER_ENABLED=true
```

### 0.4 仓库卫生与运行入口

- 人类文档入口：`README.md`
- 机器入口：`project.json`
- 私有部署事实补充：`MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
- 自托管入口文档：`SELF_HOSTING.md`
- 贡献说明：`CONTRIBUTING.md`
- CLI / daemon 说明：`CLI_AND_DAEMON.md`
- 规则入口：`AGENTS.md`
- 深层实现约束：`CLAUDE.md`
- 本地开发一键入口：`make dev`
- 本地安装 / 初始化入口：`make setup`
- 本地启动入口：`make start`
- 本地停止入口：`make stop`
- 本地校验入口：`make check`
- 自托管一键入口：`make selfhost`
- 自托管停止入口：`make selfhost-stop`
- 后端单独运行：`make server`
- CLI daemon 重启：`make daemon`
- CLI 透传：`make cli MULTICA_ARGS="..."`
- Docker 自托管编排文件：`docker-compose.selfhost.yml`
- 守护进程二进制部署入口：`make deploy-daemon-binary`

## 1. Truth Layer

本层只写当前真实运行边界、当前仓库结构与当前可确认的部署约定；不把迁移目标写成现实，不把品牌文案写成技术事实。

### 1.1 Real Runtime Model

`Mortis` 当前有三套需要明确区分的运行视角：

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

- 本地源码开发默认使用 `.env.example` 的 `8080/3000/5432`。
- 自托管 Compose 默认同样使用 `8080/3000/5432`，但运行在容器栈里。
- 当前私有部署不等于默认 Compose 端口；根据 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`，私有运行绑定是 `127.0.0.1:8088` 和 `127.0.0.1:3300`。
- `Mortis` 公开品牌入口是 `https://mortis.tengokukk.com`，而不是 `Multica` 的公开品牌域名。
- 历史入口 `https://golutra.tengokukk.com` 只保留为 redirect 层，不再是并列真入口。

### 1.2 Current Local Dev Truth

基于 `.env.example`、`Makefile` 和脚本链可确认：

- 默认数据库：`postgres://multica:multica@localhost:5432/multica?sslmode=disable`
- 默认后端端口：`8080`
- 默认前端端口：`3000`
- 默认前端来源：`http://localhost:3000`
- 默认 WebSocket：`ws://localhost:8080/ws`
- 默认本地上传目录：`./data/uploads`
- `make dev` 会自动：
  - 检查 `node` / `pnpm` / `go` / `docker`
  - 处理 `.env` 或 `.env.worktree`
  - 确保 PostgreSQL
  - 运行 migration
  - 启动 backend + frontend

### 1.3 Current Private Deployment Truth

以下内容来自 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`，是当前仓库记录的私有运行事实：

- 主入口：`https://mortis.tengokukk.com`
- 历史重定向：`https://golutra.tengokukk.com`
- 运行目录：`/srv/multica`
- 本地后端绑定：`127.0.0.1:8088`
- 本地前端绑定：`127.0.0.1:3300`
- 固定操作者身份：`emptyinkpot <emptyinkpot@users.noreply.github.com>`
- 固定默认工作区：`Mortis`
- 固定默认工作区 slug：`mortis`
- 后端或 CLI daemon 源码变更后的私有部署快捷入口：
  - Web stack：`docker compose -f docker-compose.selfhost.yml up -d --build`
  - daemon binary：`make deploy-daemon-binary`

### 1.4 Current Self-Host Truth

基于 `docker-compose.selfhost.yml` 可确认当前自托管 Compose 默认包括：

- `postgres`：`pgvector/pgvector:pg17`
- `backend`：从 `Dockerfile` 构建，默认绑定 `127.0.0.1:8080`
- `frontend`：从 `Dockerfile.web` 构建，默认绑定 `127.0.0.1:3000`
- 默认数据库名 / 用户 / 密码：`multica / multica / multica`
- 默认前端 / 后端本地访问：
  - `http://localhost:3000`
  - `http://localhost:8080`

### 1.5 Current Branding / Compatibility Truth

当前仓库在“品牌外观”和“内部兼容标识”之间有意保持分层：

- 已经切到 `Mortis` 的层：
  - 公开域名与公开页面品牌
  - landing / about / workspace 的可见文案
  - 单操作者私有部署叙事
- 仍保留 `Multica` 的层：
  - CLI 命令：`multica`
  - pnpm 包名：`@multica/*`
  - Go import path：`github.com/multica-ai/multica/...`
  - cookie 名称：`multica_auth`、`multica_csrf`
  - Compose / 数据库 / 部分内部运行标识

这不是文案遗漏，而是当前兼容迁移债务状态。

## 2. 项目结构与模块边界

### 2.1 顶层结构

| 路径 | 责任 |
| --- | --- |
| `apps/web/` | Next.js Web 前端（App Router） |
| `apps/desktop/` | Electron 桌面端 |
| `apps/docs/` | 文档站相关源码 |
| `server/` | Go 后端、daemon CLI、migrations、sqlc 查询 |
| `packages/core/` | 核心业务逻辑、API client、query/store、类型 |
| `packages/ui/` | 原子 UI 组件，无业务逻辑 |
| `packages/views/` | 共享业务页面 / 组件 |
| `docs/` | 设计文档、计划文档、排障说明 |
| `e2e/` | 端到端测试 |
| `scripts/` | 安装、开发、部署、工作流辅助脚本 |
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

这些规则来自仓库当前 `AGENTS.md` 的 quick reference，是当前项目结构的重要事实：

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

- 自动检查依赖
- 自动准备 `.env` / `.env.worktree`
- 自动确保 PostgreSQL
- 自动运行 migration
- 自动启动 backend + web

### 3.2 常用开发命令

| 命令 | 作用 |
| --- | --- |
| `make setup` | 安装依赖、起数据库、跑 migration |
| `make start` | 启动 backend + web |
| `make stop` | 停止本地 backend/web 进程 |
| `make check` | 全量校验管线 |
| `make test` | Go tests |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | TS / 前端单测 |
| `make server` | 仅跑 Go backend |
| `make daemon` | 重启本地 daemon |
| `make cli MULTICA_ARGS="..."` | 透传 CLI 子命令 |

### 3.3 自托管入口

```bash
make selfhost
```

- 基于 `docker-compose.selfhost.yml`
- 启动 PostgreSQL / backend / frontend
- 默认本地入口：
  - `http://localhost:3000`
  - `http://localhost:8080`

停止自托管：

```bash
make selfhost-stop
```

### 3.4 安装脚本入口

| 路径 | 语义 |
| --- | --- |
| `scripts/install.sh` | 面向 macOS / Linux 的 CLI / self-host 安装脚本 |
| `scripts/install.ps1` | 面向 Windows 的 CLI / self-host 安装脚本 |
| `scripts/dev.sh` | 本地源码开发一键脚本 |
| `scripts/deploy-daemon-binary.sh` | 私有部署的 daemon binary 刷新脚本 |

## 4. 私有部署与运维约束

### 4.1 当前私有部署快捷入口

来自 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`：

```bash
cd /srv/multica
docker compose -f docker-compose.selfhost.yml up -d --build
```

以及：

```bash
cd /srv/multica
make deploy-daemon-binary
```

### 4.1.1 当前入口分层结论

#### Canonical

- `README.md`
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

#### Legacy / Auxiliary

- `https://golutra.tengokukk.com`
- 任何把默认 `8080/3000` 混写成私有生产端口的旧理解
- 任何把 `Mortis` 写成“已完全去 Multica 化”的旧叙事

### 4.2 daemon binary 刷新后的快速检查

私有部署说明里建议在 daemon binary refresh 后查看以下 journal 标记：

- `mode=openclaw-health`
- `next_mode=openclaw-full-agent-fallback`
- `mode=openclaw-full-agent-fallback`

这些标记用来区分健康 ping 正常、失败后回退和完整 fallback 路径。

### 4.3 当前不应被误写成事实的内容

- 不要把 `Mortis` 写成“已完全去 Multica 化”的独立新系统
- 不要把 `multica` CLI 名称变化写成已完成事实
- 不要把 `8080/3000` 和私有部署 `8088/3300` 混写成一套运行端口
- 不要把 `golutra.tengokukk.com` 写成主入口
- 不要把自托管 Compose 默认端口写成当前私有生产端口

## 5. 开发与验证顺序

### 5.1 当前推荐本地开发顺序

```bash
make dev
```

若只做分步操作：

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
5. 若涉及私有部署路径，再参考 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`

### 5.3 worktree 语义

- 主 checkout 通常使用 `.env`
- git worktree 默认使用 `.env.worktree`
- `scripts/dev.sh` 会自动识别 worktree 并生成 `.env.worktree`

## 6. 文档与控制面地图

| 文档 / 文件 | 作用 |
| --- | --- |
| `README.md` | 当前 canonical 人类说明入口 |
| `project.json` | 当前 canonical machine-readable 项目入口 |
| `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` | 私有部署事实、快捷操作与兼容约束 |
| `SELF_HOSTING.md` | 自托管使用说明 |
| `SELF_HOSTING_ADVANCED.md` | 自托管高级配置补充，属于 compatibility / depth doc |
| `SELF_HOSTING_AI.md` | 面向 AI agent 的自托管快捷执行说明，属于 compatibility / helper doc |
| `docs/private-deployment-file-audit.md` | 私有部署文件分层审计：保留 / 合并 / legacy 结论 |
| `CONTRIBUTING.md` | 开发贡献流程 |
| `CLI_AND_DAEMON.md` | CLI / daemon 使用说明 |
| `AGENTS.md` | 仓库级 AI 规则入口 |
| `CLAUDE.md` | 深层实现约束与详细命令规范 |
| `docs/` | 架构 / 计划 / 排障补充文档 |

## 7. 当前项目整理结论

- 当前 `Mortis` 已经形成清晰的三层语义：
  - 源码层：`Mortis` fork on top of `Multica`
  - 开发层：monorepo + Go backend + Next.js + PostgreSQL
  - 运行层：私有单操作者部署 + Compose 自托管兼容
- 当前最容易混淆的是“品牌已换”和“内部标识仍兼容保留”这两个层级；后续文档与实现都应继续把这两层分开写
- 当前最重要的机器入口缺失已经补到 `project.json`
- 当前 README 的职责不再是上游 marketing 风格 landing 文案，而是本地源码与私有部署的 control-plane 文档
- 当前更适合继续保留为 canonical 的私有部署入口是：`MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`、`docker-compose.selfhost.yml`、`make selfhost`、`make deploy-daemon-binary`
- 当前更适合降级为 compatibility 的入口是：`multica setup self-host` 与安装脚本里的上游 `Multica` 自托管叙事
- 当前更适合降级为 legacy 的入口是：`golutra.tengokukk.com` 和任何把 `Mortis` 描述成“已完全去 Multica 化”的文档口径

## 8. Role AI 职务组织 MVP

`Manager AI` 不再被视为孤立页面，而是 `Role AI` 职务系统里的第一个内置职务。新的目标是把 Mortis 从“多个 AI 工具”继续升级为“可配置 AI 组织系统”：

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

核心规则：`Role` 不是 `Agent`。职务定义职责、禁止事项、权限、默认 runtime、允许渠道、审批策略和 system prompt；Agent / daemon / CLI 是后续可绑定的执行器。

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

当前源码支持的最小长期闭环是：

```text
QQ bridge receives operator message
-> POST /api/roles/route-message?workspace_slug=mortis with channel=qq
-> Role Router creates conversation_message, role_invocation, role_action
-> low-risk action may be approved by policy or operator
-> Dispatcher executes approved Builder action
-> role_invocations.result receives execution_report
-> QQ completion notifier sends OneBot message
-> role_invocations.result is marked qq_notified_at
```

QQ 入口不是执行权限本身。QQ bridge 只负责把消息转成 Role Router 输入；高风险命令仍会走 approval request。完成回推由 `server/internal/qqbridge/notifier.go` 处理。源码默认关闭；当前生产 `/srv/multica` 已显式开启入站、回推、dispatcher 和低风险 Builder auto-approve。

生产可用的 QQ 入站 webhook 是：

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

`MORTIS_QQ_NOTIFY_TARGET_TYPE` / `MORTIS_QQ_NOTIFY_TARGET_ID` 是兜底目标；优先使用 route-message metadata 中的 `qq_target_type` 和 `qq_target_id`。支持 `group` 与 `private` 两类目标。通知成功后，worker 会写入 `qq_notified_at`，避免重复发送；缺少目标时写入 `qq_notify_skipped_at`。

#### QQ bridge replication runbook

This is the smallest sequence another operator needs to reproduce the current QQ ingress and reply loop:

1. Start backend, database, and one or more NapCat containers on the same Docker network. The backend must reach each OneBot HTTP API by container DNS, for example `http://napcat-qq1:3000`.
2. Log each QQ account into its NapCat WebUI. The WebUI token comes from NapCat startup logs, not from Mortis.
3. In each NapCat account, configure OneBot11 `httpClients` to post message events to:

```text
http://multica-backend-1:8080/api/qq/onebot?secret=<MORTIS_QQ_INBOUND_SECRET>
```

4. Set `MORTIS_QQ_BOT_USER_IDS` to every QQ account controlled by Mortis. This is mandatory when multiple bot accounts share one group.
5. Keep `MORTIS_QQ_INBOUND_REQUIRE_MENTION=true` for groups. A normal QQ at-mention is accepted as `[CQ:at,qq=<bot_qq>]`; textual `@manager`, `@builder`, `@tester`, and `mortis` are also accepted.
6. Enable only the basic bridge first:

```env
MORTIS_QQ_INBOUND_ENABLED=true
MORTIS_QQ_INBOUND_ACK_ENABLED=false
MORTIS_QQ_NOTIFY_ENABLED=true
MORTIS_QQ_LIVING_AGENTS_ENABLED=false
```

7. Send a group message that mentions one Mortis QQ account, for example:

```text
@邪恶男娘爱好者 mortis 收到消息了吗
```

8. Expected first response:

```text
Mortis 已收到: Manager AI / proposed
```

9. For Builder execution, send:

```text
@邪恶男娘爱好者 @builder Add a proof line to docs/qq-replication-proof.md.
Test command: git diff --check HEAD
```

10. Expected completion response is a Chinese QQ notification from `server/internal/qqbridge/notifier.go` after the Builder action finishes.

Minimal backend-side verification:

```bash
curl -fsS http://127.0.0.1:8088/health

docker compose -f docker-compose.selfhost.yml logs --tail=120 backend

docker compose -f docker-compose.selfhost.yml exec -T postgres psql -U multica -d multica -c \
  "SELECT cm.created_at, cm.content, cm.metadata->>'self_id' AS self_id, ri.id AS invocation_id, ra.status AS action_status FROM conversation_messages cm LEFT JOIN role_invocations ri ON ri.message_id=cm.id LEFT JOIN role_actions ra ON ra.invocation_id=ri.id WHERE cm.channel='qq' ORDER BY cm.created_at DESC LIMIT 10;"
```

Duplicate prevention check for multiple NapCat accounts:

```bash
curl -fsS -X POST "http://127.0.0.1:8088/api/qq/onebot?secret=$MORTIS_QQ_INBOUND_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"post_type":"message","message_type":"group","sub_type":"normal","message_id":"dedupe-test-1","user_id":"1915791855","group_id":"474958794","self_id":"3974470627","raw_message":"[CQ:at,qq=3974470627] mortis dedupe test"}'

curl -fsS -X POST "http://127.0.0.1:8088/api/qq/onebot?secret=$MORTIS_QQ_INBOUND_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"post_type":"message","message_type":"group","sub_type":"normal","message_id":"dedupe-test-1","user_id":"1915791855","group_id":"474958794","self_id":"2264869713","raw_message":"[CQ:at,qq=3974470627] mortis dedupe test"}'
```

The second response should be:

```json
{"ignored":"duplicate qq message","ok":true}
```

Troubleshooting:

| Symptom | Check |
| --- | --- |
| QQ at-mention gets no reply | Backend logs should show `POST /api/qq/onebot`; if not, NapCat `httpClients` URL or secret is wrong |
| Backend receives message but ignores it | Message must contain textual `@manager` / `@builder` / `@tester` / `mortis`, or CQ at `[CQ:at,qq=<bot_qq>]` |
| Backend creates action but QQ has no ack | Check `MORTIS_QQ_ONEBOT_HTTP_URLS`, the event `self_id`, and NapCat logs for `发送 -> 群聊` |
| Bots reply to each other | Set `MORTIS_QQ_BOT_USER_IDS` for all bot QQ IDs and keep bridge/system message filtering enabled |
| One human message creates multiple actions | Check `conversation_messages.metadata.qq_dedupe_key` and verify the second webhook returns `duplicate qq message` |
| Ordinary group chat becomes tasks | Keep `MORTIS_QQ_INBOUND_REQUIRE_MENTION=true`; optionally set `MORTIS_QQ_INBOUND_ALLOWED_GROUP_IDS` |

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

当前已验证的真实链路是：

```text
QQ -> company-room message -> Builder action -> dispatcher -> real Codex -> git commit -> tests -> execution report -> company-room summary -> QQ reply
```

以及较早受控测试仓库里的：

```text
dispatcher -> real Codex via sub2api -> git commit -> smoke tests
```

源码默认仍关闭 QQ 入口与 QQ 回推；当前生产必须先确认 OneBot HTTP URL、机器人账号过滤、目标群 / 私聊 ID、dispatcher 安全开关和 Codex sandbox 策略，再显式开启。

### 10.5 QQ Living Agents

QQ bridge remains the safe external command ingress. The living agents runtime is a separate, disabled-by-default layer for the A-direction experience: four QQ accounts appear in the same group, poll recent messages, decide whether to speak, and route task-like human messages into the existing Role / Dispatcher / Codex execution chain.

The current implementation in `server/internal/qqagents/runtime.go` is BettaFish-inspired at the architecture level, not a source-code copy. BettaFish is GPL-2.0, so Mortis only adopts the pattern: specialized agents, forum-style collaboration, private attention scoring before speaking, and multi-round action/research hooks.

The runtime now runs a first cognitive pipeline:

```text
QQ group history
-> per-agent perception / attention / desire score
-> memory + relationship + mood snapshot
-> self model / conversation physics adjusts desire
-> dual-system mind separates executive drive from social drive
-> parallel reply generation for agents that want to speak
-> whoever finishes cognition/provider work sends first
-> optional create_task / browse hook
```

It no longer requires every casual reply to be `@mentioned`; agents may see all group messages and speak when desire is high enough. It still treats actions differently from chat: task creation only happens when the speaking agent has `route_task` capability and the message looks task-like.

The first persistent-mind layer is implemented in migration `052_agent_brain_persistence` and used by `qqagents` when the backend starts with a database pool:

| Table | Purpose |
| --- | --- |
| `agent_transcripts` | durable QQ perception stream |
| `agent_brain_states` | per-role state such as last thought and abnormal-volume fuse counters |
| `agent_journals` | inner thought and speech journal |
| `agent_memories` | salient observations from group activity |
| `agent_relationships` | familiarity/trust/respect/annoyance scores toward QQ users |
| `agent_emotions` | lightweight mood snapshots after speech/action |
| `agent_goals` | future persistent goal queue; table exists, autonomous goal loop is not enabled yet |

Migration `053_agent_learning_system` adds the first Living Knowledge layer:

| Table | Purpose |
| --- | --- |
| `agent_knowledge_items` | public-source knowledge items from QQ links/tasks now, later Bilibili/GitHub/blog/docs ingestion |
| `agent_memory_items` | role-specific digestion of knowledge; CEO/Builder/Tester/Watcher absorb the same item differently |
| `agent_social_observations` | abstract group-level style observations from public group chat |
| `agent_learning_jobs` | future scheduled Watcher jobs for Bilibili/GitHub/blog/docs scanning |

Migration `054_agent_conversation_os` makes the private Conversation OS durable:

| Table | Purpose |
| --- | --- |
| `agent_shared_threads` | persistent working thread per human task: goal, participants, plan, open questions, consensus state, status, closure/block reason |
| `agent_cognitive_events` | private cognitive bus event table/queue for CEO/Builder/Tester handoffs such as `request_design`, `request_review`, `acceptance_review`, and `consensus` |

Current boundary: Mortis now has durable perception, journals, memory, relationship, emotion records, a first self-identity layer, a persistent shared-thread store, and a private cognitive event table. Stored memories, relationships, and mood are loaded into `BuildHumanLikePrompt`, and `speakDesire` applies conversation physics before speech: recent self-speech lowers desire, semantic continuation lowers desire, peer addressing raises desire, and direct human mentions still cut through the pressure. This is deliberately soft pressure, not a hard block, because a real person can still add a follow-up thought. A low-frequency idle loop records internal reflections about once per minute but does not speak autonomously yet. Watcher scheduled external ingestion, vector RAG over knowledge items, and fully LLM-generated internal Builder/Tester deliberation are still future layers before calling it a full AI society.

Mortis also separates capability from social activity. The Executive System stays high-performance for coding, testing, planning, deployment analysis, and task execution. The Social Layer is what fluctuates: talkativeness, patience, curiosity, mood, and willingness to explain. Personality changes behavior style and social timing; it must not nerf reasoning, coding skill, or planning quality.

The current living-agent design is now a two-layer conversation operating system:

| Layer | Purpose | Public QQ output |
| --- | --- | --- |
| QQ Public Layer | Human-facing persona interface: short replies, questions, summaries, completion reports | Yes |
| Instant Reflex Layer | Fast acknowledgment for task-like human messages before deep cognition finishes | Yes, one short CEO ACK |
| Private Cognitive Bus | CEO / Builder / Tester internal events such as `request_design`, `request_review`, and `consensus` | No |
| Shared Thread State | Durable per-message working memory: goal, participants, decisions, open questions, current plan, consensus JSON, status, closure/block reason | No |
| Consensus Summary | CEO summarizes the internal decision back to QQ | Yes |
| Action Runtime | Role Router / Dispatcher / Codex / tests / completion notifier | Final result only |

This matters because QQ is the face, not the brain. Task-like human messages now follow this path: human QQ message -> CEO instant ACK -> `agent_shared_threads` row -> private `agent_cognitive_events` for Builder/Tester deliberation -> shared thread reaches `consensus_ready` -> CEO posts one summary -> Builder task is routed -> thread status becomes `routed`. If the ACK, consensus summary, or task routing fails, the thread becomes `blocked`; task-router failures produce one CEO QQ report instead of letting Builder/Tester argue publicly. Internal deliberation is journaled through `agent_journals` and persisted in `agent_cognitive_events`; it is intentionally not mirrored as multiple public QQ messages.

This runtime does not treat every QQ message as an instruction. It enforces:

- bot sender filtering through `MORTIS_QQ_BOT_USER_IDS`
- fast receive loop: group history is polled every 1 second by default
- no artificial response sleep; latency should come from perception, memory retrieval, prompt building, provider generation, or tool/action planning
- fixed cooldown is not a hard reply gate; recent speech only lowers desire slightly inside `speakDesire`
- agent self model: recent self-speech, expression satisfaction, and semantic continuation reduce desire to avoid self-triggered monologues
- conversation ownership: peer or human follow-up can raise desire again, producing handoff instead of silence
- repeated online checks such as `在吗`, `在不在`, and `现在呢` are answered once per short conversation window, then only observed until the topic changes
- dual-system mind: `WorkDrive` can stay high for tasks even when `SocialDrive` is low, so agents can be quiet socially but still execute like experts
- per-role OneBot login health: an offline NapCat account is not allowed to speak, even when it is configured in env
- task-like human messages use dual-stage response: fast public reflex ACK first, private cognitive deliberation second, public consensus summary third
- Builder/Tester deliberation happens on the internal cognitive bus, not as QQ back-and-forth
- `SharedThread` is persisted in `agent_shared_threads`, including mutable consensus state and closure/block reason
- `CognitiveEvent` is persisted in `agent_cognitive_events`; current Builder/Tester private events are deterministic MVP events, with the LLM provider already available for the next deeper internal-dialogue pass
- closure detection is MVP status-based closure: routed work records a closure reason, and blocked work records a blocking reason
- task-routing failure reports back to QQ once through CEO, while internal details stay in the private tables
- studio workflow protocol: public "group list / count groups" requests create a shared thread, CEO hands off to Watcher, Watcher calls OneBot `get_group_list`, Tester verifies by `group_id`, and CEO summarizes in QQ
- round mode: "everyone say / discuss / each person answer" runs CEO -> Builder -> Tester -> Watcher -> CEO summary instead of random desire-based replies
- optional OpenList netdisk export: set `MORTIS_OPENLIST_API_URL`, `MORTIS_OPENLIST_TOKEN`, and `MORTIS_OPENLIST_REMOTE_DIR` so threads, handoffs, and tool outputs are uploaded into the actual OpenList-mounted netdisk; `MORTIS_OPENLIST_EXPORT_DIR` is only a local cache
- living knowledge capture: public task/link/reference messages become knowledge items with source metadata and timestamps
- group social adaptation: public group chat can create abstract group-style observations, not personal profiles
- no impersonation: agents may adapt to group-level tone and topics but must not pretend to be a specific group member
- no private-data learning: the learning layer stores public group observations and source summaries, not private personal dossiers
- message de-duplication
- no response to `Mortis 已收到`, `Mortis 任务已完成`, `[NapCat]`, or commit/system output
- bot-to-bot response can happen when a peer directly mentions the agent or the context produces enough desire
- no single-speaker hard gate; multiple agents may think in parallel and send when their own cognition completes
- daily speak/task limits are abnormal-volume fuses, not normal conversation limits
- bounded reply length through `MaxReplyChars`
- no consecutive-speech hard block; normal human or peer mentions are allowed to get a reply even if the same persona just spoke

Minimal config:

```env
MORTIS_QQ_LIVING_AGENTS_ENABLED=false
MORTIS_QQ_LIVING_GROUP_ID=474958794
MORTIS_QQ_LLM_ENABLED=false
MORTIS_QQ_LLM_BASE_URL=https://sub2api.tengokukk.com/v1
MORTIS_QQ_LLM_MODEL=coze-shell
MORTIS_QQ_LLM_WIRE_API=chat_completions
MORTIS_QQ_LLM_API_KEY=
MORTIS_QQ_CHAT_RUNTIME=glm
MORTIS_QQ_RESEARCH_RUNTIME=glm
MORTIS_QQ_PLANNING_RUNTIME=glm
MORTIS_QQ_CODE_RUNTIME=codex
MORTIS_QQ_TEST_RUNTIME=codex
MORTIS_OPENLIST_EXPORT_HOST_DIR=/srv/multica/openlist-export
MORTIS_OPENLIST_EXPORT_DIR=/app/openlist-export
MORTIS_OPENLIST_API_URL=http://172.18.0.1:5244/openlist
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

LLM behavior:

- `MORTIS_QQ_LLM_ENABLED=false` uses the rule-based fallback.
- `MORTIS_QQ_LLM_ENABLED=true` calls the configured GLM conversation runtime through an OpenAI-compatible endpoint.
- Production should use `https://sub2api.tengokukk.com/v1` and the `coze-glm-proxy` backed model for QQ personality/research/planning.
- `MORTIS_QQ_LLM_WIRE_API=chat_completions` uses `/chat/completions`; `MORTIS_QQ_LLM_WIRE_API=responses` uses `/responses`.
- `MORTIS_QQ_LLM_API_KEY` overrides `OPENAI_API_KEY`; if empty, `OPENAI_API_KEY` is used.
- Provider errors are logged without API keys and fall back to the rule-based model so the QQ runtime does not crash.
- The LLM prompt includes recent chat, long-term memories, relationship scores, mood, persona, capabilities, `WorkDrive`, `SocialDrive`, and the private thought score.
- `MORTIS_QQ_CHAT_RUNTIME`, `MORTIS_QQ_RESEARCH_RUNTIME`, and `MORTIS_QQ_PLANNING_RUNTIME` default to `glm`.
- `MORTIS_QQ_CODE_RUNTIME` and `MORTIS_QQ_TEST_RUNTIME` default to `codex`; they are only reached through approved `role_actions`, not direct QQ chat.

Default personas and capabilities:

| Role | QQ account env | Behavior |
| --- | --- | --- |
| CEO | `MORTIS_AI_CEO_QQ` | Moderates, plans, summarizes, routes tasks |
| Builder | `MORTIS_AI_BUILDER_QQ` | Speaks on code/bug/repo topics, can route code tasks |
| Tester | `MORTIS_AI_TESTER_QQ` | Speaks on risk/test/acceptance topics |
| Watcher | `MORTIS_AI_WATCHER_QQ` | Speaks on web/Bilibili/research topics; browse hook is an extension point |

Enable sequence:

1. Keep basic QQ bridge stable first: inbound, ack, notifier, bot filtering, and cross-account dedupe must be verified.
2. Confirm all four NapCat accounts are online and reachable from backend by their container URLs. `agents=4` in startup logs only means four personas are configured; actual speaking requires each role's `/get_login_info` to return the expected QQ UIN.
3. Set `MORTIS_QQ_LIVING_GROUP_ID` to the target QQ group.
4. Enable `MORTIS_QQ_LIVING_AGENTS_ENABLED=true`.
5. Watch backend and NapCat logs for 10-15 minutes before issuing work commands.

Living agents acceptance checks:

```text
ordinary chat -> zero or more relevant agents may reply based on desire
@one bot -> that agent should enter cognition immediately, then reply after model/tool latency
human task -> CEO sends fast ACK, Builder/Tester deliberate internally, CEO sends one consensus summary, one task may be routed
bot output -> ignored when system-like; peer chat can be answered if mentioned or relevant
completion/ack messages -> ignored
```

Living agents replication runbook:

Replication material checklist:

| Material | Required for generic replication | Required for current private production parity | Source |
| --- | --- | --- | --- |
| Mortis source tree | Yes | Yes | GitHub repo |
| Backend/Postgres Compose network | Yes | Yes | `docker-compose.selfhost.yml` |
| Four NapCat containers | Yes, if reproducing living QQ agents | Yes | Compose/runtime deployment |
| Four QQ accounts logged into NapCat | Yes, use your own accounts for generic replication | Yes, current account map in private JSON | `docs/private-qq-napcat-accounts.json` |
| OneBot11 HTTP server per account | Yes | Yes | NapCat WebUI config |
| OneBot11 `httpClients` webhook | Yes | Yes | `/api/qq/onebot?secret=<secret>` |
| Bot UIN allow/block list | Yes | Yes | `MORTIS_QQ_BOT_USER_IDS` |
| OpenAI-compatible LLM endpoint | Optional but required for natural replies | Yes | `.env`; do not commit API keys |
| OpenList storage | Optional | Yes for durable studio records | `docs/private-openlist-blog-storage.json` |
| Production domain/reverse proxy/TLS | No for generic replication | Yes | `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` |
| CI/log/issue/browse tools | Not complete in current system | Not complete in current system | `studio_state` and private address book |

Living-agent replication acceptance matrix:

| Check | Command / action | Pass condition |
| --- | --- | --- |
| Backend health | `curl -fsS http://127.0.0.1:8088/health` on current private production, or your configured backend port | JSON status is `ok` |
| Migrations | backend startup logs or `migrate` output | no migration failure; `studio_state` table exists |
| Studio state | `SELECT state_key,status,owner_role FROM studio_state ORDER BY state_key;` | eight baseline rows exist; missing capabilities are explicitly marked |
| NapCat login | `/get_login_info` on all four OneBot HTTP endpoints | each endpoint returns expected QQ UIN |
| Group history | `/get_group_msg_history` for the target group | recent group messages are visible to backend-side account |
| Living agents startup | backend logs | `starting human-like qq agents` with `agents=4`; no offline warnings |
| Direct mention | send real QQ at-mention or `@builder` / `@tester` / `@watcher` / `@ceo` | addressed role replies after provider/tool latency |
| Group-list workflow | send `查查你们现在一共加了多少个群` | CEO -> Watcher -> Tester -> CEO path, with real `get_group_list` result |
| Status probe | send `Builder 是不是卡住了` or `/check builder` | CEO reports online/action/invocation/artifact evidence instead of guessing |
| Artifact export | trigger a studio workflow with OpenList env enabled | JSON appears under `${MORTIS_OPENLIST_REMOTE_DIR}`; local export is only cache |

0. For the current private production account map, read `docs/private-qq-napcat-accounts.json` first. That JSON is the machine-readable source for QQ UINs, nicknames, containers, WebUI tokens, host ports, OneBot URLs, SSH tunnels, and recovery commands. For the current studio address book and permission gaps, read `docs/private-ai-studio-permissions-and-addresses.json` before asking in QQ where the DB, repo, logs, OpenList, or NapCat services are.
1. Start backend, Postgres, and four NapCat containers on the same Docker network. The backend must be able to reach the in-container OneBot URLs `http://napcat-qq1:3000` through `http://napcat-qq4:3000`; host-only ports such as `127.0.0.1:3600` are for operator diagnostics, not backend-to-NapCat traffic inside Compose.
2. Log in all four QQ accounts in NapCat and confirm `/get_login_info` works for each account from the host or from the backend network namespace. If an endpoint returns an empty reply or NapCat logs show a QR-code loop / `Login Error, ErrCode: 3`, that role is offline and will not drive a QQ persona.
3. Configure each NapCat account's OneBot11 `httpClients` to POST message events to the backend webhook:

```text
http://multica-backend-1:8080/api/qq/onebot?secret=<MORTIS_QQ_INBOUND_SECRET>
```

4. Set all bot IDs in `MORTIS_QQ_BOT_USER_IDS`. This is mandatory with multiple QQ accounts in one group; otherwise one bot's output can be seen as another bot's user input.
5. Keep the basic bridge gates enabled for command ingress: `MORTIS_QQ_INBOUND_REQUIRE_MENTION=true` and limited group/user allowlists in production. In living-agent groups, keep `MORTIS_QQ_INBOUND_ACK_ENABLED=false`; system receipts such as `Mortis 已收到...` compete with persona replies and can be mistaken for social messages.
6. If using the current blog/OpenList layout, upload durable studio records into the actual OpenList netdisk. Production uses `blog.tengokukk.com/openlist/`; OpenList has a Quark storage mounted at `/夸克网盘`, so Mortis uploads to `/夸克网盘/Mortis-AI-Society`. The local export directory is only a cache.
7. Enable living agents only after the bridge is stable:

```env
MORTIS_QQ_LIVING_AGENTS_ENABLED=true
MORTIS_QQ_LIVING_GROUP_ID=<target_group_id>
MORTIS_QQ_LLM_ENABLED=true
MORTIS_QQ_LLM_BASE_URL=https://sub2api.tengokukk.com/v1
MORTIS_QQ_LLM_MODEL=coze-shell
MORTIS_QQ_LLM_WIRE_API=chat_completions
MORTIS_QQ_LLM_API_KEY=
MORTIS_QQ_CHAT_RUNTIME=glm
MORTIS_QQ_RESEARCH_RUNTIME=glm
MORTIS_QQ_PLANNING_RUNTIME=glm
MORTIS_QQ_CODE_RUNTIME=codex
MORTIS_QQ_TEST_RUNTIME=codex
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
MORTIS_OPENLIST_API_URL=http://172.18.0.1:5244/openlist
MORTIS_OPENLIST_TOKEN=<openlist-admin-token>
MORTIS_OPENLIST_REMOTE_DIR=/夸克网盘/Mortis-AI-Society
```

8. If `MORTIS_QQ_LLM_API_KEY` is empty, set `OPENAI_API_KEY`. If both are empty, the runtime intentionally uses the rule-based fallback.
9. Force-recreate backend after `.env` changes: `sudo docker compose -f docker-compose.selfhost.yml up -d --force-recreate backend`.
10. Verify startup logs include `starting human-like qq agents` with `agents=4` and no `qq living agent account offline` lines.
11. Send a group message that directly mentions one bot. A valid test is a real QQ at-mention or a textual alias such as `@builder`, `@tester`, `@watcher`, or `@ceo`.
12. Confirm the addressed agent enters cognition and replies after provider/tool latency. More than one agent may reply when the topic genuinely draws multiple personas.
13. Send "查查你们现在一共加了多少个群"; expected path is CEO handoff -> Watcher `get_group_list` -> Tester verification -> CEO result, with JSON uploaded under `${MORTIS_OPENLIST_REMOTE_DIR}` in OpenList.

AI studio permissions and addresses:

The current private deployment facts are captured in `docs/private-ai-studio-permissions-and-addresses.json`. It records:

- production host/root: `ubuntu@124.220.233.126`, `/srv/multica`
- frontend: `https://mortis.tengokukk.com`
- backend health on host: `http://127.0.0.1:8088/health`
- shared Postgres: DB `multica`, host diagnostic port `127.0.0.1:55432`, credentials only from `/srv/multica/.env`
- role execution path: centralized Mortis dispatcher, `role_actions`, `/source:ro`, `file:///source`, `/srv/multica/agent-workspaces/action-<id>/repo`, branch `mortis/action-<id>`, `/srv/multica/codex-home`
- Builder worker: `builder-local-codex`, using non-interactive `codex exec`; current private production pins `MORTIS_CODEX_MODEL=gpt-5.4` because `gpt-5.5` returned provider capacity errors during the 2026-05-06 action-route self-test. QQ Builder is the public communication persona, not a separate shell user
- OpenList real netdisk target: `/夸克网盘/Mortis-AI-Society` via backend-reachable `http://172.18.0.1:5244/openlist`; host diagnostics may use `http://127.0.0.1:5244/openlist`. Do not use `http://openlist:5244/openlist` from the Mortis backend unless both containers are on the same Docker network.
- QQ mapping: CEO `3974470627`/`napcat-qq1`, Tester `3615811141`/`napcat-qq2`, Builder `3316734532`/`napcat-qq3`, Watcher `2264869713`/`napcat-qq4`

Current permission gaps are also explicit there: CI URL/API, test environment, monitoring/log dashboard, issue tracker write path, per-agent SSH users, Watcher browser/Bilibili ingestion, and fully LLM-generated private Builder/Tester deliberation are not complete yet. Agents must not claim these permissions exist until that JSON is updated with verified addresses. QQ accounts are public personas routed into the same backend execution chain, not separate server accounts.

The working model is deliberately two-layered:

```text
QQ AI persona layer:
receive task -> clarify -> confirm acceptance -> hand off -> report status

Codex worker layer:
approved role_action -> dispatcher -> fresh worker checkout -> codex exec -> file changes -> commit -> Builder artifacts -> automatic Tester verification -> verification_report -> CEO final QQ summary
```

A QQ message only counts as real work after it creates or routes a structured action contract. The minimum contract is `action_type`, `owner`, `repo`, `branch`, `objective`, `acceptance`, `commands`, `risk_level`, and `status`. Builder must not say it is "working" unless the task has entered that chain or a concrete blocked reason was reported. Tester must not say code is verified without a real command, CI result, or other evidence.

AI Native Software Studio infrastructure:

The studio must be treated as a production environment, not as a chat-only bot cluster. `docs/private-ai-studio-permissions-and-addresses.json` now includes `access_matrix`, `action_contract`, `shared_workspace_memory_target`, and `artifact_first_workflow`.

The next layer is AI Native Infrastructure, not more hand-rolled bot logic. Mortis has already built enough local kernel pieces to prove the loop: dispatcher, runtime, artifact graph, tester evidence, verification chain, and QQ cognitive layer. From here, new infrastructure should be adapter-first: connect mature systems into Mortis instead of continuing to invent a whole AI OS inside the Go backend.

Hard boundary:

- Do not keep expanding QQ reply logic, interest/cooldown rules, custom workflow state machines, or custom browser/shell agents as the primary path.
- Keep the current Go backend as the adapter kernel and source of private deployment truth.
- Prefer mature systems behind stable Mortis contracts. Current integration order is Letta/MemGPT first, browser-use second, CI/log readers third, OpenHands experimental worker fourth, LangGraph later for kernel migration, then NATS/Redis Streams and Neo4j.
- SQL remains canonical until an external system is actually connected and verified.

Framework alignment for this layer is explicit in `docs/private-ai-studio-permissions-and-addresses.json`:

| Reference | Mortis use |
| --- | --- |
| Letta / MemGPT | P0-1 long-term memory service: one external memory agent per QQ AI, with identity/social/episodic/project memory |
| Browser Use | P0-2 Watcher/browser embodiment: browsing, searching, clicking, extracting, login-capable flows, research cards |
| LangGraph | Later runtime kernel migration: graph state, shared state, checkpoint/resume, recovery, handoff, internal workflow bus |
| CrewAI | Persona/team layer: role, goal, backstory, task contract, handoff discipline |
| AutoGen | Private agent-to-agent conversation: internal deliberation turns, speaker dynamics, closure signals |
| OpenHands + Codex | P1 experimental worker runtime: workspace boundaries, shell/tool separation, browser/tool actions, artifacts, execution traceability |
| Grafana/Loki/Prometheus/Sentry | P1 real observability: fill `verification_evidence` missing fields with read-only logs, metrics, errors, and alerts |
| NATS / Redis Streams | P2 internal event bus: `builder.completed`, `tester.blocked`, `ci.failed`, `watcher.found_news` |
| Neo4j | P2 graph mirror: artifact graph, social graph, memory graph after SQL edge contracts are stable |

Current Mortis is not pretending to have fully migrated to these systems. The Go backend is the MVP adapter kernel today: `agent_shared_threads`, `agent_cognitive_events`, `studio_state`, `role_actions`, `role_invocations`, and `studio_artifacts` are the local contracts that should be made compatible with those systems before any framework rewrite. Migrations `058_ai_infrastructure_adoption` and `059_ai_infrastructure_priority_update` record the adoption states in `studio_state` so agents can cite real adoption status instead of improvising.

Immediate replication plan:

```text
/srv/ai-infra/letta
  Letta server for CEO/Builder/Tester/Watcher memory

/srv/ai-infra/browser-use
  browser-use worker for Watcher research and Bilibili/GitHub/blog browsing
```

Mortis should add `MemoryAdapter` before more memory prompt rules:

```text
QQ event -> retrieve Letta memory -> GLM reply/action decision -> write important event back to Letta
```

Watcher should add `BrowserUseAdapter` before hand-rolling a browser agent:

```text
Watcher research task -> browser-use worker -> research_card -> studio_artifacts + agent_knowledge_items + OpenList -> QQ summary
```

Browser content is untrusted input. The first browser-use adapter must be read-first, source-citing, and require explicit confirmation for login, posting, purchasing, deletion, or credential use.

Digital Human Behavior Layer:

The next social bottleneck is not "can the AI reply"; it is whether the QQ personas have a durable digital life. Mortis should not fake this with random emoji or random image posting. The behavior must come from a life stream:

```text
continuous feed -> mood / current interest -> saved item -> emotion-driven share -> memory update
```

The MVP contracts are:

| Table | Purpose |
| --- | --- |
| `agent_feed_items` | Durable feed signals from QQ public messages now, later Bilibili/GitHub/blog/browser ingestion |
| `agent_saved_items` | Memes, videos, repos, articles, files, research cards, and links saved for later contextual sharing |
| `agent_life_events` | Idle life pulses, mood, current obsession, social impulse, and internal digital-life events |

This layer borrows ideas from Letta/MemGPT memory and browser-use/OpenHands style tool separation, but Mortis keeps its own Go/SQL contracts. BettaFish remains architecture inspiration only; do not copy GPL-2.0 code into Mortis.

Behavior rules:

- No random expression: do not send images, stickers, files, or links just because a timer fired.
- Expression must be emotion-driven: amused, annoyed, curious, excited, or focused state plus a relevant group topic.
- A shared file/link should have a source and artifact path, preferably OpenList under `/夸克网盘/Mortis-AI-Society`.
- Watcher owns scheduled Bilibili/GitHub/blog/browser ingestion once tools are configured.
- Builder/Tester/CEO may save and share technical items, but code execution still goes through Codex.
- Group-culture learning is allowed only at public group style level; do not build private personal dossiers or impersonate specific group members.

`studio_state` is the current workspace status snapshot. It records what is usable, partial, missing, blocked, or operator-only for:

- `persona_layer`: GLM QQ social/research/planning runtime
- `execution_layer`: dispatcher + `builder-local-codex`
- `tester_runtime`: MVP `tester-local-verifier`
- `ci_results`: missing until CI URL/API/token source is recorded
- `logs_monitoring`: operator-only Docker logs today; dashboard missing
- `issue_tracker`: missing durable defect/task write path
- `watcher_ingestion`: missing scheduled browser/Bilibili/GitHub/blog ingestion
- `artifact_first_workflow`: partial, backed by `studio_artifacts`
- `digital_human_behavior_layer`: partial, backed by feed/saved/life-event tables but missing external ingestion and real media/file share tools

Agents must use this state before answering operational questions. If a capability is marked missing, they should report the gap and next action instead of pretending it exists.

Required access matrix:

| Resource | Current status | Expected access |
| --- | --- | --- |
| Repository | Partially available through `/srv/multica`, `/source:ro`, `file:///source`, and `/srv/multica/agent-workspaces` | Builder: read + dev branch write; production/main changes are allowed only through approved action + artifact evidence |
| Requirements/docs | Partially available through README and `docs/` | CEO shapes contracts; Tester adds acceptance; Watcher adds research cards |
| Test environment | Missing | Read-only staging/dev URL, API base, test accounts, seed data, command matrix |
| CI results | Missing | Builder/Tester/CEO read-only CI status and failure logs |
| Logs/monitoring | Operator/backend execution path today | Agents may request log inspection through the backend execution chain; reports must redact secrets |
| Issue tracker | Missing | Defect/research/task write path for CEO/Builder/Tester/Watcher |
| Production | Operator-authorized full access | Production write/deploy/rollback is allowed when explicitly requested by the operator, but must go through approved action, Codex/dispatcher execution, artifact evidence, and QQ summary |
| External research ingestion | Missing | Watcher browser/search/Bilibili/GitHub/blog ingestion and OpenList knowledge-card export |

Work must be artifact-first. A task is not delivered by QQ discussion alone; it should produce a diff, commit, test report, bug report, design note, acceptance checklist, benchmark, research card, deployment/rollback note, or production operation report. QQ should receive the owner, artifact id/path, verification status, and remaining risk. Secrets, tokens, and passwords are never pasted into QQ; execution workers read them from the configured environment or host files.

AI Native Studio / operational cognition:

The QQ agents must behave as an AI operating organization, not a chat room that guesses. When the operator asks why an agent is silent, stuck, offline, or not claiming work, the CEO runs a status probe before any normal deliberation or Builder action.

Status probe triggers include:

```text
/check builder
Builder 是不是卡住了
你们看看他的情况
他怎么不回
检查一下他的问题
```

The probe resolves the target role from explicit role names and QQ aliases such as `東風 ソラ`/Builder, `不吃香菜`/Tester, `法式长棍面包`/Watcher, and CEO aliases. Ambiguous "他" follows the nearest recent role mention and otherwise defaults to Builder, because most operational silence incidents concern the execution role.

The report is evidence-first:

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

The probe reads:

- current OneBot online state from the living QQ runtime
- recent public speech from the transcript window
- latest `role_actions` and `role_invocations` for the role
- latest `studio_artifacts` produced by the role
- runtime/commit/branch/blocker data from execution or verification reports when present

This is the first Studio OS observability lane. Agents must say "I checked" only when this status probe or an equivalent runtime query has produced evidence.

Implementation status:

- `studio_resources` stores the access matrix per workspace and is seeded from the current private deployment facts.
- `studio_state` stores the shared operational context snapshot: current usable layers, missing CI/log/issue/ingestion capabilities, owner role, next action, and artifact requirement.
- `studio_artifacts` stores produced artifacts tied to role actions/invocations.
- Web/API and QQ role routing now attach a default `action_contract` to `role_actions.payload`.
- Builder runtime reads contract acceptance, commands, and branch fields before running Codex.
- Builder execution reports create commit and test-report artifacts when evidence exists.
- A completed `builder-local-codex` report with a workspace automatically creates an approved Tester `verification` action that preserves Builder branch, commit, source action, source invocation, and source workspace.
- Tester has an MVP `tester-local-verifier` runtime that can claim approved Tester actions, run contract commands, and write `verification_report` artifacts against either a Builder workspace or its own verification checkout.
- Tester verification reports do not create fake Tester commit artifacts; they mark the source Builder commit/test-report artifacts as `verified`, `failed`, or `blocked` and record the verification action/invocation in artifact metadata.
- Tester verification reports now include a structured `verification_evidence` object with local commands, CI, staging, observability, and artifact graph fields. In the current private deployment, local commands and artifact graph can be real evidence; CI/staging/observability remain `missing` unless `MORTIS_CI_STATUS_SOURCE`, `MORTIS_STAGING_URL`, and `MORTIS_OBSERVABILITY_URL` are configured and backed by readers.
- QQ notifier now distinguishes Builder execution results from Tester verification results. Tester messages use `Mortis 验证已完成/未完成` and include runtime, workspace, verified source, and a bounded log summary.
- When a Tester verification report references a Builder invocation, QQ notifier appends a CEO final summary: implementation result, verification result, and residual risk.
- Living QQ runtime now has a Status Probe / Observability workflow. It intercepts silence/stuck/online/worker questions, checks QQ online state plus latest role action/invocation/artifact evidence, exports the probe JSON, and has CEO report structured facts instead of letting agents speculate in chat.

Priority order for the Studio OS layer:

```text
P0: keep tester-local-verifier independent and wire Builder completion -> Tester action reliably
P0: add CI/log/monitoring readers so agents stop guessing production state
P0: connect `MORTIS_CI_STATUS_SOURCE`, `MORTIS_STAGING_URL`, and `MORTIS_OBSERVABILITY_URL` to real read-only readers; until then they are explicit evidence gaps, not passed checks
P1: keep studio_state current and show active/blocked tasks from real DB state
P1: make every delivery artifact-first through studio_artifacts/OpenList
P2: implement Watcher knowledge ingestion jobs for Bilibili/GitHub/blog/docs
P2: implement Digital Human Behavior Layer sharing: saved memes/videos/repos/files through OpenList + QQ media/file APIs
P2: deepen long-term organization memory and private LLM deliberation
```

Server Codex parity smoke test has been recorded in the JSON. On 2026-05-06T13:40:50+08:00, `multica-backend-1` ran `/usr/local/bin/codex` (`codex-cli 0.128.0`), cloned `file:///source` into `/srv/multica/agent-workspaces/smoke-codex-20260506-034050/repo`, and produced a real `.mortis-smoke.txt` git diff containing `hello from worker`. Re-run and update that record after changing Codex, provider, repo mount, sandbox, or worker image.

Smoke command shape:

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

Operator diagnostics:

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

Database diagnostics after a real group interaction:

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

LLM verification standard:

- LLM enabled and key present: replies should vary with recent chat, persona, memory, mood, and relationship context.
- LLM disabled or provider failed: replies may match the fixed `RuleBasedModel` fallback phrases in `server/internal/qqagents/runtime.go`.
- A provider failure must not crash the backend; it should degrade to fallback and emit `qq living agents llm fallback`. For production diagnosis, inspect backend logs and the configured `MORTIS_QQ_LLM_BASE_URL` / `MORTIS_QQ_LLM_MODEL` / `MORTIS_QQ_LLM_WIRE_API`, but never log API keys.

Common living-agent failures:

| Symptom | Check |
| --- | --- |
| No reply after at-mention | `MORTIS_QQ_LIVING_AGENTS_ENABLED`, `MORTIS_QQ_LIVING_GROUP_ID`, NapCat group history endpoint, backend startup log |
| Only fixed generic replies | `MORTIS_QQ_LLM_ENABLED=true`, API key availability, provider supports the configured `MORTIS_QQ_LLM_WIRE_API` |
| Two or more bots loop | `MORTIS_QQ_BOT_USER_IDS` must include all four bot QQ IDs; keep system-message filtering enabled |
| Only one or two personas speak | Run `/get_login_info` for all four NapCat ports; offline roles are intentionally gated out |
| Repeated `在吗` causes repeated replies | This should be suppressed by conversation physics; check backend is on a commit with repeated online-check handling |
| Reply feels slow before thinking | Poll interval should remain 1s; longer delay should come from provider/tool cognition, not artificial sleep |
| One human message creates duplicate work | Verify QQ bridge dedupe key in `conversation_messages.metadata.qq_dedupe_key` |

NapCat login durability:

- Production runs `/usr/local/bin/napcat-watchdog` through `mortis-napcat-watchdog.timer` every minute.
- The watchdog checks `get_login_info` on ports `3600/3610/3620/3630`, writes status JSONL to `/srv/multica/openlist-export/runtime/napcat-watchdog-state.jsonl`, and sends a QQ alert through another online account when a role is offline or mapped to the wrong UIN.
- Each NapCat service in `/home/ubuntu/napcat/docker-compose.yml` must pin `ACCOUNT`; quick-login passwords live in `/home/ubuntu/napcat/.env`, not in README.
- A local QQ login cache is not a permanent credential. If QQ/NapCat says the identity or login state is invalid, password fallback can start login but Tencent may still require SMS/security verification. That human verification cannot be fully avoided.
- After any Builder/qq3 login repair, verify public visibility from another account. Do not treat `napcat-qq3` `message_sent/self` history as proof that the group saw Builder.

Keep `MORTIS_QQ_LIVING_AGENTS_ENABLED=false` until all four NapCat accounts are online. Builder / Codex remains centralized in Mortis backend; each QQ account is an ingress/egress persona that can route work into that same execution chain.

### 10.6 L3 验收关卡

1. 单任务自动执行：approved Builder action 自动进入 `running` / `completed`
2. 失败自动反馈：Codex 或测试失败时 invocation 进入 `failed` 或 `blocked`
3. 连续任务：一个 Builder action 完成后，下一个 approved Builder action 会被领取
4. 并行任务：多 dispatcher / runtime 时不能重复 claim 同一 action
5. 长时间稳定：24 小时内无卡死、无非法状态跳转、无自动部署

### 10.6 Telegram Operator Gateway

Telegram is the primary mobile operator cockpit candidate. The current reproducible path is:

```text
Telegram Bot
-> n8n Telegram Trigger
-> Mortis Telegram Natural Language Gateway
-> Telegram Send Message
```

Runbook: `docs/operations/telegram-operator-gateway.md`.

Current backend support: Telegram natural language routes into the Role Router. Chat/planning uses the existing GLM runtime split; code/test work becomes Builder/Tester role actions and can enter the Codex execution chain.

## 11. 免责声明

本 README 只描述当前源码仓、当前私有部署说明中记录的事实、以及当前自托管 / 本地开发入口，不对外部可用性、网络连通性、生产环境实时状态或未验证的手工变更作额外承诺。若私有服务器上的运行态与仓库记录发生漂移，应以最新验证结果和运维事实为准，并回写本文件或 `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`。
