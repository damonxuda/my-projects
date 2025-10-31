// AWS Lambda Function: LLM Trading Decision Maker
// 用途：定时调用 Gemini API 进行交易决策，并保存到 Supabase
// 触发：CloudWatch Events (每小时一次)

import { createClient } from '@supabase/supabase-js';

// ============================================
// 环境变量配置
// ============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// Lambda Handler
// ============================================
export const handler = async (event) => {
    console.log('🚀 LLM Trading Decision Maker started');
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // 1. 获取市场数据
        const marketData = await fetchMarketData();
        console.log('📊 Market Data:', marketData);

        // 2. 获取当前虚拟账户状态
        const portfolio = await getCurrentPortfolio('gemini');
        console.log('💰 Current Portfolio:', portfolio);

        // 3. 调用 Gemini API 获取决策
        const decision = await askGemini(marketData, portfolio);
        console.log('🤖 Gemini Decision:', decision);

        // 4. 模拟执行交易，更新账户
        const newPortfolio = simulateTrade(portfolio, decision, marketData);
        console.log('💼 New Portfolio:', newPortfolio);

        // 5. 保存决策和账户状态到 Supabase
        await saveDecision('gemini', decision, marketData, newPortfolio.total_value);
        await savePortfolio(newPortfolio);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Trading decision completed',
                decision: decision,
                portfolio: newPortfolio
            })
        };

    } catch (error) {
        console.error('❌ Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

// ============================================
// 1. 获取市场数据（CoinGecko 免费 API）
// ============================================
async function fetchMarketData() {
    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?' +
            'ids=bitcoin,ethereum&' +
            'vs_currencies=usd&' +
            'include_24hr_change=true&' +
            'include_24hr_vol=true&' +
            'include_market_cap=true'
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();

        return {
            BTC: {
                price: data.bitcoin.usd,
                change_24h: data.bitcoin.usd_24h_change,
                volume_24h: data.bitcoin.usd_24h_vol,
                market_cap: data.bitcoin.usd_market_cap
            },
            ETH: {
                price: data.ethereum.usd,
                change_24h: data.ethereum.usd_24h_change,
                volume_24h: data.ethereum.usd_24h_vol,
                market_cap: data.ethereum.usd_market_cap
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Failed to fetch market data:', error);
        throw error;
    }
}

// ============================================
// 2. 获取当前虚拟账户状态
// ============================================
async function getCurrentPortfolio(agentName) {
    try {
        const { data, error } = await supabase
            .from('llm_trading_portfolios')
            .select('*')
            .eq('agent_name', agentName)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            throw error;
        }

        // 如果没有记录，返回初始状态
        if (!data) {
            return {
                agent_name: agentName,
                cash: 10000.00,
                holdings: {},
                total_value: 10000.00,
                pnl: 0.00,
                pnl_percentage: 0.00
            };
        }

        return data;
    } catch (error) {
        console.error('Failed to fetch portfolio:', error);
        throw error;
    }
}

// ============================================
// 3. 调用 Gemini API 获取决策
// ============================================
async function askGemini(marketData, portfolio) {
    const prompt = `你是一个专业的加密货币交易员。请基于以下信息做出交易决策。

【当前市场数据】
BTC价格: $${marketData.BTC.price.toFixed(2)} (24h变化: ${marketData.BTC.change_24h.toFixed(2)}%)
ETH价格: $${marketData.ETH.price.toFixed(2)} (24h变化: ${marketData.ETH.change_24h.toFixed(2)}%)

【你的账户状态】
现金: $${portfolio.cash.toFixed(2)}
持仓: ${JSON.stringify(portfolio.holdings)}
总资产: $${portfolio.total_value.toFixed(2)}
盈亏: ${portfolio.pnl?.toFixed(2) || 0}$ (${portfolio.pnl_percentage?.toFixed(2) || 0}%)

【交易规则】
1. 你只能交易 BTC 和 ETH
2. 单笔交易不超过总资产的 30%
3. 必须保留至少 20% 现金
4. 可以选择：买入、卖出、持有

请返回 JSON 格式的决策（不要包含任何其他文字）：
{
    "action": "buy/sell/hold",
    "asset": "BTC/ETH/null",
    "amount": 数量,
    "reason": "决策理由（中文，1-2句话）"
}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        // 提取 JSON（可能被markdown包裹）
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Gemini response is not valid JSON');
        }

        const decision = JSON.parse(jsonMatch[0]);

        // 验证决策格式
        if (!decision.action || !['buy', 'sell', 'hold'].includes(decision.action)) {
            throw new Error('Invalid decision action');
        }

        return decision;

    } catch (error) {
        console.error('Gemini API failed:', error);
        // 降级：返回保守的 hold 决策
        return {
            action: 'hold',
            asset: null,
            amount: 0,
            reason: 'API调用失败，保持持有'
        };
    }
}

// ============================================
// 4. 模拟交易执行
// ============================================
function simulateTrade(portfolio, decision, marketData) {
    const newPortfolio = JSON.parse(JSON.stringify(portfolio)); // 深拷贝

    if (decision.action === 'hold') {
        // 只更新total_value（根据当前市场价格）
        newPortfolio.total_value = calculateTotalValue(newPortfolio, marketData);
        newPortfolio.pnl = newPortfolio.total_value - 10000;
        newPortfolio.pnl_percentage = (newPortfolio.pnl / 10000) * 100;
        return newPortfolio;
    }

    const asset = decision.asset;
    const amount = decision.amount;
    const price = marketData[asset].price;

    if (decision.action === 'buy') {
        const cost = amount * price;
        if (cost > newPortfolio.cash) {
            console.warn('⚠️ Insufficient cash, adjusting amount');
            // 调整为可买数量
            const adjustedAmount = newPortfolio.cash / price * 0.95; // 留5%余量
            newPortfolio.cash -= adjustedAmount * price;
            newPortfolio.holdings[asset] = (newPortfolio.holdings[asset] || 0) + adjustedAmount;
        } else {
            newPortfolio.cash -= cost;
            newPortfolio.holdings[asset] = (newPortfolio.holdings[asset] || 0) + amount;
        }
    } else if (decision.action === 'sell') {
        const currentHolding = newPortfolio.holdings[asset] || 0;
        if (amount > currentHolding) {
            console.warn('⚠️ Insufficient holdings, selling all');
            newPortfolio.cash += currentHolding * price;
            newPortfolio.holdings[asset] = 0;
        } else {
            newPortfolio.cash += amount * price;
            newPortfolio.holdings[asset] -= amount;
        }
    }

    // 计算新的总价值
    newPortfolio.total_value = calculateTotalValue(newPortfolio, marketData);
    newPortfolio.pnl = newPortfolio.total_value - 10000;
    newPortfolio.pnl_percentage = (newPortfolio.pnl / 10000) * 100;

    return newPortfolio;
}

// 计算总资产价值
function calculateTotalValue(portfolio, marketData) {
    let total = portfolio.cash;

    Object.keys(portfolio.holdings).forEach(asset => {
        const amount = portfolio.holdings[asset];
        const price = marketData[asset]?.price || 0;
        total += amount * price;
    });

    return total;
}

// ============================================
// 5. 保存决策到数据库
// ============================================
async function saveDecision(agentName, decision, marketData, portfolioValue) {
    try {
        const { error } = await supabase
            .from('llm_trading_decisions')
            .insert({
                agent_name: agentName,
                decision: decision,
                market_data: marketData,
                portfolio_value: portfolioValue
            });

        if (error) {
            throw error;
        }

        console.log('✅ Decision saved to database');
    } catch (error) {
        console.error('Failed to save decision:', error);
        throw error;
    }
}

// ============================================
// 6. 保存账户状态到数据库
// ============================================
async function savePortfolio(portfolio) {
    try {
        const { error } = await supabase
            .from('llm_trading_portfolios')
            .insert({
                agent_name: portfolio.agent_name,
                cash: portfolio.cash,
                holdings: portfolio.holdings,
                total_value: portfolio.total_value,
                pnl: portfolio.pnl,
                pnl_percentage: portfolio.pnl_percentage
            });

        if (error) {
            throw error;
        }

        console.log('✅ Portfolio saved to database');
    } catch (error) {
        console.error('Failed to save portfolio:', error);
        throw error;
    }
}
