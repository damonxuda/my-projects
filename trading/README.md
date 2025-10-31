# 📊 LLM Trading Observer

大语言模型量化交易观察系统 - 让AI自主交易，你只需观察

## 🎯 项目简介

这是一个完全Serverless的LLM量化交易观察平台，灵感来源于 **Alpha Arena** 比赛（6个主流大模型用真金进行加密货币交易）。

### 核心特点

- ✅ **完全模拟** - 虚拟资金，零风险
- ✅ **完全自动** - LLM自主决策，无需人工干预
- ✅ **完全免费** - Gemini API免费，Serverless架构成本极低（$0.5-1/月）
- ✅ **管理员专属** - 强安全控制，只有系统管理员可访问
- ✅ **实时观察** - Dashboard实时展示每个LLM的表现
- ✅ **隐私保护** - 完全匿名，LLM看不到你的个人信息

## 📐 系统架构

```
┌─────────────────────────────────────────────────────────┐
│  前端 (React)                                            │
│  ├─ Trading Dashboard (管理员专属)                       │
│  ├─ Agent Performance Cards                            │
│  ├─ Decision Timeline                                   │
│  └─ Performance Charts                                  │
└─────────────────────────────────────────────────────────┘
         │ HTTPS (Clerk Token)
         ↓
┌─────────────────────────────────────────────────────────┐
│  Supabase Edge Function                                 │
│  ├─ 验证管理员权限 (Clerk Token)                         │
│  ├─ 安全API层                                           │
│  └─ 读取交易数据                                         │
└─────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL                                    │
│  ├─ llm_trading_decisions (决策记录)                    │
│  ├─ llm_trading_portfolios (账户历史)                   │
│  └─ RLS 策略保护                                        │
└─────────────────────────────────────────────────────────┘
         ↑
         │ 写入
┌─────────────────────────────────────────────────────────┐
│  AWS Lambda (定时任务)                                   │
│  ├─ CloudWatch Events (每小时触发)                      │
│  ├─ 调用 Gemini API 分析市场                            │
│  ├─ 模拟交易执行                                         │
│  └─ 保存决策和账户状态                                   │
└─────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────┐
│  外部 API                                                │
│  ├─ Gemini API (免费) - AI决策                          │
│  └─ CoinGecko API (免费) - 市场数据                     │
└─────────────────────────────────────────────────────────┘
```

## 🔒 安全设计

### 三层安全防护

1. **前端层** - React App检查 `isAdmin`
   - 非管理员无法访问 `/trading` 路由
   - 界面完全隐藏

2. **API层** - Supabase Edge Function验证
   - 验证 Clerk Token
   - 检查用户邮箱是否在 ADMIN_EMAILS 中
   - 拒绝非管理员请求

3. **数据库层** - Row Level Security (RLS)
   - 只允许 service_role 访问
   - 前端无法直接查询数据库

### 隐私保护

```python
# Lambda 发送给 Gemini 的 prompt（完全匿名）
"""
你是专业交易员，分析：
- BTC价格: $67,000 (-2%)
- 账户: $10,000现金

返回决策
"""
# ✅ Gemini 看不到：你是谁、在哪里、真实资金
```

## 💰 成本分析

### 月度成本

```
AWS Lambda:
├─ 调用: 720次/月 (每小时1次)
├─ 免费tier: 100万次/月
└─ 成本: $0 ✅

Supabase:
├─ 数据库: 复用现有
├─ Edge Function: 免费tier内
└─ 成本: $0 ✅

S3 + CloudFront:
├─ 存储: 50MB
├─ 流量: ~1GB/月
└─ 成本: $0.5/月

Gemini API:
├─ 免费tier: 每天150万tokens
├─ 实际用量: 约3万tokens/月
└─ 成本: $0 ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━
总计: $0.5/月 🎉
```

## 🚀 快速开始

详细部署步骤请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

### 前置要求

- ✅ 已有 AWS 账户 + Supabase 项目
- ✅ 已有 Clerk 认证系统
- ✅ 管理员邮箱已配置在 `REACT_APP_ADMIN_EMAILS`
- ✅ 获取 Gemini API Key (免费)

### 5分钟快速验证

```bash
# 1. 初始化数据库
# 在 Supabase SQL Editor 中执行:
# backend/supabase/migrations/20250101000000_create_trading_tables.sql

# 2. 安装依赖
cd my-projects/trading
npm install

# 3. 配置环境变量
cp .env.example .env.production
# 编辑 .env.production，填入必要的环境变量

# 4. 本地运行
npm start

# 5. 访问 http://localhost:3000
# 以管理员身份登录，应该能看到 Dashboard
```

## 📊 功能展示

### Agent Performance Card
```
┌────────────────────────────────┐
│ 🔷 Gemini         +5.23% ✅    │
├────────────────────────────────┤
│ 总资产                          │
│ $10,523.45                     │
│ ↑ +$523.45                     │
├────────────────────────────────┤
│ 💵 现金: $8,234.12             │
│ 持仓:                          │
│   BTC    0.0234                │
│   ETH    1.5678                │
└────────────────────────────────┘
```

### Decision Timeline
```
🔷 Gemini - 买入 BTC × 0.05
理由：技术面突破关键阻力位，RSI显示超买但趋势强劲
市场: BTC $67,234 (+2.3%) | ETH $3,156 (-0.8%)
⏰ 2小时前
```

## 🎯 与 Alpha Arena 的对比

| 特性 | Alpha Arena | 我们的系统 |
|------|------------|-----------|
| **资金** | 真实$10K | 虚拟$10K ✅ |
| **风险** | 真金可能亏损 | 零风险 ✅ |
| **成本** | 参赛费用 | $0.5/月 ✅ |
| **LLM数量** | 6个固定 | 可扩展 ✅ |
| **访问权限** | 公开 | 管理员专属 ✅ |
| **数据隐私** | 公开比赛 | 完全私密 ✅ |

## 🔧 技术栈

### 前端
- React 18
- Tailwind CSS
- Recharts (图表)
- auth-clerk (认证)

### 后端
- AWS Lambda (Node.js 18)
- Supabase Edge Functions (Deno)
- Supabase PostgreSQL
- CloudWatch Events

### API
- Gemini API (Google)
- CoinGecko API (市场数据)

## 📝 环境变量清单

```bash
# 前端 (.env.production)
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_xxx
REACT_APP_ADMIN_EMAILS=admin@example.com
REACT_APP_TRADING_API_URL=https://xxx.supabase.co/functions/v1/trading-api

# Lambda (AWS Console配置)
GEMINI_API_KEY=xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Edge Function (Supabase Secrets)
ADMIN_EMAILS=admin@example.com
# SUPABASE_URL 和 SERVICE_ROLE_KEY 自动注入
```

## 🐛 故障排除

### 前端显示"访问受限"
- 检查是否以管理员账户登录
- 检查 `REACT_APP_ADMIN_EMAILS` 是否包含你的邮箱

### Edge Function 403 错误
- 检查 Supabase Secrets 中的 `ADMIN_EMAILS`
- 检查 Clerk Token 是否正确传递

### Lambda 无数据
- 检查 CloudWatch Events 是否触发
- 查看 Lambda Logs: `aws logs tail /aws/lambda/llm-trading-decision`

### Gemini API 失败
- 检查 API Key 是否有效
- 检查免费额度是否用完

## 📈 扩展功能 (TODO)

- [ ] 添加 GPT-4 和 Claude agent
- [ ] 邮件/Slack 通知
- [ ] 性能分析报告
- [ ] 支持更多交易资产
- [ ] 实现自定义交易策略
- [ ] 添加回测功能

## ⚠️ 免责声明

**本系统仅供学习和观察使用，使用虚拟资金进行模拟交易。**

- ❌ 不构成任何投资建议
- ❌ 不保证盈利
- ❌ 模拟结果与真实交易有差异
- ❌ 请勿使用真实资金

## 📄 License

MIT License - 自由使用、修改、分发

---

**Built with ❤️ - 观察AI如何交易，而不是让AI帮你交易**
