import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../auth-clerk/src';
import AgentCard from './AgentCard';
import DecisionTimeline from './DecisionTimeline';
import PerformanceTrendChart from './PerformanceTrendChart';
import { RefreshCw, AlertCircle } from 'lucide-react';

const TradingDashboard = () => {
  const { getCachedToken, user } = useAuth();

  // 状态管理
  const [portfolios, setPortfolios] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Supabase Edge Function URL (从环境变量读取)
  const TRADING_API_URL = process.env.REACT_APP_TRADING_API_URL;

  // 获取数据
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取 Clerk token 和用户邮箱
      const token = await getCachedToken();
      if (!token) {
        throw new Error('未能获取认证token');
      }

      const userEmail = user?.primaryEmailAddress?.emailAddress;
      if (!userEmail) {
        throw new Error('未能获取用户邮箱');
      }

      // 并行请求 portfolios, decisions 和 history
      const [portfoliosRes, decisionsRes, historyRes] = await Promise.all([
        fetch(`${TRADING_API_URL}/portfolios`, {
          headers: {
            'clerk-token': token,
            'x-user-email': userEmail,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${TRADING_API_URL}/decisions?limit=50`, {
          headers: {
            'clerk-token': token,
            'x-user-email': userEmail,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${TRADING_API_URL}/history?hours=240`, {
          headers: {
            'clerk-token': token,
            'x-user-email': userEmail,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!portfoliosRes.ok || !decisionsRes.ok || !historyRes.ok) {
        throw new Error('API请求失败');
      }

      const portfoliosData = await portfoliosRes.json();
      const decisionsData = await decisionsRes.json();
      const historyDataRes = await historyRes.json();

      if (portfoliosData.success) {
        setPortfolios(portfoliosData.portfolios || []);
      }

      if (decisionsData.success) {
        setDecisions(decisionsData.decisions || []);

        // 从最新的决策中提取市场数据（用于显示实时价格）
        if (decisionsData.decisions && decisionsData.decisions.length > 0) {
          const latestDecision = decisionsData.decisions[0];
          if (latestDecision.market_data) {
            setMarketData(latestDecision.market_data);
          }
        }
      }

      if (historyDataRes.success) {
        setHistoryData(historyDataRes.history || []);
      }

      setLastUpdate(new Date());
      setLoading(false);

    } catch (err) {
      console.error('Failed to fetch trading data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchData();
    // 每5分钟自动刷新一次
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 加载中
  if (loading && portfolios.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载交易数据中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && portfolios.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="text-red-500" size={24} />
          <div>
            <h3 className="font-semibold text-red-900">加载失败</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 刷新按钮和最后更新时间 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">实时数据监控</h2>
          {lastUpdate && (
            <p className="text-sm text-gray-500 mt-1">
              最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            loading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? '刷新中...' : '刷新数据'}</span>
        </button>
      </div>

      {/* Agent 性能卡片 - 4行3列固定布局 */}
      {/* 第一行: GPT-5, GPT-4o mini, Gemini 2.5 Flash */}
      {/* 第二行: Gemini 2.5 Pro, Sonnet 4.5, Haiku 4.5 */}
      {/* 第三行: Grok 4, Grok 3 mini, DeepSeek R1 */}
      {/* 第四行: BITW, GDLC */}
      <div className="grid grid-cols-3 gap-4">
        {(() => {
          // 固定显示顺序：每个厂商的标准型+轻量级，然后是DeepSeek，最后是2个ETF
          const displayOrder = [
            'openai_standard', 'openai_mini',
            'gemini_flash', 'gemini_pro',
            'claude_standard', 'claude_mini',
            'grok_standard', 'grok_mini',
            'deepseek_r1',
            'equal_weight', 'gdlc'
          ];

          // 创建portfolio查找映射
          const portfolioMap = {};
          portfolios.forEach(p => {
            portfolioMap[p.agent_name.toLowerCase()] = p;
          });

          // 按固定顺序渲染卡片
          return displayOrder
            .map(agentName => portfolioMap[agentName])
            .filter(portfolio => portfolio) // 过滤掉不存在的agent
            .map(portfolio => (
              <AgentCard
                key={portfolio.agent_name}
                portfolio={portfolio}
                marketData={marketData}
              />
            ));
        })()}
      </div>

      {/* 账户价值趋势图 */}
      {historyData.length > 0 && (
        <PerformanceTrendChart historyData={historyData} />
      )}

      {/* 决策时间线 */}
      {decisions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最新决策</h3>
          <DecisionTimeline decisions={decisions} />
        </div>
      )}

      {/* 空状态 */}
      {portfolios.length === 0 && !loading && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-gray-600">暂无交易数据</p>
          <p className="text-sm text-gray-500 mt-2">
            Lambda函数将每小时执行一次交易决策
          </p>
        </div>
      )}
    </div>
  );
};

export default TradingDashboard;
