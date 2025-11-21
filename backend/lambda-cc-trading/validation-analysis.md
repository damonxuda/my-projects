# DeepSeek验证错误分析

## 错误现象
CloudWatch日志显示：
```
[DeepSeek] Decision parsing failed: Invalid trade at index 0: Invalid amount: 0. Must be positive number
```

## 错误原因分析

### 1. 这不是"交易6个以外的货币"的问题
- ❌ CloudWatch日志中**没有** "Invalid asset" 错误
- ✅ 所有错误都是 **"Invalid amount: 0"**
- ✅ Asset验证是生效的，所有LLM都受到6个货币的限制

### 2. 真正的问题：buy/sell动作的amount=0

**Prompt中的正确格式：**
```json
// hold动作（amount可以为0）
{"action": "hold", "asset": null, "amount": 0, "reason": "..."}

// buy动作（amount必须 > 0）
{"action": "buy", "asset": "BTC", "amount": 0.1, "reason": "..."}
```

**验证逻辑（decision-parser.mjs）：**
```javascript
// Line 65-68: hold动作跳过验证
if (decision.action === 'hold') {
    return decision;  // ✅ amount=0 允许
}

// Line 80-84: buy/sell动作严格验证
if (requireAmount) {
    if (typeof decision.amount !== 'number' || decision.amount <= 0) {
        throw new Error(`Invalid amount: ${decision.amount}. Must be positive number`);  // ❌ amount=0 拒绝
    }
}
```

**DeepSeek的错误行为：**
- 在多笔交易的某一笔中，action设置为buy/sell，但amount设置为0
- 例如：`{"action": "buy", "asset": "BTC", "amount": 0, "reason": "..."}`
- 这违反了验证规则

## 验证机制工作正常

✅ **所有10个LLM使用同一个验证规则**
- 位置：`lambda-trading-shared/decision-parser.mjs` 的 `parseAndValidateDecision()` 函数
- Lambda中调用：`index.mjs` line 276-281
```javascript
const decision = parseAndValidateDecisionFromLayer(result.text, {
    modelName: displayName,
    availableAssets: AVAILABLE_ASSETS,  // 严格限制：BTC, ETH, SOL, BNB, DOGE, XRP
    allowHold: true,
    requireAmount: true  // 必须提供正数amount
});
```

✅ **降级保护生效**
- 当验证失败时，系统返回fallback决策：
```javascript
{
    action: 'hold',
    asset: null,
    amount: 0,
    reason: 'API调用失败（Invalid trade at index 0: Invalid amount: 0. Must be positive number），保持持有'
}
```
- Portfolio正常更新（价格更新），但不保存错误决策

## 近期错误统计

**最近12小时的验证错误：**
1. DeepSeek: 2次 (05:27, 06:16)
2. Qwen3: 1次 (01:59)

所有错误都是 "Invalid amount: 0"，没有asset相关错误。

## 结论

1. ✅ 验证规则生效：所有LLM共享同一个验证逻辑
2. ✅ Asset限制生效：没有LLM尝试交易6个货币以外的资产
3. ✅ 降级保护生效：验证失败时正确fallback到hold
4. ❌ DeepSeek偶尔违反规则：在buy/sell中设置amount=0

这是LLM理解prompt的问题，不是代码验证的问题。验证机制正确地拒绝了这些错误决策。
