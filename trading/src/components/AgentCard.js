import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

const AgentCard = ({ portfolio, marketData }) => {
  const { agent_name, total_value, cash, holdings, pnl, pnl_percentage } = portfolio;

  // Agent 显示名称和颜色 (8个AI模型 + 2个ETF)
  const agentInfo = {
    // OpenAI
    openai_standard: { name: 'GPT-5', color: 'green', icon: '🟢' },
    openai_mini: { name: 'GPT-4o mini', color: 'green', icon: '🟩' },

    // Gemini
    gemini_flash: { name: 'Gemini 2.5 Flash', color: 'blue', icon: '🔷' },
    gemini_pro: { name: 'Gemini 2.5 Pro', color: 'blue', icon: '🔶' },

    // Claude
    claude_standard: { name: 'Sonnet 4.5', color: 'purple', icon: '🟣' },
    claude_mini: { name: 'Haiku 4.5', color: 'purple', icon: '🟪' },

    // Grok
    grok_standard: { name: 'Grok 4', color: 'orange', icon: '🟠' },
    grok_mini: { name: 'Grok 3 mini', color: 'orange', icon: '🟧' },

    // ETF
    gdlc: { name: 'GDLC', color: 'yellow', icon: '📊' },
    equal_weight: { name: 'BITW', color: 'gray', icon: '⚖️' }
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
            {Object.entries(holdings)
              .filter(([asset, amount]) => {
                // 过滤掉ETF元数据字段（_SHARES, _INIT_PRICE, _LAST_DIV_CHECK）
                // 只显示加密货币持仓（BTC, ETH, SOL, BNB, DOGE, XRP）
                const isMetadataField = asset.includes('_SHARES') ||
                                       asset.includes('_INIT_PRICE') ||
                                       asset.includes('_LAST_DIV_CHECK');
                return !isMetadataField && amount > 0;
              })
              .map(([asset, amount]) => {
                // 计算持仓价值（如果有市场数据）
                const price = marketData && marketData[asset] ? marketData[asset].price : null;
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
                        {amount.toFixed(4)}
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
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">无持仓</div>
        )}
      </div>
    </div>
  );
};

export default AgentCard;
