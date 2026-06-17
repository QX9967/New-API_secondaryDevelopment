<div align="center">

![LTAPI](/web/default/public/logo.png)

# LTAPI

**基于 [New API](https://github.com/QuantumNous/new-api) 二次开发的企业级 AI API 网关**

[English](./README.md) | [中文](./README-zh.md)

</div>

## 项目简介

LTAPI 是基于 [New API](https://github.com/QuantumNous/new-api) 进行二次开发的 AI API 网关项目，专注于企业级应用场景。对 New API 项目进行二次开发，新增适合企业的功能，同时保留原项目的所有核心能力。

## 企业功能特性

| 功能 | 说明 |
|------|------|
| Key 额度查询 | 支持实时查询 API Key 的剩余额度 |
| 问答记录 | 完整记录用户询问问题和模型回复，保留完整对话上下文 |
| 日志增强 | 使用日志中显示令牌、令牌使用者信息，提升日志可追溯性 |
| 多维度查询 | 支持按令牌、令牌使用者、令牌创建者等多维度筛选和检索日志 |
| 端到端加密 | 支持 AES-256-GCM 加密传输，防止中间人窃听 |
| 裸路径兼容 | 支持 `/chat/completions` 裸路径请求，兼容 OpenCode 等客户端 |
| 定时任务日志静默 | 静默轮询任务的 GORM SQL 日志，减少日志噪音 |
| Mock 测试服务器 | 提供模拟上游 AI 供应商的测试服务器，便于本地调试 |
| 路由策略系统 | 支持基于 LLM 难度分类和 Cron 时间调度的动态路由策略 |
| 意图分类系统 | 支持用户请求意图分类（工作/非工作），可配置独立分类器 |
| 系统调用日志 | 记录系统级 AI 调用（难度/意图分类）的 token 消耗 |

## 部署

### Docker Compose（推荐）

```bash
git clone https://github.com/QX9967/LTAPI.git
cd LTAPI

# 编辑 docker-compose.yml 配置
nano docker-compose.yml

# 启动服务
docker-compose up -d
```

### Docker 命令

```bash
# 使用 SQLite（默认）
docker run --name ltapi -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

部署完成后访问 `http://localhost:3000` 即可使用。

## 技术栈

- **后端**: Go, Gin, GORM
- **前端**: React 19, TypeScript, Rsbuild, Tailwind CSS
- **数据库**: SQLite / MySQL / PostgreSQL

## 致谢

本项目基于 [New API](https://github.com/QuantumNous/new-api) 二次开发，感谢原项目团队的杰出工作。

## 许可证

本项目继承原项目的 [AGPLv3 许可证](./LICENSE)。
