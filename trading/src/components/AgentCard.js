import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

const AgentCard = ({ portfolio, marketData }) => {
  const { agent_name, total_value, cash, holdings, pnl, pnl_percentage } = portfolio;

  // Agent 显示名称和颜色 (9个AI模型 + 2个ETF) - v2.0
  // 旗舰型用圆形，轻量级用菱形/方块
  const agentInfo = {
    // OpenAI
    openai_standard: { name: 'GPT-4.1', color: 'green', icon: '🟢' },       // 旗舰-圆形
    openai_mini: { name: 'GPT-4o mini', color: 'green', icon: '🟩' },      // 轻量-方块

    // Gemini
    gemini_flash: { name: 'Gemini 2.5 Flash', color: 'blue', icon: '🔷' }, // 轻量-菱形
    gemini_pro: { name: 'Gemini 2.5 Pro', color: 'blue', icon: '🔵' },     // 旗舰-圆形

    // Claude
    claude_standard: { name: 'Sonnet 4.5', color: 'purple', icon: '🟣' },  // 旗舰-圆形
    claude_mini: { name: 'Haiku 4.5', color: 'purple', icon: '🟪' },       // 轻量-方块

    // Grok
    grok_standard: { name: 'Grok 4 Fast Reasoning', color: 'orange', icon: '🟠' },        // 推理型-圆形
    grok_mini: { name: 'Grok 4 Fast', color: 'orange', icon: '🔶' },       // 非推理型-菱形

    // DeepSeek (合并 V3 和 R1，统一显示)
    deepseek: { name: 'DeepSeek', color: 'red', icon: '🔴' },              // 当前使用
    deepseek_v3: { name: 'DeepSeek', color: 'red', icon: '🔴' },           // 兼容历史数据
    deepseek_r1: { name: 'DeepSeek', color: 'red', icon: '🔴' },           // 兼容历史数据

    // Qwen
    qwen3_235b: { name: 'Qwen3 235B', color: 'pink', icon: '🩷' },         // 旗舰-心形

    // 美股ETF基准
    qqq: { name: 'QQQ', color: 'cyan', icon: '🔷' },                       // 纳斯达克100 ETF
    vgt: { name: 'VGT', color: 'teal', icon: '🔶' },                       // 科技股ETF
    spy: { name: 'SPY', color: 'indigo', icon: '🟦' }                      // 标普500 ETF
  };

  const info = agentInfo[agent_name] || { name: agent_name, color: 'gray', icon: '⚪' };
  const isProfitable = pnl >= 0;

  // 格式化货币
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // 格式化百分比
  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className={`bg-white rounded-lg border-2 border-${info.color}-200 shadow-sm hover:shadow-md transition-shadow p-5`}>
      {/* Agent 名称 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{info.icon}</span>
          <h3 className="font-bold text-lg text-gray-900">{info.name}</h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
          isProfitable
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {formatPercent(pnl_percentage)}
        </div>
      </div>

      {/* 总资产 */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 text-gray-600 mb-1">
          <Wallet size={16} />
          <span className="text-sm">总资产</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {formatCurrency(total_value)}
        </div>
        <div className={`flex items-center space-x-1 text-sm ${
          isProfitable ? 'text-green-600' : 'text-red-600'
        }`}>
          {isProfitable ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{formatCurrency(Math.abs(pnl))}</span>
        </div>
      </div>

      {/* 现金和持仓 */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 flex items-center space-x-1">
            <DollarSign size={14} />
            <span>现金</span>
          </span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(cash)}
          </span>
        </div>

        {/* 持仓详情 */}
        {Object.keys(holdings).length > 0 ? (
          <div className="space-y-1">
            <span className="text-xs text-gray-500">持仓:</span>
            {(() => {
              // 分离股票持仓和ETF持仓
              const stockHoldings = [];
              const etfHoldings = [];

              Object.entries(holdings).forEach(([key, value]) => {
                // ETF份额字段：QQQ_SHARES, VGT_SHARES, SPY_SHARES
                if (key.endsWith('_SHARES') && value > 0) {
                  const ticker = key.replace('_SHARES', '');
                  const initPrice = holdings[`${ticker}_INIT_PRICE`];
                  const currentPrice = marketData && marketData[ticker] ? marketData[ticker].price : null;
                  etfHoldings.push({ ticker, shares: value, initPrice, currentPrice });
                }
                // 股票持仓：不包含元数据字段
                else if (!key.includes('_INIT_PRICE') && !key.includes('_LAST_DIV_CHECK') && !key.includes('_LAST_FEE_CHECK') && value > 0) {
                  const price = marketData && marketData[key] ? marketData[key].price : null;
                  stockHoldings.push({ asset: key, amount: value, price });
                }
              });

              return (
                <>
                  {/* 显示股票持仓 */}
                  {stockHoldings.map(({ asset, amount, price }) => {
                    const value = price ? amount * price : null;
                    return (
                      <div key={asset} className="flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                          <span className="text-gray-600">{asset}</span>
                          {price && (
                            <span className="text-xs text-gray-400">
                              @${price >= 1 ? price.toFixed(2) : price.toFixed(4)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-gray-900">
                            {amount >= 1 ? amount.toFixed(2) : amount.toFixed(4)}
                          </span>
                          {value && (
                            <span className="text-xs text-gray-500">
                              ≈ ${value.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* 显示ETF持仓 */}
                  {etfHoldings.map(({ ticker, shares, initPrice, currentPrice }) => {
                    const value = currentPrice ? shares * currentPrice : null;
                    return (
                      <div key={ticker} className="flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                          <span className="text-gray-600 font-semibold">{ticker}</span>
                          {currentPrice && (
                            <span className="text-xs text-gray-400">
                              @${currentPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-gray-900">
                            {shares.toFixed(2)} 份
                          </span>
                          {value && (
                            <span className="text-xs text-gray-500">
                              ≈ ${value.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">无持仓</div>
        )}
      </div>
    </div>
  );
};

export default AgentCard;
