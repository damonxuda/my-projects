import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, MinusCircle, Clock } from 'lucide-react';

const DecisionTimeline = ({ decisions }) => {
  // 格式化时间
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;

    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Agent 图标 (9个agents)
  const agentIcons = {
    // OpenAI
    openai_standard: '🟢',
    openai_mini: '🟩',

    // Gemini
    gemini_flash: '🔷',

    // Claude
    claude_standard: '🟣',
    claude_mini: '🟪',

    // Grok
    grok_standard: '🟠',
    grok_mini: '🟧',

    // ETF
    gdlc: '📊',
    equal_weight: '⚖️'
  };

  // Action 配置
  const actionConfig = {
    buy: {
      icon: ArrowUpCircle,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      label: '买入'
    },
    sell: {
      icon: ArrowDownCircle,
      color: 'red',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      label: '卖出'
    },
    hold: {
      icon: MinusCircle,
      color: 'gray',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-800',
      label: '持有'
    },
    dividend_reinvest: {
      icon: ArrowUpCircle,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      label: '分红再投资'
    }
  };

  // 过滤基准策略的普通决策，只保留特殊事件（如分红、配股）
  const filteredDecisions = decisions.filter(item => {
    const isBenchmark = ['gdlc', 'equal_weight'].includes(item.agent_name);
    if (!isBenchmark) return true; // LLM决策全部显示

    // 基准策略：只显示特殊事件（如dividend_reinvest, stock_split等）
    // 过滤掉buy_etf（初始买入）和hold（持有）
    const isSpecialEvent = !['buy_etf', 'hold'].includes(item.decision.action);
    return isSpecialEvent;
  });

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto">
      {filteredDecisions.map((item, index) => {
        const config = actionConfig[item.decision.action] || actionConfig.hold;
        const Icon = config.icon;

        return (
          <div
            key={item.id}
            className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 hover:shadow-sm transition-shadow`}
          >
            <div className="flex items-start justify-between">
              {/* 左侧：Agent 和 Action */}
              <div className="flex items-start space-x-3">
                {/* Agent 图标 */}
                <div className="flex-shrink-0 mt-1">
                  <span className="text-2xl">{agentIcons[item.agent_name] || '⚪'}</span>
                </div>

                {/* 决策详情 */}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon className={config.textColor} size={20} />
                    <span className={`font-semibold ${config.textColor}`}>
                      {config.label}
                    </span>
                    {item.decision.asset && item.decision.asset !== 'null' && (
                      <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-gray-300">
                        {item.decision.asset}
                      </span>
                    )}
                    {item.decision.amount > 0 && (
                      <span className="text-sm text-gray-700">
                        × {item.decision.amount.toFixed(4)}
                      </span>
                    )}
                  </div>

                  {/* 决策理由 */}
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {item.decision.reason}
                  </p>

                  {/* 市场快照（如果有）*/}
                  {item.market_data && (
                    <div className="mt-2 flex space-x-4 text-xs text-gray-600">
                      {/* 显示交易资产的价格（如果有） */}
                      {item.decision.asset && item.decision.asset !== 'null' && item.market_data[item.decision.asset] && (
                        <span className="font-semibold">
                          {item.decision.asset}: ${
                            item.market_data[item.decision.asset].price >= 1
                              ? item.market_data[item.decision.asset].price.toFixed(2)
                              : item.market_data[item.decision.asset].price.toFixed(4)
                          }
                          {item.market_data[item.decision.asset].change_24h !== undefined && (
                            <span className={item.market_data[item.decision.asset].change_24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {' '}({item.market_data[item.decision.asset].change_24h.toFixed(2)}%)
                            </span>
                          )}
                        </span>
                      )}
                      {/* 显示BTC作为参考（如果不是交易资产） */}
                      {item.market_data.BTC && item.decision.asset !== 'BTC' && (
                        <span>
                          BTC: ${item.market_data.BTC.price?.toFixed(0) || 'N/A'}
                          {item.market_data.BTC.change_24h !== undefined && (
                            <span className={item.market_data.BTC.change_24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {' '}({item.market_data.BTC.change_24h.toFixed(2)}%)
                            </span>
                          )}
                        </span>
                      )}
                      {/* 显示ETH作为参考（如果不是交易资产） */}
                      {item.market_data.ETH && item.decision.asset !== 'ETH' && (
                        <span>
                          ETH: ${item.market_data.ETH.price?.toFixed(0) || 'N/A'}
                          {item.market_data.ETH.change_24h !== undefined && (
                            <span className={item.market_data.ETH.change_24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {' '}({item.market_data.ETH.change_24h.toFixed(2)}%)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：时间戳 */}
              <div className="flex-shrink-0 flex items-center space-x-1 text-xs text-gray-500">
                <Clock size={12} />
                <span>{formatTime(item.created_at)}</span>
              </div>
            </div>

            {/* 账户价值（如果有）*/}
            {item.portfolio_value && (
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                决策时账户价值: ${item.portfolio_value.toFixed(2)}
              </div>
            )}
          </div>
        );
      })}

      {/* 空状态 */}
      {decisions.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          暂无决策记录
        </div>
      )}
    </div>
  );
};

export default DecisionTimeline;
