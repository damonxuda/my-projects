# Lambda Trading Shared Modules

共享代码模块，供 **crypto trading** 和 **stock trading** 两个系统复用。

---

## 📦 包含模块

### 1. LLM Clients (`llm-clients.mjs`)
封装所有 LLM API 调用，支持：
- ✅ OpenAI (GPT-4o, GPT-4o mini)
- ✅ Gemini (2.0 Flash, 2.5 Pro)
- ✅ Claude (Sonnet 4.5, Haiku 4.5)
- ✅ Grok (Grok 2, Grok 2 mini)
- ✅ DeepSeek (Bedrock V3)
- ✅ Qwen3 (Bedrock 235B)

**使用示例**：
```javascript
import { callOpenAI, callGemini } from './llm-clients.mjs';

// 调用 OpenAI
const result = await callOpenAI('What is 2+2?', {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1000,
  timeout: 60000,
  maxRetries: 2
});

console.log(result.text);  // LLM 响应文本
console.log(result.usage); // Token 使用统计
```

### 2. Technical Indicators (`technical-indicators.mjs`)
计算常用技术指标：
- ✅ RSI (相对强弱指数)
- ✅ MACD (平滑异同移动平均线)
- ✅ SMA (简单移动平均线)
- ✅ Bollinger Bands (布林带)

**使用示例**：
```javascript
import { calculateAllIndicators } from './technical-indicators.mjs';

const ohlcData = [
  { open: 100, high: 105, low: 98, close: 102 },
  { open: 102, high: 108, low: 101, close: 106 },
  // ... 至少需要 14 个数据点
];

const indicators = calculateAllIndicators(ohlcData);
console.log(indicators.rsi);        // 当前 RSI 值
console.log(indicators.macd);       // MACD 指标
console.log(indicators.ma7);        // 7日移动平均
console.log(indicators.bollinger);  // 布林带上中下轨
```

### 3. Decision Parser (`decision-parser.mjs`)
解析和验证 LLM 返回的交易决策：

**使用示例**：
```javascript
import { parseAndValidateDecision, formatDecision } from './decision-parser.mjs';

const llmResponse = `
{
  "action": "buy",
  "asset": "AAPL",
  "amount": 10,
  "reason": "Strong earnings report"
}
`;

const decision = parseAndValidateDecision(llmResponse, {
  modelName: 'GPT-4o',
  availableAssets: ['AAPL', 'MSFT', 'GOOGL'],
  allowHold: true,
  requireAmount: true
});

console.log(formatDecision(decision));  // "BUY 10 AAPL - Strong earnings report"
```

### 4. Utilities (`utils.mjs`)
通用工具函数：
- ✅ `fetchWithTimeout` / `fetchWithRetry` - HTTP 请求工具
- ✅ `formatNumber` / `formatCurrency` / `formatPercentage` - 数字格式化
- ✅ `sleep` / `measureTime` - 异步工具
- ✅ `deepClone` / `safeGet` - 对象操作
- ✅ `throttle` / `debounce` - 函数节流防抖

**使用示例**：
```javascript
import { formatCurrency, sleep, measureTime } from './utils.mjs';

console.log(formatCurrency(1234.56));  // "$1,234.56"

await sleep(1000);  // 等待 1 秒

const result = await measureTime(async () => {
  // 执行某些操作
}, 'MyFunction');  // 输出: ⏱️ MyFunction took 523ms
```

---

## 🚀 使用方式

### 方式 1: Lambda Layer（推荐）

1. **打包 Layer**：
```bash
cd lambda-trading-shared
npm install
mkdir -p layer/nodejs
cp -r *.mjs node_modules package.json layer/nodejs/
cd layer
zip -r lambda-trading-shared-layer.zip nodejs/
```

2. **上传到 AWS Lambda**：
```bash
aws lambda publish-layer-version \
  --layer-name lambda-trading-shared \
  --zip-file fileb://lambda-trading-shared-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region ap-northeast-1
```

3. **在 Lambda 中使用**：
```javascript
// Layer 会被挂载到 /opt/nodejs/
import { callOpenAI } from '/opt/nodejs/llm-clients.mjs';
import { calculateAllIndicators } from '/opt/nodejs/technical-indicators.mjs';
```

### 方式 2: NPM Package（本地开发）

```bash
cd lambda-trading
npm install ../lambda-trading-shared
```

```javascript
import { callOpenAI } from 'lambda-trading-shared/llm-clients';
```

### 方式 3: 直接复制（最简单）

直接将 `*.mjs` 文件复制到目标项目：
```javascript
import { callOpenAI } from './shared/llm-clients.mjs';
```

---

## 📊 代码统计

| 模块 | 行数 | 功能 |
|------|------|------|
| `llm-clients.mjs` | ~400 | 6个LLM API封装 |
| `technical-indicators.mjs` | ~200 | 4种技术指标 + 扩展接口 |
| `decision-parser.mjs` | ~250 | 决策解析验证 + 工具函数 |
| `utils.mjs` | ~300 | 20+ 通用工具函数 |
| **总计** | **~1150 行** | 可复用代码 |

---

## 🔄 版本更新

### v1.0.0 (2025-11-18)
- ✅ 初始版本
- ✅ 提取自 `lambda-trading` (2393 行)
- ✅ 支持 6 个 LLM 提供商
- ✅ 支持 4 种技术指标
- ✅ 完整的决策解析和验证

---

## 📝 注意事项

1. **Lambda Layer 限制**：
   - 最大 50MB（压缩后）
   - 最大 250MB（解压后）
   - 当前模块 + dependencies 约 10MB，远低于限制

2. **ES Modules**：
   - 所有文件使用 `.mjs` 扩展名
   - 必须使用 `import/export` 语法
   - Node.js 20+ 原生支持

3. **依赖项**：
   - `@aws-sdk/client-bedrock-runtime` (DeepSeek, Qwen)
   - `technicalindicators` (RSI, MACD 等)

4. **更新策略**：
   - 修改共享模块后，需要重新发布 Layer
   - 两个 Lambda (crypto, stock) 都需要更新 Layer 引用

---

## 🎯 未来扩展

- [ ] 添加更多技术指标 (EMA, ATR, Stochastic)
- [ ] 支持更多 LLM (Anthropic Claude 4, Mistral)
- [ ] 添加单元测试
- [ ] 性能优化（缓存、批处理）
- [ ] 错误重试策略优化

---

生成时间：2025-11-18
