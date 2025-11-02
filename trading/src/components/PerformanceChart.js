import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const PerformanceChart = ({ portfolios }) => {
  // 分组：LLM agents 和 基准策略
  const llmAgents = ['GEMINI', 'CLAUDE', 'GROK', 'OPENAI'];
  const benchmarks = ['GDLC', 'EQUAL_WEIGHT'];

  // 准备图表数据并分组排序
  const portfolioData = portfolios.map(p => ({
    name: p.agent_name.toUpperCase(),
    pnl_percentage: parseFloat(p.pnl_percentage?.toFixed(2) || 0),
    total_value: parseFloat(p.total_value || 0),
    isBenchmark: benchmarks.includes(p.agent_name.toUpperCase())
  }));

  // 分别对LLM和基准排序，然后合并（LLM在前，基准在后）
  const llmData = portfolioData
    .filter(p => llmAgents.includes(p.name))
    .sort((a, b) => b.pnl_percentage - a.pnl_percentage);

  const benchmarkData = portfolioData
    .filter(p => benchmarks.includes(p.name))
    .sort((a, b) => b.pnl_percentage - a.pnl_percentage);

  const chartData = [...llmData, ...benchmarkData];

  // Agent 颜色
  const agentColors = {
    GEMINI: '#3B82F6',  // blue
    CLAUDE: '#8B5CF6',  // purple
    GROK: '#F97316',    // orange
    OPENAI: '#10B981',  // green
    GDLC: '#EAB308',    // yellow
    EQUAL_WEIGHT: '#6B7280'  // gray
  };

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className={`text-sm ${data.pnl_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            收益率: {data.pnl_percentage >= 0 ? '+' : ''}{data.pnl_percentage}%
          </p>
          <p className="text-sm text-gray-600">
            总资产: ${data.total_value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={{ stroke: '#d1d5db' }}
        />
        <YAxis
          label={{ value: '收益率 (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={{ stroke: '#d1d5db' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={() => '收益率 (%)'}
        />
        <Bar dataKey="pnl_percentage" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.pnl_percentage >= 0 ? '#10B981' : '#EF4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default PerformanceChart;
