import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yecdsnqbudbogqpcerqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllY2RzbnFidWRib2dxcGNlcnFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2MzE5MiwiZXhwIjoyMDcwMDM5MTkyfQ.-1PKCac1rN3FgceEYC7iN6VzZexLmXd9m13-sjsOdOY';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('查询这3个模型最近两轮的数据\n');

const models = ['gemini_pro', 'claude_standard', 'gemini_flash'];

for (const model of models) {
  console.log(`=== ${model} ===`);

  const { data, error } = await supabase
    .from('llm_trading_portfolios')
    .select('agent_name, total_value, created_at')
    .eq('agent_name', model)
    .order('created_at', { ascending: false })
    .limit(2);

  if (error) {
    console.error('Error:', error);
    continue;
  }

  if (data && data.length >= 2) {
    const latest = data[0];
    const previous = data[1];

    console.log(`  最新一轮: ${latest.created_at.substr(0, 19)} = $${parseFloat(latest.total_value).toFixed(2)}`);
    console.log(`  上一轮:   ${previous.created_at.substr(0, 19)} = $${parseFloat(previous.total_value).toFixed(2)}`);

    const diff = parseFloat(latest.total_value) - parseFloat(previous.total_value);
    const direction = diff > 0 ? '📈 增加' : '📉 减少';
    console.log(`  变化: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} (${direction})`);
  } else if (data && data.length === 1) {
    console.log(`  只有1条记录: ${data[0].created_at.substr(0, 19)} = $${parseFloat(data[0].total_value).toFixed(2)}`);
  } else {
    console.log('  未找到数据');
  }

  console.log('');
}
