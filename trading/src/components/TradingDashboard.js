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
  const [historyData24h, setHistoryData24h] = useState([]);
  const [historyData7d, setHistoryData7d] = useState([]);
  const [historyData30d, setHistoryData30d] = useState([]);
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

      // 并行请求 portfolios, decisions 和 3个不同时间范围的 history
      const [portfoliosRes, decisionsRes, history24hRes, history7dRes, history30dRes] = await Promise.all([
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
        // 24小时：每小时1个点（最多24个点）
        fetch(`${TRADING_API_URL}/history?hours=24`, {
          headers: {
            'clerk-token': token,
            'x-user-email': userEmail,
            'Content-Type': 'application/json'
          }
        }),
        // 7天：每4小时1个点（最多42个点）
        fetch(`${TRADING_API_URL}/history?hours=168`, {
          headers: {
            'clerk-token': token,
            'x-user-email': userEmail,
            'Content-Type': 'application/json'
          }
        }),
        // 30天：每天1个点（最多30个点）
        fetch(`${TRADING_API_URL}/history?hours=720`, {
          headers: {
            'clerk-token': token,
            'x-user-email': userEmail,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!portfoliosRes.ok || !decisionsRes.ok || !history24hRes.ok || !history7dRes.ok || !history30dRes.ok) {
        throw new Error('API请求失败');
      }

      const portfoliosData = await portfoliosRes.json();
      const decisionsData = await decisionsRes.json();
      const history24hData = await history24hRes.json();
      const history7dData = await history7dRes.json();
      const history30dData = await history30dRes.json();

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

      if (history24hData.success) {
        setHistoryData24h(history24hData.history || []);
      }

      if (history7dData.success) {
        setHistoryData7d(history7dData.history || []);
      }

      if (history30dData.success) {
        setHistoryData30d(history30dData.history || []);
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

      {/* Agent 性能卡片 - 响应式布局 */}
      {/* 手机: 1列 | 平板竖屏: 2列 | 平板横屏/桌面: 3列 */}
      {/* 第一行: DeepSeek R1, GPT-4.1, GPT-4o mini */}
      {/* 第二行: Gemini 2.5 Pro, Gemini 2.5 Flash, Sonnet 4.5 */}
      {/* 第三行: Haiku 4.5, Grok 4, Grok 3 mini */}
      {/* 第四行: BITW, GDLC */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(() => {
          // 固定显示顺序：DeepSeek在最前，Qwen紧随其后，Gemini Pro在Flash前，其他按厂商分组
          const displayOrder = [
            'deepseek_v3', 'qwen3_235b',
            'openai_standard', 'openai_mini',
            'gemini_pro', 'gemini_flash',
            'claude_standard', 'claude_mini',
            'grok_standard', 'grok_mini',
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

      {/* 账户价值趋势图 - 传入3个不同时间范围的数据 */}
      {(historyData24h.length > 0 || historyData7d.length > 0 || historyData30d.length > 0) && (
        <PerformanceTrendChart
          historyData24h={historyData24h}
          historyData7d={historyData7d}
          historyData30d={historyData30d}
        />
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

      {/* CoinGecko 归属声明 */}
      <footer className="mt-8 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">
          Price data provided by{' '}
          <a
            href="https://www.coingecko.com/en/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 hover:underline"
          >
            CoinGecko API
          </a>
        </p>
      </footer>
    </div>
  );
};

export default TradingDashboard;
