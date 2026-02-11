# GongXi Mail (廾匸邮箱)

使用 Microsoft OAuth2 进行邮箱收取的 API 服务。

## 技术栈

- **后端**: Fastify 5 + TypeScript + Prisma 6
- **数据库**: PostgreSQL
- **缓存**: Redis
- **前端**: React + Ant Design + Vite

## 项目结构

```
├── server/                 # 后端服务
│   ├── src/
│   │   ├── config/        # 环境配置
│   │   ├── lib/           # 核心库
│   │   ├── plugins/       # Fastify 插件
│   │   ├── modules/       # 业务模块
│   ├── prisma/            # 数据库 Schema
│   └── package.json
├── web/                    # 前端管理面板
├── docker-compose.yml
└── Dockerfile
```

## 快速开始

### Docker 部署

```bash
docker-compose up -d --build
```

访问 http://localhost:3000

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| NODE_ENV | 环境 | development |
| PORT | 端口 | 3000 |
| DATABASE_URL | PostgreSQL 连接 | - |
| REDIS_URL | Redis 连接 | - |
| JWT_SECRET | JWT 密钥 (≥32字符) | - |
| JWT_EXPIRES_IN | Token 过期时间 | 2h |
| ENCRYPTION_KEY | 加密密钥 (32字符) | - |
| ADMIN_USERNAME | 默认管理员用户名 | admin |
| ADMIN_PASSWORD | 默认管理员密码 | admin123 |

## API 文档

### 外部 API (`/api/*`)

需要在 HTTP Header 中携带 API Key：`X-API-Key: sk_xxx`

#### 接口列表

| 接口 | 说明 | 注意事项 |
|------|------|----------|
| `/api/get-email` | 获取一个未使用的邮箱地址 | 会标记为当前 Key 已使用 |
| `/api/mail_new` | 获取最新邮件 | - |
| `/api/mail_text` | 获取最新邮件文本 (脚本友好) | 可用正则提取内容 |
| `/api/mail_all` | 获取所有邮件 | - |
| `/api/process-mailbox` | 清空邮箱 | - |
| `/api/list-emails` | 获取系统所有可用邮箱 | - |
| `/api/pool-stats` | 邮箱池统计 | - |
| `/api/reset-pool` | 重置分配记录 | 释放当前 Key 占用的所有邮箱标记 |

#### 使用流程

1. **获取邮箱**：
   ```bash
   curl -X POST "/api/get-email" -H "X-API-Key: sk_xxx"
   # {"success": true, "data": {"email": "xxx@outlook.com"}}
   ```

2. **获取邮件内容 (推荐)**：
   自动提取验证码（6位数字）：
   ```bash
   curl "/api/mail_text?email=xxx@outlook.com&match=\\d{6}" -H "X-API-Key: sk_xxx"
   # 返回: 123456
   ```

3. **获取完整邮件 (JSON)**：
   ```bash
   curl -X POST "/api/mail_new" -H "X-API-Key: sk_xxx" \
     -d '{"email": "xxx@outlook.com"}'
   ```

#### 参数说明

**通用参数**：
| 参数 | 说明 |
|------|------|
| email | 邮箱地址（必填） |
| mailbox | 文件夹：inbox/junk |
| socks5 | SOCKS5 代理 |
| http | HTTP 代理 |

**`/api/mail_text` 专用参数**：
| 参数 | 说明 |
|------|------|
| match | 正则表达式，用于提取特定内容 (例如 `\d{6}`) |

## License

MIT