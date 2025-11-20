# Lambda CC Trading 重构计划

## 背景

- **老 Lambda**: `backend/lambda-trading/index.mjs` (2393 行)
- **新 Lambda**: `backend/lambda-cc-trading/index.mjs` (待创建，目标 < 800 行)
- **Layer**: `lambda-trading-shared:2` (已部署，包含共享代码 + 依赖)

## 历史发现

1. **2025-11-19**: 创建了 `lambda-trading-shared` Layer (commit ea811fb5)
   - 包含：llm-clients.mjs, technical-indicators.mjs, decision-parser.mjs, utils.mjs
   - 目的：为 crypto 和 stock 两个系统提供共享代码

2. **问题**: 老的 `lambda-trading` **从未被改造**去使用这个 Layer
   - 老代码依然是完整的 2393 行
   - Layer 中的共享代码和老代码中的逻辑**有大量重复**

3. **预期**: 60-70% 的代码可以被 Layer 替代
   - Layer 模块: ~1150 行
   - 新 Lambda 业务逻辑: < 800 行
   - **总计**: ~1950 行 (vs 老的 2393 行 + Layer 重复)

## Layer 包含的模块

### 1. `llm-clients.mjs` (424 行)
**功能**: 纯 API 调用，支持所有 LLM 厂商
- `callOpenAI(prompt, options)`
- `callGemini(prompt, options)`
- `callClaude(prompt, options)`
- `callGrok(prompt, options)`
- `callDeepSeekBedrock(prompt, options)`
- `callQwen3Bedrock(prompt, options)`
- 内部包含: `fetchWithTimeoutAndRetry`

**特点**:
- 支持 `baseURL` 参数（灵活切换厂商/代理商）
- 返回格式: `{ text: string, usage: object }`
- 只负责 API 调用，**不包含**:
  - Prompt 构建
  - 决策解析
  - 错误处理的 fallback 逻辑

### 2. `technical-indicators.mjs` (214 行)
**功能**: 计算技术指标
- `calculateAllIndicators(ohlcData)` - 一次性计算所有指标
- `calculateRSI(prices, period)`
- `calculateMACD(prices, fastPeriod, slowPeriod, signalPeriod)`
- `calculateSMA(prices, period)`
- `calculateBollingerBands(prices, period, stdDev)`

### 3. `decision-parser.mjs` (253 行)
**功能**: 解析和验证 LLM 返回的交易决策
- `parseAndValidateDecision(text, options)` - 主函数
- `isHoldDecision(decision)`
- `hasBuyAction(decision)`
- `hasSellAction(decision)`
- `formatDecision(decision)`
- `extractActions(decision)`

**签名差异**:
- Layer: `parseAndValidateDecision(text, { modelName, availableAssets, ... })`
- 老代码: `parseAndValidateDecision(text, modelName)`

### 4. `utils.mjs` (283 行)
**功能**: 通用工具函数
- `fetchWithTimeout(url, options, timeoutMs)`
- `formatCurrency(amount, currency, decimals)`
- `formatNumber(num, decimals)`
- `formatPercentage(value, decimals)`
- `sleep(ms)`
- `deepClone(obj)`
- 等等...

## 老代码结构分析

### 文件结构 (2393 行)
```
行 1-64:     导入 + 环境变量配置 + AGENTS 列表
行 65-137:   handler 函数 + processSingleAgent 函数
行 138-258:  fetchMarketData (数字货币特定)
行 259-367:  fetchGlobalMarketData (数字货币特定)
行 368-428:  fetchHistoricalOHLC (数字货币特定)
行 429-543:  fetchCryptoNews (数字货币特定)
行 544-629:  calculateTechnicalIndicators (❌ 与 Layer 重复)
行 630-667:  getCurrentPortfolio (业务逻辑)
行 668-758:  deductDailyManagementFees (业务逻辑)
行 759-844:  checkAndReinvestDividends (业务逻辑)
行 845-942:  getBenchmarkDecision (业务逻辑)
行 943-986:  fetchWithTimeoutAndRetry (❌ 与 Layer 重复)
行 987-1152: buildTradingPrompt (业务逻辑 - 但已废弃)
行 1153-1219: buildMultiAssetTradingPrompt (业务逻辑 - 主要使用)
行 1220-1261: parseAndValidateDecision (❌ 与 Layer 重复)
行 1262-1302: askLLM 路由函数 (需要改写)
行 1303-1892: 所有 askXXX 函数 (❌ 与 Layer 重复 - 590 行!)
  - askGemini, askGeminiPro, askGeminiFlashProxy
  - askDeepSeekBedrock, askQwen3Bedrock
  - askClaude, askGrok, askOpenAI
行 1893-2044: simulateTrade (业务逻辑)
行 2045-2209: calculateTotalValue (业务逻辑)
行 2210-2370: saveDecision (业务逻辑)
行 2371-2393: savePortfolio (业务逻辑)
```

### 代码分类

#### ✅ 保留（数字货币特定业务逻辑）- 约 1200 行
- handler + processSingleAgent
- fetchMarketData, fetchGlobalMarketData, fetchHistoricalOHLC, fetchCryptoNews
- getCurrentPortfolio, deductDailyManagementFees, checkAndReinvestDividends
- getBenchmarkDecision
- buildMultiAssetTradingPrompt (prompt 构建)
- simulateTrade, calculateTotalValue
- saveDecision, savePortfolio

#### ❌ 删除（Layer 已包含）- 约 900 行
- calculateTechnicalIndicators (84 行) → Layer 的 `calculateAllIndicators`
- fetchWithTimeoutAndRetry (44 行) → Layer 内部已有
- parseAndValidateDecision (42 行) → Layer 的同名函数
- 所有 askXXX 函数 (590 行) → 改用 Layer 的 `callXXX` + 业务包装

#### 🔄 改写（使用 Layer）- 约 200 行
- askLLM 路由函数 + 包装函数
- 导入部分

## 重构步骤

### Step 1: 准备工作
```bash
# 1. 确保 Layer 已部署
aws lambda get-layer-version \
  --layer-name lambda-trading-shared \
  --version-number 2

# 2. 复制老文件作为基础
cp backend/lambda-trading/index.mjs backend/lambda-cc-trading/index.mjs
```

### Step 2: 修改导入部分 (行 1-15)

**OLD:**
```javascript
import { createClient } from '@supabase/supabase-js';
import YahooFinanceClass from 'yahoo-finance2';
import { RSI, MACD, SMA, BollingerBands } from 'technicalindicators';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
```

**NEW:**
```javascript
// 从 Lambda Layer 导入共享模块
import { callOpenAI, callGemini, callClaude, callGrok, callDeepSeekBedrock, callQwen3Bedrock } from '/opt/nodejs/llm-clients.mjs';
import { parseAndValidateDecision } from '/opt/nodejs/decision-parser.mjs';
import { calculateAllIndicators } from '/opt/nodejs/technical-indicators.mjs';

// 从 Lambda Layer 导入依赖包
import { createClient } from '@supabase/supabase-js';
import YahooFinanceClass from 'yahoo-finance2';
```

### Step 3: 删除重复函数

#### 3.1 删除 `calculateTechnicalIndicators` (行 544-629)
**替换为**:
```javascript
// 技术指标计算（使用 Layer）
function calculateTechnicalIndicators(ohlcData) {
    return calculateAllIndicators(ohlcData);
}
```

#### 3.2 删除 `fetchWithTimeoutAndRetry` (行 943-986)
**替换为**:
```javascript
// fetchWithTimeoutAndRetry 已移到 Layer (llm-clients.mjs 内部使用)
```

#### 3.3 删除 `parseAndValidateDecision` (行 1220-1261)
**替换为**:
```javascript
// 决策解析（使用 Layer）
function parseAndValidateDecision(text, modelName) {
    // Layer 的签名: parseAndValidateDecision(text, { modelName, ... })
    return parseAndValidateDecision(text, { modelName });
}
```

### Step 4: 重写所有 askXXX 函数 (行 1303-1892)

#### 4.1 创建通用包装函数
```javascript
// 通用 LLM 调用包装（prompt 构建 + Layer API 调用 + 决策解析 + 错误处理）
async function callLLMWithPrompt(llmFunction, llmOptions, marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, modelName) {
    try {
        // 1. 构建 prompt (业务逻辑，保留)
        const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

        // 2. 调用 Layer 的 LLM 函数
        const result = await llmFunction(prompt, llmOptions);

        // 3. 记录 token 使用量
        if (result.usage) {
            console.log(`📊 ${modelName} Token Usage:`, result.usage);
        }

        // 4. 解析决策 (使用 Layer)
        return parseAndValidateDecision(result.text, modelName);

    } catch (error) {
        console.error(`[${modelName}] API call failed:`, error);
        // 错误 fallback (业务逻辑，保留)
        return {
            action: 'hold',
            asset: null,
            amount: 0,
            reason: `API调用失败（${error.message}），保持持有`
        };
    }
}
```

#### 4.2 改写每个 askXXX 函数
```javascript
// OpenAI
async function askOpenAI(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, model = 'gpt-4o-mini') {
    const isFlagship = (model === 'gpt-4.1');
    const modelDisplayName = isFlagship ? 'GPT-4.1' : 'GPT-4o mini';

    return await callLLMWithPrompt(
        callOpenAI,  // Layer 函数
        {
            apiKey: OPENAI_API_KEY,
            model: model,
            temperature: 0.7,
            maxTokens: 2000,
            timeout: isFlagship ? 120000 : 60000,
            maxRetries: isFlagship ? 2 : 1
        },
        marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData,
        modelDisplayName
    );
}

// 类似地改写: askGeminiPro, askGeminiFlashProxy, askClaude, askGrok, askDeepSeekBedrock, askQwen3Bedrock
```

### Step 5: 保持 askLLM 路由函数不变 (行 1262-1302)
```javascript
// 这个函数无需修改，因为它只是路由到各个 askXXX 函数
async function askLLM(agentName, marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    switch (agentName) {
        case 'openai_standard':
            return await askOpenAI(..., 'gpt-4.1');
        case 'openai_mini':
            return await askOpenAI(..., 'gpt-4o-mini');
        // ... 其他 cases
    }
}
```

### Step 6: 保留所有业务逻辑函数不变
- handler
- processSingleAgent
- fetchMarketData, fetchGlobalMarketData, fetchHistoricalOHLC, fetchCryptoNews
- getCurrentPortfolio, deductDailyManagementFees, checkAndReinvestDividends
- getBenchmarkDecision
- buildMultiAssetTradingPrompt
- simulateTrade, calculateTotalValue
- saveDecision, savePortfolio

## 预期结果

### 代码行数
- **老代码**: 2393 行
- **新代码**:
  - 导入: ~20 行
  - 业务逻辑保留: ~1200 行
  - 包装函数: ~200 行
  - **总计**: ~1420 行
- **精简**: 973 行 (40.7%)

### 文件结构
```
backend/lambda-cc-trading/
├── index.mjs          (~1420 行 - 使用 Layer)
├── package.json       (空依赖，所有依赖在 Layer)
└── README.md
```

## 关键注意事项

### 1. Layer 函数签名差异
| 函数 | Layer 签名 | 老代码签名 | 处理方式 |
|------|-----------|-----------|---------|
| `parseAndValidateDecision` | `(text, options)` | `(text, modelName)` | 创建包装函数 |
| `calculateAllIndicators` | `(ohlcData)` | `calculateTechnicalIndicators(ohlcData)` | 重命名包装 |

### 2. LLM 调用流程
**OLD (老代码)**:
```
askOpenAI() →
  构建 prompt →
  fetchWithTimeoutAndRetry(API) →
  解析响应 →
  parseAndValidateDecision() →
  错误 fallback
```

**NEW (使用 Layer)**:
```
askOpenAI() →
  构建 prompt (业务) →
  callOpenAI(prompt, options) [Layer] →
  parseAndValidateDecision(text, options) [Layer] →
  错误 fallback (业务)
```

### 3. 环境变量
保持不变，所有 API keys 和配置继续使用环境变量：
- `OPENAI_API_KEY`, `GEMINI_PRO_API_KEY`, `GEMINI_FLASH_API_KEY`
- `CLAUDE_SONNET_API_KEY`, `CLAUDE_HAIKU_API_KEY`
- `GROK_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `CRYPTOCOMPARE_API_KEY`, `COINGECKO_API_KEY`

### 4. 部署配置
- Lambda 需要关联 Layer: `lambda-trading-shared:2`
- `package.json` 的 dependencies 应该为空（所有依赖在 Layer）
- 部署时只上传 `index.mjs`，不包含 `node_modules`

## 测试计划

### 1. 本地语法检查
```bash
cd backend/lambda-cc-trading
node --check index.mjs
```

### 2. 手动部署测试
```bash
# 打包
zip -r function.zip index.mjs

# 部署
aws lambda update-function-code \
  --function-name CC_TRADING_LAMBDA \
  --zip-file fileb://function.zip

# 关联 Layer
aws lambda update-function-configuration \
  --function-name CC_TRADING_LAMBDA \
  --layers "arn:aws:lambda:ap-northeast-1:730335478220:layer:lambda-trading-shared:2"

# 测试
aws lambda invoke \
  --function-name CC_TRADING_LAMBDA \
  --payload '{}' \
  /tmp/response.json
```

### 3. 对比测试
- 运行 CC_TRADING_LAMBDA 和 TRADING_LAMBDA
- 对比输出结果是否一致
- 检查数据库中的决策记录

### 4. 前端切换
只需修改前端的 Lambda URL：
```javascript
// OLD
const apiUrl = 'https://xxx.lambda-url.ap-northeast-1.on.aws/';

// NEW
const apiUrl = 'https://yyy.lambda-url.ap-northeast-1.on.aws/';
```

## 常见问题

### Q1: 为什么不直接修改老的 lambda-trading？
**A**: 稳妥起见，创建新的 lambda-cc-trading 作为测试。如果有问题，可以快速切回老版本。测试通过后再删除老的。

### Q2: Layer 的代码和老代码有差异怎么办？
**A**: Layer 的代码是从老代码提取出来的，应该完全兼容。如果有差异，优先使用 Layer 的版本（更新、更优化）。

### Q3: 如果 Layer 部署失败怎么办？
**A**: Layer 已经成功部署（version 2）并通过测试。如果需要更新 Layer，修改 `lambda-trading-shared/` 后推送，GitHub Actions 会自动部署。

### Q4: baseURL 参数如何使用？
**A**:
```javascript
// 使用厂商官方 API（默认）
callGemini(prompt, { apiKey: KEY });

// 使用代理商 API
callGemini(prompt, {
    apiKey: PROXY_KEY,
    baseURL: 'https://proxy.com/api'
});
```

## 下一步（完成后）

1. ✅ 测试 lambda-cc-trading 功能正常
2. ✅ 前端切换到新 Lambda URL
3. ✅ 观察一周，确保稳定
4. ❌ 删除老的 lambda-trading
5. ❌ 删除老的 trading-dependencies Layer (version 89)
6. ❌ 开发 lambda-stock-trading（使用相同 Layer）

---

**创建时间**: 2025-11-20
**Layer 版本**: lambda-trading-shared:2
**目标**: 从 2393 行精简到 ~1420 行 (40.7% reduction)
