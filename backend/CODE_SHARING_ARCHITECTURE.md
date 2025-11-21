# 数字货币 vs 美股 - 代码共享架构

## 现有结构分析

### Lambda Layer（完全共享）
**位置：** `lambda-trading-shared/`
**内容：**
- `llm-clients.mjs` - 所有LLM的API调用函数
  - callOpenAI, callGemini, callClaude, callGrok
  - callDeepSeekBedrock, callQwen3Bedrock
- `decision-parser.mjs` - 决策解析和验证
  - parseAndValidateDecision()
  - 验证action, asset/stock, amount
- `portfolio-management.mjs` - Portfolio管理
  - getCurrentPortfolio()
  - simulateTrade()
  - calculateTotalValue()
  - deductDailyManagementFees()
  - savePortfolio()

**✅ 这些代码数字货币和美股完全共享，不需要改动！**

---

## Lambda各自独立的部分

### 数字货币Lambda：`lambda-cc-trading/index.mjs`
**完全独立的部分：**

1. **交易标的常量**
   ```javascript
   const AVAILABLE_ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];
   const ETF_BENCHMARKS = [
     { symbol: 'GDLC', managementFee: 0.025 },
     { symbol: 'BITW', managementFee: 0.025 }
   ];
   ```

2. **数据获取函数**（CoinGecko + CryptoCompare）
   - `fetchMarketData()` - CoinGecko API
   - `fetchGlobalMarketData()` - CoinGecko Global API
   - `fetchHistoricalOHLC()` - CoinGecko历史数据
   - `fetchCryptoNews()` - CryptoCompare News API

3. **Prompt构建**
   - `buildMultiAssetTradingPrompt()` - 加密货币交易prompt

4. **数据库表名**
   - `llm_trading_decisions`
   - `llm_trading_portfolios`

---

### 美股Lambda：`lambda-stock-trading/index.mjs`
**完全独立的部分（对应数字货币）：**

1. **交易标的常量**
   ```javascript
   const AVAILABLE_STOCKS = ['AAPL', 'MSFT', 'NVDA', ...]; // 16支
   const ETF_BENCHMARKS = [
     { symbol: 'QQQ', managementFee: 0.0020 },
     { symbol: 'VGT', managementFee: 0.0010 },
     { symbol: 'SPY', managementFee: 0.0009 }
   ];
   ```

2. **数据获取函数**（Yahoo + Alpha Vantage）
   - `fetchMarketData()` - Yahoo Finance API
   - `fetchHistoricalOHLC()` - Yahoo Finance历史数据
   - `fetchNewsData()` - Alpha Vantage News API

3. **Prompt构建**
   - `buildStockTradingPrompt()` - 美股交易prompt

4. **数据库表名**
   - `stock_trading_decisions`
   - `stock_trading_portfolios`

---

## 两个Lambda完全相同的部分（复制粘贴）

这些代码在两个Lambda中**完全一样**，直接从数字货币复制到美股：

1. **AGENT_CONFIGS**（10个LLM配置）
   ```javascript
   const AGENT_CONFIGS = {
       openai_standard: { llmClient: callOpenAI, llmOptions: {...} },
       openai_mini: { llmClient: callOpenAI, llmOptions: {...} },
       // ... 其他8个
   };
   ```

2. **API_KEYS映射**
   ```javascript
   const API_KEYS = {
       openai_standard: process.env.OPENAI_API_KEY,
       // ...
   };
   ```

3. **AGENTS列表**（只是名称不同：crypto用币名，stock用etf名）
   ```javascript
   const AGENTS = [
       { name: 'openai_standard', type: 'llm' },
       // ... 10个LLM
       { name: 'qqq', type: 'etf' },  // 名称不同
       // ...
   ];
   ```

4. **executeAgent()函数**（完全一样）
   ```javascript
   async function executeAgent(agentName, promptBuilder, apiKeys) {
       // 调用Layer的LLM client
       // 调用Layer的decision parser
       // 返回决策和usage
   }
   ```

5. **processSingleAgent()主框架**（90%相同）
   ```javascript
   async function processSingleAgent(agent, marketData, ...) {
       // 1. 获取当前portfolio
       // 2. LLM决策或ETF基准
       // 3. 执行交易
       // 4. 保存decision和portfolio
       // 5. 降级保护
   }
   ```

6. **handler()主入口框架**（90%相同）
   ```javascript
   export const handler = async (event) => {
       // 1. 初始化Supabase
       // 2. 获取市场数据
       // 3. 并发处理所有agents
       // 4. 汇总结果
   };
   ```

7. **技术指标计算**（完全一样）
   - `calculateRSI()`
   - `calculateMACD()`
   - `calculateMA()`
   - `calculateBollingerBands()`

8. **数据库操作包装函数**（只改表名）
   - `getCurrentPortfolio()` - 调用Layer函数，改表名
   - `saveDecision()` - 改表名
   - `savePortfolio()` - 调用Layer函数，改表名

---

## 代码共享总结

### Layer（完全共享）
- **文件数：** 3个
- **代码量：** ~1000行
- **数字货币和美股：** ✅ 100%共享

### Lambda独立部分（需要新写）
- **数据获取函数：** ~200行
  - Yahoo Finance API调用
  - Alpha Vantage API调用
- **Prompt构建：** ~100行
  - buildStockTradingPrompt()
- **常量定义：** ~50行
  - AVAILABLE_STOCKS, ETF_BENCHMARKS

**美股Lambda需要新写的代码：约350行**

### Lambda相同部分（复制粘贴）
- **AGENT_CONFIGS + API_KEYS：** ~150行
- **executeAgent()：** ~30行
- **processSingleAgent()：** ~100行
- **handler()：** ~50行
- **技术指标计算：** ~150行
- **数据库操作：** ~80行

**从数字货币Lambda复制过来：约560行**

---

## 美股Lambda总代码量估算

| 部分 | 代码量 | 来源 |
|------|--------|------|
| 从Layer导入 | ~20行 | 新写 |
| 常量定义 | ~50行 | 新写（改标的） |
| AGENT_CONFIGS | ~150行 | 复制crypto |
| 数据获取函数 | ~200行 | 新写（改API） |
| Prompt构建 | ~100行 | 新写（改prompt） |
| executeAgent | ~30行 | 复制crypto |
| processSingleAgent | ~100行 | 复制crypto（微调） |
| handler主入口 | ~50行 | 复制crypto（微调） |
| 技术指标计算 | ~150行 | 复制crypto |
| 数据库操作 | ~80行 | 复制crypto（改表名） |
| **总计** | **~930行** | **新写350 + 复制580** |

---

## 实施步骤

1. ✅ 创建 `lambda-stock-trading/` 目录
2. ✅ 复制 `lambda-cc-trading/index.mjs` 到 `lambda-stock-trading/index.mjs`
3. ✅ 全局替换：
   - `AVAILABLE_ASSETS` → `AVAILABLE_STOCKS`
   - `llm_trading_decisions` → `stock_trading_decisions`
   - `llm_trading_portfolios` → `stock_trading_portfolios`
   - `CoinGecko` → `Yahoo Finance`
   - `CryptoCompare` → `Alpha Vantage`
4. ✅ 修改数据获取函数（替换API调用）
5. ✅ 修改Prompt构建函数
6. ✅ 修改ETF列表和管理费
7. ✅ 测试部署

**预计工作量：1-2小时**
