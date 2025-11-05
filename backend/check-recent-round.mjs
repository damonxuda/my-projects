import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yecdsnqbudbogqpcerqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllY2RzbnFidWRib2dxcGNlcnFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2MzE5MiwiZXhwIjoyMDcwMDM5MTkyfQ.-1PKCac1rN3FgceEYC7iN6VzZexLmXd9m13-sjsOdOY';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== 检查最近一轮 (02:15 UTC) 的数据保存情况 ===\n');

// 查询 02:15-02:20 之间的所有记录
const { data, error } = await supabase
  .from('llm_trading_portfolios')
  .select('agent_name, total_value, created_at')
  .gte('created_at', '2025-11-05T02:15:00Z')
  .lt('created_at', '2025-11-05T02:20:00Z')
  .order('created_at', { ascending: true });

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log(`找到 ${data.length} 条记录\n`);

// 按agent分组
const byAgent = {};
data.forEach(row => {
  if (!byAgent[row.agent_name]) {
    byAgent[row.agent_name] = [];
  }
  byAgent[row.agent_name].push(row);
});

// 检查每个agent
const expectedAgents = [
  'OPENAI_STANDARD', 'OPENAI_MINI',
  'GEMINI_FLASH', 'GEMINI_PRO',
  'CLAUDE_STANDARD', 'CLAUDE_MINI',
  'GROK_STANDARD', 'GROK_MINI',
  'DEEPSEEK_V3', 'QWEN3_235B',
  'GDLC', 'EQUAL_WEIGHT'
];

console.log('各模型保存时间：');
expectedAgents.forEach(agent => {
  if (byAgent[agent] && byAgent[agent].length > 0) {
    const record = byAgent[agent][0];
    const timestamp = new Date(record.created_at);
    const timeStr = timestamp.toISOString().substr(11, 12); // HH:MM:SS.mmm
    console.log(`✅ ${agent.padEnd(20)} ${timeStr}  $${parseFloat(record.total_value).toFixed(2)}`);
  } else {
    console.log(`❌ ${agent.padEnd(20)} 未找到数据`);
  }
});

// 重点检查这3个问题模型
console.log('\n=== 重点检查问题模型 ===');
const problemModels = ['GEMINI_PRO', 'CLAUDE_STANDARD', 'GEMINI_FLASH'];
problemModels.forEach(agent => {
  if (byAgent[agent] && byAgent[agent].length > 0) {
    const record = byAgent[agent][0];
    console.log(`\n${agent}:`);
    console.log(`  保存时间: ${record.created_at}`);
    console.log(`  账户金额: $${parseFloat(record.total_value).toFixed(2)}`);
  } else {
    console.log(`\n${agent}: ❌ 数据库中找不到记录`);
  }
});

// 计算时间跨度
if (data.length > 0) {
  const firstTime = new Date(data[0].created_at).getTime();
  const lastTime = new Date(data[data.length - 1].created_at).getTime();
  const span = (lastTime - firstTime) / 1000;
  console.log(`\n时间跨度: ${span.toFixed(1)} 秒 (${data[0].created_at.substr(11, 8)} - ${data[data.length - 1].created_at.substr(11, 8)})`);
}
