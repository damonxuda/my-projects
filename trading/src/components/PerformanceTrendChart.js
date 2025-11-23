import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PerformanceTrendChart = ({ historyData24h, historyData7d, historyData30d, projectStartTime, mode = 'crypto' }) => {
  // mode: 'crypto' (数字货币) 或 'stock' (美股)
  // 时间范围选择：24h（全采样）/ 7d（4小时采样）/ 30d（1天采样）
  const [timeRange, setTimeRange] = useState('24h');

  // 根据时间范围选择对应的数据
  const getHistoryData = () => {
    switch(timeRange) {
      case '24h': return historyData24h || [];
      case '7d': return historyData7d || [];
      case '30d': return historyData30d || [];
      default: return historyData24h || [];
    }
  };

  const historyData = getHistoryData();

  // 判断是否需要添加初始点：项目开始时间在当前视图范围内
  const shouldAddInitialPoint = () => {
    if (!projectStartTime) return false;

    const now = new Date();
    const startTime = new Date(projectStartTime);
    const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

    // 根据当前视图判断
    switch(timeRange) {
      case '24h': return hoursSinceStart <= 24;
      case '7d': return hoursSinceStart <= 168; // 7天 = 168小时
      case '30d': return hoursSinceStart <= 720; // 30天 = 720小时
      default: return false;
    }
  };

  // Agent 颜色配置 - 根据 mode 动态选择
  const cryptoETFs = {
    'equal_weight': '#06B6D4',       // cyan-500 (Equal Weight 加密货币 ETF)
    'gdlc': '#14B8A6'                // teal-500 (Grayscale Digital Large Cap ETF)
  };

  const stockETFs = {
    'qqq': '#06B6D4',                // cyan-500 (纳斯达克100 ETF)
    'vgt': '#14B8A6',                // teal-500 (科技股ETF)
    'spy': '#6366F1'                 // indigo-500 (标普500 ETF)
  };

  const baseAgentColors = {
    'openai_standard': '#10B981',    // green-500
    'openai_mini': '#34D399',        // green-400
    'gemini_pro': '#2563EB',         // blue-600
    'gemini_flash': '#3B82F6',       // blue-500
    'claude_standard': '#8B5CF6',    // purple-500
    'claude_mini': '#A78BFA',        // purple-400
    'grok_standard': '#F97316',      // orange-500
    'grok_mini': '#FB923C'           // orange-400
  };

  const agentColors = {
    ...baseAgentColors,
    ...(mode === 'stock' ? stockETFs : cryptoETFs)
  };

  // 初始点定义（所有agent都从$50,000开始）- 根据 mode 动态生成
  const baseInitialPoint = {
    round: 0,
    openai_standard: 50000,
    openai_mini: 50000,
    gemini_pro: 50000,
    gemini_flash: 50000,
    claude_standard: 50000,
    claude_mini: 50000,
    grok_standard: 50000,
    grok_mini: 50000
  };

  const cryptoETFInitialPoints = {
    equal_weight: 50000,
    gdlc: 50000
  };

  const stockETFInitialPoints = {
    qqq: 50000,
    vgt: 50000,
    spy: 50000
  };

  const initialPoint = {
    ...baseInitialPoint,
    ...(mode === 'stock' ? stockETFInitialPoints : cryptoETFInitialPoints)
  };

  // 合并 deepseek_v3 和 deepseek_r1 的数据
  const mergedHistoryData = historyData.map(point => {
    const merged = { ...point };
    // 如果存在 deepseek_v3 或 deepseek_r1，合并到 deepseek
    if (point.deepseek_v3 !== undefined || point.deepseek_r1 !== undefined) {
      merged.deepseek = point.deepseek_r1 || point.deepseek_v3;
      delete merged.deepseek_v3;
      delete merged.deepseek_r1;
    }
    return merged;
  });

  // 根据项目开始时间动态决定是否添加初始点
  const chartData = shouldAddInitialPoint() ? [initialPoint, ...mergedHistoryData] : mergedHistoryData;

  // 模型显示名称（按卡片显示顺序排列）- 根据 mode 动态选择
  const baseAgentNames = {
    'openai_standard': 'GPT-4.1',
    'openai_mini': 'GPT-4o mini',
    'gemini_pro': 'Gemini 2.5 Pro',
    'gemini_flash': 'Gemini 2.5 Flash',
    'claude_standard': 'Sonnet 4.5',
    'claude_mini': 'Haiku 4.5',
    'grok_standard': 'Grok 4.1',
    'grok_mini': 'Grok 4.1 Fast'
  };

  const cryptoETFNames = {
    'equal_weight': 'Equal Weight',
    'gdlc': 'GDLC'
  };

  const stockETFNames = {
    'qqq': 'QQQ',
    'vgt': 'VGT',
    'spy': 'SPY'
  };

  const agentNames = {
    ...baseAgentNames,
    ...(mode === 'stock' ? stockETFNames : cryptoETFNames)
  };

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          {payload
            .sort((a, b) => b.value - a.value) // 按值排序
            .map((entry, index) => (
              <p key={index} className="text-xs" style={{ color: entry.color }}>
                {entry.name}: ${entry.value?.toFixed(2) || '0.00'}
              </p>
            ))}
        </div>
      );
    }
    return null;
  };

  // 计算Y轴范围（根据所有数据的最大最小值，包括初始点50000）
  const calculateYAxisDomain = () => {
    let min = 50000;  // 初始值
    let max = 50000;  // 初始值

    chartData.forEach((point) => {
      Object.keys(agentColors).forEach((agent) => {
        const value = point[agent];
        if (value !== undefined && value !== null) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    // 计算波动范围并留10%余量
    const range = max - min;
    const margin = range * 0.1 || 1000; // 至少1000的余量

    return [
      Math.floor(min - margin),
      Math.ceil(max + margin)
    ];
  };

  const yAxisDomain = calculateYAxisDomain();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* 标题和时间范围选择器 */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">账户价值趋势</h2>

        {/* 时间范围切换按钮 */}
        <div className="flex space-x-2">
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              timeRange === '24h'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            24小时
          </button>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              timeRange === '7d'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            7天
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              timeRange === '30d'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            30天
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="round"
            tick={false}
            axisLine={{ stroke: '#d1d5db' }}
            label={{ value: '时间 →', position: 'insideRight', style: { fontSize: 12, fill: '#6b7280' } }}
          />
          <YAxis
            domain={yAxisDomain}
            label={{ value: '账户价值 ($)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => agentNames[value] || value}
          />

          {/* 为每个 agent 画一条线 - 使用直线连接离散点 */}
          {Object.keys(agentColors).map((agent) => (
            <Line
              key={agent}
              dataKey={agent}
              stroke={agentColors[agent]}
              strokeWidth={2}
              dot={false}
              name={agent}
              connectNulls={true}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceTrendChart;
