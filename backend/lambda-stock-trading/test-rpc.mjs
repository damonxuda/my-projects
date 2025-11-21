// 测试RPC函数是否存在
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jggzqhlkzqpfxxsrrhwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZ3pxaGxrenFwZnh4c3JyaHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDU0NDE0NCwiZXhwIjoyMDQ2MTIwMTQ0fQ.K4d0cZRWE3hXVKLhGXiUMhEqLz3XvFBXNfqXlm3-21E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPC() {
    console.log('Testing RPC function: get_stock_portfolio_history_24h');

    const { data, error } = await supabase.rpc('get_stock_portfolio_history_24h');

    if (error) {
        console.error('❌ RPC function error:', error);
        return;
    }

    console.log('✅ RPC function works!');
    console.log(`Found ${data.length} data points`);

    // 显示前5条
    console.log('\nFirst 5 records:');
    data.slice(0, 5).forEach(r => {
        console.log(`- ${r.agent_name}: $${r.total_value} (round ${r.round_number})`);
    });
}

testRPC();
