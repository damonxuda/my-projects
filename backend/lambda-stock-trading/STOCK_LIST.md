# 美股量化交易 - 交易标的清单

## 📊 交易标的（10-15只）

### 大盘 ETF（2只）
1. **SPY** - SPDR S&P 500 ETF（标普500指数基金）
2. **QQQ** - Invesco QQQ Trust（纳斯达克100指数基金）- **作为基准**

### 科技股（7只）
3. **AAPL** - Apple Inc.（苹果）
4. **MSFT** - Microsoft Corporation（微软）
5. **GOOGL** - Alphabet Inc. Class A（谷歌）
6. **AMZN** - Amazon.com Inc.（亚马逊）
7. **NVDA** - NVIDIA Corporation（英伟达）
8. **TSLA** - Tesla Inc.（特斯拉）
9. **META** - Meta Platforms Inc.（Meta/Facebook）

### 其他热门股（3只）
10. **NFLX** - Netflix Inc.（奈飞）
11. **DIS** - The Walt Disney Company（迪士尼）
12. **JPM** - JPMorgan Chase & Co.（摩根大通）

### 可选（如果需要扩展到15只）
13. **V** - Visa Inc.（维萨）
14. **WMT** - Walmart Inc.（沃尔玛）
15. **JNJ** - Johnson & Johnson（强生）

---

## 🎯 基准策略

### QQQ Buy & Hold
- **初始资金**：$50,000
- **策略**：第一个小时全部买入 QQQ，然后一直持有
- **用途**：作为所有 LLM 的对比基准

---

## 📈 数据源

### Yahoo Finance API（免费）
- **实时报价**：延迟 15-20 分钟（对模拟盘足够）
- **历史数据**：OHLCV（开高低收成交量）
- **公司信息**：市值、PE、分红等
- **技术指标**：可自行计算（RSI, MACD, MA等）

### 财经新闻（可选）
- **NewsAPI**（免费额度）
- **Alpha Vantage News**（免费）
- **Yahoo Finance News**（免费）

---

## ⏰ 交易时间安排

### Phase 1：盘中交易
- **交易时间**：美东 9:30 - 16:00（周一至周五）
- **执行频率**：每小时一次
- **CloudWatch Cron**：
  ```
  # 美东 9:30, 10:30, 11:30, 12:30, 13:30, 14:30, 15:30
  # UTC 14:30, 15:30, 16:30, 17:30, 18:30, 19:30, 20:30
  cron(30 14-20 ? * MON-FRI *)
  ```

### Phase 2：盘后/夜盘（未来）
- 考虑盘前（7:00-9:30）和盘后（16:00-20:00）交易
- 需要支持更多交易时段

---

## 💡 LLM 决策提示词要点

### 需要提供给 LLM 的信息
1. **当前持仓**：现金、各股票持仓、总价值
2. **市场数据**：各股票当前价格、涨跌幅、成交量
3. **技术指标**：RSI、MACD、移动平均线等
4. **基本面数据**：PE、市值、行业等
5. **新闻摘要**：最近的重要新闻（可选）
6. **历史表现**：自己的交易历史和收益率

### LLM 需要返回的决策
```json
{
  "action": "buy",           // buy / sell / hold / rebalance
  "asset": "AAPL",          // 股票代码
  "amount": 10,             // 股数（整数）
  "reason": "分析原因..."    // 决策理由
}
```

---

## 🔄 与 Crypto 交易的主要区别

| 项目 | Crypto 交易 | Stock 交易 |
|------|------------|-----------|
| 交易标的 | BTC, ETH, SOL 等 | AAPL, MSFT, GOOGL 等 |
| 交易单位 | 可以买 0.0001 BTC | 必须买整数股 |
| 交易时间 | 24/7 | 周一至周五 9:30-16:00 ET |
| 价格波动 | 极大（±10%常见） | 较小（±2-5%） |
| 数据源 | CoinGecko | Yahoo Finance |
| 基准 | GDLC, BITW | QQQ, SPY |

---

## 📝 注意事项

1. **整数股**：股票交易必须买卖整数股（不像 crypto 可以买 0.1 个）
2. **最小交易金额**：建议每次交易至少 $1,000（避免手续费占比过高）
3. **分红处理**：如果股票分红，需要自动再投资
4. **股票拆分**：需要处理股票分割（stock split）事件
5. **停牌/退市**：需要处理特殊情况

---

## 🚀 下一步

1. 在 Supabase 执行 `create-tables.sql` 创建数据表
2. 创建 Lambda 函数获取 Yahoo Finance 数据
3. 测试能否正确获取上述股票的实时报价
4. 实现 LLM 决策逻辑
