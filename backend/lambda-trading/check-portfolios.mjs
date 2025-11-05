import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yecdsnqbudbogqpcerqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllY2RzbnFidWRib2dxcGNlcnFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2MzE5MiwiZXhwIjoyMDcwMDM5MTkyfQ.-1PKCac1rN3FgceEYC7iN6VzZexLmXd9m13-sjsOdOY';

const supabase = createClient(supabaseUrl, supabaseKey);

// 查询最近15分钟的所有portfolios
const { data, error } = await supabase
  .from('llm_trading_portfolios')
  .select('agent_name, created_at, total_value')
  .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
  .order('created_at', { ascending: false });

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

// 按agent_name分组
const byAgent = {};
data.forEach(row => {
  if (!byAgent[row.agent_name]) {
    byAgent[row.agent_name] = [];
  }
  byAgent[row.agent_name].push(row);
});

console.log('最近15分钟的数据采样：\n');
Object.keys(byAgent).sort().forEach(agent => {
  const records = byAgent[agent];
  console.log(`${agent}: ${records.length} 条记录`);
  records.forEach((r, i) => {
    const time = new Date(r.created_at).toISOString().substr(11, 8);
    console.log(`  [${i}] ${time} - $${r.total_value.toFixed(2)}`);
  });
});

console.log('\n=== 检查最新采样点 (02:15触发) ===');
const target = '2025-11-05T02:1'; // 02:15-02:16之间
const missing = [];
Object.keys(byAgent).sort().forEach(agent => {
  const hasRecent = byAgent[agent].some(r => r.created_at.startsWith(target));
  if (!hasRecent) {
    missing.push(agent);
    console.log(`❌ ${agent}: 缺少 02:15 采样点`);
  } else {
    const latest = byAgent[agent][0];
    console.log(`✅ ${agent}: ${new Date(latest.created_at).toISOString().substr(11, 8)}`);
  }
});

if (missing.length > 0) {
  console.log(`\n⚠️ 总共 ${missing.length} 个模型缺少最新采样点：`, missing);
}
