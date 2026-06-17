<div align="center">

![LTAPI](/web/default/public/logo.png)

# LTAPI

**Enterprise-grade AI API Gateway based on [New API](https://github.com/QuantumNous/new-api)**

[English](./README.md) | [中文](./README-zh.md)

</div>

## Overview

LTAPI is an enterprise-focused AI API gateway built upon [New API](https://github.com/QuantumNous/new-api). It performs secondary development on the New API project, adding features suitable for enterprise use cases while retaining all core functionality.

## Enterprise Features

| Feature | Description |
|---------|-------------|
| Key Quota Query | Real-time token balance checking for API keys |
| Conversation Logging | Complete recording of user queries and model responses with full context |
| Enhanced Logging | Token and user information display in usage logs for better traceability |
| Multi-dimensional Query | Filter and search logs by token, token user, token creator, and more |
| End-to-End Encryption | AES-256-GCM encryption for request/response bodies, preventing man-in-the-middle attacks |
| Bare Path Compatibility | Support `/chat/completions` bare path requests, auto-normalized to `/v1/chat/completions` |
| Scheduled Task Log Silence | Reduced log noise from polling tasks (task/midjourney/options sync) |
| Mock Test Server | `mock-ai-server` for simulating upstream AI providers with encryption support |
| Route Strategy System | Dynamic routing based on LLM difficulty classification and Cron scheduling |
| Intent Classification | User request intent classification (work/non-work) with configurable classifiers |
| System Call Logging | Track token consumption for system-level AI calls (difficulty/intent classification) |

## Deployment

### Docker Compose (Recommended)

```bash
git clone https://github.com/QX9967/LTAPI.git
cd LTAPI

# Edit docker-compose.yml configuration
nano docker-compose.yml

# Start services
docker-compose up -d
```

### Docker Command

```bash
# Using SQLite (default)
docker run --name ltapi -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

After deployment, visit `http://localhost:3000` to start using.

## Tech Stack

- **Backend**: Go, Gin, GORM
- **Frontend**: React 19, TypeScript, Rsbuild, Tailwind CSS
- **Database**: SQLite / MySQL / PostgreSQL

## Acknowledgements

This project is based on [New API](https://github.com/QuantumNous/new-api). Special thanks to the original project team for their excellent work.

## License

This project inherits the [AGPLv3 License](./LICENSE) from the original project.
