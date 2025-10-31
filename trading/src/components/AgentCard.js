import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

const AgentCard = ({ portfolio }) => {
  const { agent_name, total_value, cash, holdings, pnl, pnl_percentage } = portfolio;

  // Agent 显示名称和颜色
  const agentInfo = {
    gemini: { name: 'Gemini', color: 'blue', icon: '🔷' },
    gpt4: { name: 'GPT-4', color: 'green', icon: '🟢' },
    claude: { name: 'Claude', color: 'purple', icon: '🟣' }
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
            {Object.entries(holdings).map(([asset, amount]) => (
              amount > 0 && (
                <div key={asset} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{asset}</span>
                  <span className="font-mono text-gray-900">
                    {amount.toFixed(4)}
                  </span>
                </div>
              )
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">无持仓</div>
        )}
      </div>
    </div>
  );
};

export default AgentCard;
