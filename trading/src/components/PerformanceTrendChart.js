import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PerformanceTrendChart = ({ historyData }) => {
  // Agent 颜色配置 - 每个模型一个颜色（按卡片显示顺序排列）
  const agentColors = {
    'deepseek_r1': '#DC2626',        // red-600
    'openai_standard': '#10B981',    // green-500
    'openai_mini': '#34D399',        // green-400
    'gemini_pro': '#2563EB',         // blue-600
    'gemini_flash': '#3B82F6',       // blue-500
    'claude_standard': '#8B5CF6',    // purple-500
    'claude_mini': '#A78BFA',        // purple-400
    'grok_standard': '#F97316',      // orange-500
    'grok_mini': '#FB923C',          // orange-400
    'gdlc': '#EAB308',               // yellow-500
    'equal_weight': '#6B7280'        // gray-500
  };

  // 添加初始点（round=0，所有agent都是50000）
  const initialPoint = {
    round: 0,
    deepseek_r1: 50000,
    openai_standard: 50000,
    openai_mini: 50000,
    gemini_pro: 50000,
    gemini_flash: 50000,
    claude_standard: 50000,
    claude_mini: 50000,
    grok_standard: 50000,
    grok_mini: 50000,
    gdlc: 50000,
    equal_weight: 50000
  };

  // 合并初始点和历史数据
  const chartData = [initialPoint, ...historyData];

  // 模型显示名称（按卡片显示顺序排列）
  const agentNames = {
    'deepseek_r1': 'DeepSeek R1',
    'openai_standard': 'GPT-4.1',
    'openai_mini': 'GPT-4o mini',
    'gemini_pro': 'Gemini 2.5 Pro',
    'gemini_flash': 'Gemini 2.5 Flash',
    'claude_standard': 'Sonnet 4.5',
    'claude_mini': 'Haiku 4.5',
    'grok_standard': 'Grok 4',
    'grok_mini': 'Grok 3 mini',
    'gdlc': 'GDLC',
    'equal_weight': 'BITW'
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
      <h2 className="text-xl font-bold text-gray-900 mb-4">账户价值趋势</h2>

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
