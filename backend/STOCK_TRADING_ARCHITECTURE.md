# 美股交易系统架构设计

## 1. 系统概览

### 交易标的
**16支股票（科技股）：**
1. AAPL - Apple
2. MSFT - Microsoft
3. NVDA - Nvidia
4. AMZN - Amazon
5. META - Meta
6. GOOGL - Google/Alphabet
7. TSLA - Tesla
8. AVGO - Broadcom
9. COST - Costco
10. NFLX - Netflix
11. CRM - Salesforce
12. ORCL - Oracle
13. CSCO - Cisco
14. ACN - Accenture
15. AMD - AMD
16. ADBE - Adobe

**3个ETF基准：**
1. QQQ - Invesco QQQ Trust (纳斯达克100，管理费0.20%/年)
2. VGT - Vanguard IT ETF (纯科技，管理费0.10%/年)
3. SPY - SPDR S&P 500 ETF (大盘基准，管理费0.09%/年)

**10个LLM Agents：**
- openai_standard (GPT-4.1)
- openai_mini (GPT-4o-mini)
- gemini_pro (Gemini 2.5 Pro)
- gemini_flash (Gemini 2.5 Flash)
- claude_standard (Claude Sonnet 4.5)
- claude_mini (Claude Haiku 4.5)
- grok_standard (Grok 4 Fast Reasoning)
- grok_mini (Grok 4 Fast)
- deepseek (DeepSeek v3)
- qwen3_235b (Qwen3 235B)

### 交易规则
- 起始资金：$50,000/账号
- 无杠杆现货交易
- 手续费：$0（模拟零佣金券商）
- ETF管理费：按小时折算
- 最低持仓现金：20%
- 单笔交易不超过总资产30%
- 单笔交易最低$10

### 交易时间（美东时间）
- 常规交易：9:30 AM - 4:00 PM ET
- 触发频率：每小时一次
- EventBridge: 每天7次（9:30, 10:30, 11:30, 12:30, 13:30, 14:30, 15:30）
- Cron表达式：`cron(30 13-19 ? * MON-FRI *)` (UTC，考虑冬令时)

## 2. 数据源

### Yahoo Finance（免费，无需API key）
**用途：**
- 实时股价
- 历史OHLC数据
- 技术指标计算基础数据
- ETF价格

**API调用：**
```javascript
const quote = await yahooFinance.quote('AAPL');
const history = await yahooFinance.historical('AAPL', {
  period1: '2024-01-01',
  interval: '1d'
});
```

### Alpha Vantage（免费500次/天）
**用途：**
- 美股新闻
- 情绪分析
- 公司事件

**API格式：**
```
https://www.alphavantage.co/query?
  function=NEWS_SENTIMENT&
  tickers=AAPL,MSFT&
  limit=50&
  apikey=YOUR_KEY
```

## 3. 数据库设计

### 表1: stock_trading_decisions
```sql
CREATE TABLE stock_trading_decisions (
  id BIGSERIAL PRIMARY KEY,
  agent_name TEXT NOT NULL,           -- LLM agent名称
  action TEXT NOT NULL,                -- buy/sell/hold
  stock TEXT,                          -- 股票代码（如AAPL）
  amount NUMERIC,                      -- 交易数量（股数）
  reason TEXT,                         -- 决策理由
  overall_reason TEXT,                 -- 整体策略（多笔交易）
  is_multi_trade BOOLEAN DEFAULT false, -- 是否多笔交易
  trades_count INTEGER,                -- 交易笔数
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  INDEX idx_stock_decisions_agent (agent_name),
  INDEX idx_stock_decisions_created (created_at DESC)
);
```

### 表2: stock_trading_portfolios
```sql
CREATE TABLE stock_trading_portfolios (
  id BIGSERIAL PRIMARY KEY,
  agent_name TEXT NOT NULL,           -- Agent名称
  cash NUMERIC NOT NULL,              -- 现金余额
  holdings JSONB NOT NULL,            -- 持仓 {"AAPL": 10, "MSFT": 5}
  total_value NUMERIC NOT NULL,       -- 总资产
  pnl NUMERIC NOT NULL,               -- 盈亏
  pnl_percentage NUMERIC NOT NULL,    -- 盈亏百分比
  timestamp TIMESTAMPTZ NOT NULL,     -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  INDEX idx_stock_portfolios_agent (agent_name),
  INDEX idx_stock_portfolios_created (created_at DESC)
);
```

## 4. Lambda架构

### Lambda函数：TRADING_STOCK_LAMBDA
**运行时：** Node.js 20.x
**内存：** 512 MB
**超时：** 600秒（10分钟）
**Layer：** lambda-trading-shared:11（复用）

### 环境变量
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ALPHA_VANTAGE_API_KEY          # 新增
OPENAI_API_KEY
GEMINI_PRO_API_KEY
GEMINI_FLASH_API_KEY
CLAUDE_SONNET_API_KEY
CLAUDE_HAIKU_API_KEY
GROK_API_KEY
```

### 代码结构
```
lambda-stock-trading/
├── index.mjs                  # 主入口
├── package.json
└── README.md

复用 lambda-trading-shared/ (Layer)
├── llm-clients.mjs           # LLM API调用
├── decision-parser.mjs       # 决策解析
└── portfolio-management.mjs  # 持仓管理
```

## 5. EventBridge配置

### 规则：stock-trading-hourly-trigger
**调度表达式：** `cron(30 13-19 ? * MON-FRI *)`
**说明：**
- UTC 13:30-19:30 = 美东 9:30-15:30（冬令时）
- 周一到周五
- 每小时30分触发

**触发次数：** 7次/天
- 9:30, 10:30, 11:30, 12:30, 13:30, 14:30, 15:30 ET

## 6. 前端架构

### 路由结构
```
/quant-simulation              # 量化模拟（原量化大赛）
├── /stocks                    # 美股交易（新）
│   ├── LLM排行榜
│   ├── 个股决策详情
│   └── 历史回测图表
└── /crypto                    # 数字货币（原有）
    ├── LLM排行榜
    ├── 个股决策详情
    └── 历史回测图表
```

### 数据展示
- 实时排行榜（10个LLM + 3个ETF）
- PnL曲线图
- 持仓分布饼图
- 决策历史列表
- 个股表现对比

## 7. 技术栈

**后端：**
- AWS Lambda (Node.js 20)
- AWS Lambda Layer（共享代码）
- AWS EventBridge（定时触发）
- Supabase PostgreSQL（数据存储）

**数据源：**
- Yahoo Finance（股价/OHLC）
- Alpha Vantage（新闻/情绪）

**前端：**
- Next.js
- React
- Chart.js / Recharts（图表）
- TailwindCSS（样式）

## 8. 部署流程

1. ✅ 创建Supabase数据库表
2. ✅ 创建Lambda代码
3. ✅ 部署Lambda（使用Layer v11）
4. ✅ 配置EventBridge定时规则
5. ✅ 添加Alpha Vantage API key到环境变量
6. ✅ 前端路由和页面改造
7. ✅ 测试和验证

## 9. 成本估算

**AWS Lambda：**
- 执行次数：7次/天 × 30天 = 210次/月
- 执行时长：约60秒/次
- 费用：几乎免费（在免费额度内）

**数据源：**
- Yahoo Finance：免费
- Alpha Vantage：免费（500次/天）

**Supabase：**
- 免费套餐足够

**总成本：接近$0/月**

## 10. 风险和限制

1. **数据延迟：** Yahoo Finance可能有15分钟延迟（免费版）
2. **API限制：** Alpha Vantage 500次/天（每小时触发7次 = 168次/天，够用）
3. **交易时间：** 只在常规交易时间，不做盘前盘后
4. **假期处理：** 美股假期需要手动关闭或智能检测
5. **夏令时：** EventBridge cron需要根据夏令时调整

## 11. 未来扩展

- [ ] 添加技术指标（RSI, MACD, 布林带）
- [ ] 支持期权交易
- [ ] 添加风险管理模块
- [ ] 多策略组合
- [ ] 机器学习预测
- [ ] 回测引擎
