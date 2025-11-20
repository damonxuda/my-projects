# Lambda Trading Shared Layer 扩展优化计划

## 目标
将 lambda-cc-trading 从 1816 行精简到约 600 行，通过扩展 Layer 模块提高代码复用率，为未来美股交易 Lambda 打下基础。

## 当前状态（Layer v5）

```
lambda-trading-shared/
├── llm-clients.mjs          (423行) - LLM API 客户端 ✅
├── decision-parser.mjs      (243行) - 决策解析和验证 ✅
├── technical-indicators.mjs (201行) - 技术指标计算 ✅
├── package.json
└── node_modules/
```

## 扩展计划（Layer v6）

### 新增模块 1: agent-executor.mjs (~300行)

**目的**：统一 10 个 LLM 的调用逻辑，消除重复代码

**功能**：
- 配置驱动的 Agent 执行器
- 统一的 Prompt 构建 → LLM 调用 → 决策解析流程
- Agent 配置集中管理（model, temperature, maxTokens 等）

**从 Lambda 提取的函数**：
```javascript
// 当前 Lambda 中的 8 个 askXXX 函数 (每个约 20-30 行)
async function askGeminiPro(...)        // 1340-1357 (18行)
async function askGeminiFlashProxy(...) // 1358-1375 (18行)
async function askDeepSeekBedrock(...)  // 1376-1389 (14行)
async function askQwen3Bedrock(...)     // 1390-1403 (14行)
async function askClaude(...)           // 1404-1425 (22行)
async function askGrok(...)             // 1426-1445 (20行)
async function askOpenAI(...)           // 1446-1467 (22行)
async function callLLMWithPrompt(...)   // 1247-1295 (49行)
async function askLLM(...)              // 1296-1339 (44行)
```

**新 API 设计**：
```javascript
// 集中配置（替换 8 个独立函数）
export const AGENT_CONFIGS = {
    openai_standard: {
        llmClient: callOpenAI,
        llmOptions: { model: 'gpt-4o', temperature: 0.7, maxTokens: 2000, maxRetries: 1 }
    },
    openai_mini: {
        llmClient: callOpenAI,
        llmOptions: { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 2000, maxRetries: 1 }
    },
    gemini_pro: {
        llmClient: callOpenAI, // gptsapi.net uses OpenAI format
        llmOptions: {
            baseURL: 'https://api.gptsapi.net/v1',
            model: 'gemini-2.5-pro',
            temperature: 0.7,
            maxTokens: 8000,
            maxRetries: 1
        }
    },
    gemini_flash: {
        llmClient: callOpenAI,
        llmOptions: {
            baseURL: 'https://api.gptsapi.net/v1',
            model: 'gemini-2.5-flash',
            temperature: 0.7,
            maxTokens: 8000,
            maxRetries: 1
        }
    },
    claude_standard: {
        llmClient: callClaude,
        llmOptions: {
            baseURL: 'https://api.gptsapi.net/v1',
            model: 'claude-sonnet-4-5-20250514',
            temperature: 0.7,
            maxTokens: 4000,
            maxRetries: 1
        }
    },
    claude_mini: {
        llmClient: callClaude,
        llmOptions: {
            baseURL: 'https://api.gptsapi.net/v1',
            model: 'claude-haiku-4-5-20251001',
            temperature: 0.7,
            maxTokens: 4000,
            maxRetries: 1
        }
    },
    grok_standard: {
        llmClient: callGrok,
        llmOptions: { model: 'grok-4-fast-reasoning', temperature: 0.7, maxTokens: 2000, maxRetries: 1 }
    },
    grok_mini: {
        llmClient: callGrok,
        llmOptions: { model: 'grok-4-fast-non-reasoning', temperature: 0.7, maxTokens: 2000, maxRetries: 1 }
    },
    deepseek: {
        llmClient: callDeepSeekBedrock,
        llmOptions: { model: 'deepseek.v3-v1:0', temperature: 0.7, maxTokens: 2000 }
    },
    qwen3_235b: {
        llmClient: callQwen3Bedrock,
        llmOptions: { model: 'qwen.qwen3-235b-a22b-2507-v1:0', temperature: 0.7, maxTokens: 2000 }
    }
};

// 统一执行函数
export async function executeAgent(agentName, promptBuilder, apiKeys) {
    const config = AGENT_CONFIGS[agentName];
    if (!config) throw new Error(`Unknown agent: ${agentName}`);

    // 构建 Prompt（由 Lambda 传入）
    const prompt = promptBuilder();

    // 调用 LLM（添加 API Key）
    const options = { ...config.llmOptions, apiKey: apiKeys[agentName] };
    const result = await config.llmClient(prompt, options);

    // 解析决策
    const decision = parseAndValidateDecision(result.text, agentName);

    return { decision, usage: result.usage };
}
```

**收益**：
- Lambda 减少 221 行（8个函数 + callLLMWithPrompt + askLLM）
- 新增配置 10 行/agent × 10 = 100 行
- 净减少：121 行

---

### 新增模块 2: portfolio-management.mjs (~600行)

**目的**：提取投资组合管理逻辑，为加密货币和美股交易共享

**功能**：
- 投资组合查询和计算
- 交易模拟（买入/卖出/持有）
- 费用计算（管理费、股息再投资）
- 投资组合保存到数据库

**从 Lambda 提取的函数**：
```javascript
async function getCurrentPortfolio(...)      // 564-599 (36行)
async function deductDailyManagementFees(...) // 600-690 (91行)
async function checkAndReinvestDividends(...) // 691-776 (86行)
async function simulateTrade(...)            // 1468-1632 (165行)
async function calculateTotalValue(...)      // 1633-1674 (42行)
async function savePortfolio(...)            // 1794-1816 (23行)
```

**新 API 设计**：
```javascript
// 投资组合操作
export async function getPortfolio(agentName, dbClient) { ... }
export async function executeTradeSimulation(portfolio, decision, marketData) { ... }
export async function updatePortfolioValue(portfolio, marketData) { ... }

// 费用和股息管理
export async function applyDailyFees(portfolio) { ... }
export async function reinvestDividends(portfolio, ticker) { ... }

// 数据库操作
export async function savePortfolioToDb(portfolio, dbClient) { ... }
```

**收益**：
- Lambda 减少 443 行
- Layer 增加约 600 行（含注释和通用化代码）

---

## 优化后的 Lambda 结构（~600行）

```javascript
// lambda-cc-trading/index.mjs
import { executeAgent, AGENT_CONFIGS } from '/opt/nodejs/agent-executor.mjs';
import {
    getPortfolio,
    executeTradeSimulation,
    savePortfolioToDb
} from '/opt/nodejs/portfolio-management.mjs';
import { callOpenAI, callClaude, ... } from '/opt/nodejs/llm-clients.mjs';

// 环境变量和配置（~100行）
const API_KEYS = {
    openai_standard: process.env.OPENAI_API_KEY,
    openai_mini: process.env.OPENAI_API_KEY,
    gemini_pro: process.env.GEMINI_PRO_API_KEY,
    gemini_flash: process.env.GEMINI_FLASH_API_KEY,
    claude_standard: process.env.CLAUDE_SONNET_API_KEY,
    claude_mini: process.env.CLAUDE_HAIKU_API_KEY,
    grok_standard: process.env.GROK_API_KEY,
    grok_mini: process.env.GROK_API_KEY,
    deepseek: null,  // AWS Bedrock 不需要 API Key
    qwen3_235b: null
};

// Handler（~50行，更简洁）
export const handler = async (event) => {
    // 1. 获取共享数据（市场、历史、技术指标、新闻）
    const sharedData = await fetchAllMarketData();

    // 2. 并行执行所有 Agents
    const results = await Promise.all(
        AGENTS.map(agent => processSingleAgent(agent, sharedData))
    );

    return { statusCode: 200, body: JSON.stringify({ results }) };
};

// 单个 Agent 处理（~40行，简化后）
async function processSingleAgent(agent, sharedData) {
    if (agent.type === 'benchmark') {
        return await processBenchmarkAgent(agent, sharedData);
    }

    // 1. 获取投资组合
    const portfolio = await getPortfolio(agent.name, supabase);

    // 2. 构建 Prompt（仍在 Lambda，因为是业务逻辑）
    const promptBuilder = () => buildTradingPrompt(sharedData, portfolio);

    // 3. 执行 Agent（调用 Layer）
    const { decision, usage } = await executeAgent(
        agent.name,
        promptBuilder,
        API_KEYS
    );

    // 4. 模拟交易（调用 Layer）
    const newPortfolio = await executeTradeSimulation(
        portfolio,
        decision,
        sharedData.marketData
    );

    // 5. 保存结果（调用 Layer）
    await savePortfolioToDb(newPortfolio, supabase);
    await saveDecision(agent.name, decision, sharedData, supabase);

    return { agent: agent.name, success: true, decision, portfolio: newPortfolio };
}

// 市场数据获取（~300行，保留在 Lambda）
async function fetchAllMarketData() { ... }
async function fetchMarketData() { ... }
async function fetchGlobalMarketData() { ... }
async function fetchHistoricalOHLC() { ... }
async function fetchCryptoNews() { ... }

// Prompt 构建（~200行，保留在 Lambda，因为是业务逻辑）
function buildTradingPrompt(...) { ... }
function buildMultiAssetTradingPrompt(...) { ... }

// 基准策略（~100行，保留在 Lambda）
async function getBenchmarkDecision(...) { ... }

// 数据库保存（~50行，保留在 Lambda）
async function saveDecision(...) { ... }
```

---

## 实施步骤

### Phase 1: 创建 agent-executor.mjs（2小时）
1. 创建 AGENT_CONFIGS 配置对象
2. 实现 executeAgent 函数
3. 测试所有 10 个 LLM 配置

### Phase 2: 创建 portfolio-management.mjs（3小时）
1. 提取投资组合管理函数
2. 参数化数据库客户端（支持不同 DB）
3. 添加完整的类型注释和文档

### Phase 3: 重构 Lambda（2小时）
1. 删除已迁移到 Layer 的函数
2. 修改 processSingleAgent 使用新模块
3. 简化 API Key 管理

### Phase 4: 测试和部署（1小时）
1. 本地语法检查
2. 部署 Layer v6
3. 手动测试所有 10 个 LLM
4. 验证执行时间和结果一致性

---

## 预期收益

| 指标 | 当前 (v5) | 优化后 (v6) | 改善 |
|------|-----------|------------|------|
| Lambda 代码行数 | 1816 | ~600 | ↓ 67% |
| Layer 模块数 | 3 | 5 | +2 |
| Layer 总行数 | 867 | ~1800 | +933 |
| 代码复用率 | 30% | 75% | +45% |
| LLM 调用函数 | 8个独立函数 | 1个配置对象 | ↓ 88% |
| 开发美股 Lambda | ~1800行 | ~400行 | ↓ 78% |

---

## 风险和注意事项

1. **向后兼容性**：Layer v6 与 v5 不兼容，需要同时更新 Lambda
2. **测试覆盖**：必须测试所有 10 个 LLM 确保无回归
3. **性能影响**：预计无性能影响（只是代码重组）
4. **回滚计划**：如有问题可快速切回 Layer v5

---

## 未来扩展（Phase 2 - 美股交易）

创建 `lambda-stock-trading` 时，可以复用 90% 的 Layer 模块：

```javascript
// lambda-stock-trading/index.mjs (~400行)
import { executeAgent } from '/opt/nodejs/agent-executor.mjs';
import { getPortfolio, executeTradeSimulation, ... } from '/opt/nodejs/portfolio-management.mjs';

const STOCK_ASSETS = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'];

// 几乎相同的逻辑，只改资产类型和数据源
export const handler = async (event) => {
    const sharedData = await fetchStockMarketData(STOCK_ASSETS);
    // ... 其他逻辑完全相同
};
```

---

## 总结

此次优化将：
- ✅ 将 Lambda 代码从 1816 行减少到 600 行（↓ 67%）
- ✅ 消除 10 个 LLM 调用函数的重复代码
- ✅ 提取可复用的投资组合管理逻辑
- ✅ 为未来美股交易打下基础（复用 90% 代码）
- ✅ 提高代码可维护性和可测试性
