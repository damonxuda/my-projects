// AWS Lambda Function: Multi-LLM Trading Decision Maker
// 用途：定时调用多个 LLM API（Gemini, Claude, Grok, OpenAI）进行交易决策，并保存到 Supabase
// 触发：CloudWatch Events (每小时一次)
// 环境变量：GEMINI_API_KEY, CLAUDE_API_KEY, GROK_API_KEY, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

// ============================================
// 环境变量配置
// ============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const GROK_API_KEY = process.env.GROK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 配置要运行的 LLM agents
const AGENTS = [
    { name: 'gemini', enabled: !!GEMINI_API_KEY },
    { name: 'claude', enabled: !!CLAUDE_API_KEY },
    { name: 'grok', enabled: !!GROK_API_KEY },
    { name: 'openai', enabled: !!OPENAI_API_KEY }
].filter(agent => agent.enabled);

// ============================================
// Lambda Handler
// ============================================
export const handler = async (event) => {
    console.log('🚀 Multi-LLM Trading Decision Maker started');
    console.log(`Active agents: ${AGENTS.map(a => a.name).join(', ')}`);
    console.log('Event:', JSON.stringify(event, null, 2));

    const results = [];

    try {
        // 1. 获取市场数据（所有 agents 共享）
        const marketData = await fetchMarketData();
        console.log('📊 Market Data:', marketData);

        // 2. 对每个 agent 执行交易决策
        for (const agent of AGENTS) {
            console.log(`\n========== Processing ${agent.name.toUpperCase()} ==========`);

            try {
                // 2.1 获取当前虚拟账户状态
                const portfolio = await getCurrentPortfolio(agent.name);
                console.log(`💰 ${agent.name} Portfolio:`, portfolio);

                // 2.2 调用 LLM API 获取决策
                const decision = await askLLM(agent.name, marketData, portfolio);
                console.log(`🤖 ${agent.name} Decision:`, decision);

                // 2.3 模拟执行交易，更新账户
                const newPortfolio = simulateTrade(portfolio, decision, marketData);
                console.log(`💼 ${agent.name} New Portfolio:`, newPortfolio);

                // 2.4 保存决策和账户状态到 Supabase
                await saveDecision(agent.name, decision, marketData, newPortfolio.total_value);
                await savePortfolio(newPortfolio);

                results.push({
                    agent: agent.name,
                    success: true,
                    decision: decision,
                    portfolio: newPortfolio
                });

            } catch (agentError) {
                console.error(`❌ ${agent.name} failed:`, agentError);
                results.push({
                    agent: agent.name,
                    success: false,
                    error: agentError.message
                });
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Multi-agent trading decisions completed',
                results: results
            })
        };

    } catch (error) {
        console.error('❌ Fatal Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
                results: results
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
            'ids=bitcoin,ethereum,solana,binancecoin,dogecoin,ripple&' +
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
            SOL: {
                price: data.solana.usd,
                change_24h: data.solana.usd_24h_change,
                volume_24h: data.solana.usd_24h_vol,
                market_cap: data.solana.usd_market_cap
            },
            BNB: {
                price: data.binancecoin.usd,
                change_24h: data.binancecoin.usd_24h_change,
                volume_24h: data.binancecoin.usd_24h_vol,
                market_cap: data.binancecoin.usd_market_cap
            },
            DOGE: {
                price: data.dogecoin.usd,
                change_24h: data.dogecoin.usd_24h_change,
                volume_24h: data.dogecoin.usd_24h_vol,
                market_cap: data.dogecoin.usd_market_cap
            },
            XRP: {
                price: data.ripple.usd,
                change_24h: data.ripple.usd_24h_change,
                volume_24h: data.ripple.usd_24h_vol,
                market_cap: data.ripple.usd_market_cap
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
                cash: 50000.00,
                holdings: {},
                total_value: 50000.00,
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
// 3. LLM API 路由函数
// ============================================
async function askLLM(agentName, marketData, portfolio) {
    switch (agentName) {
        case 'gemini':
            return await askGemini(marketData, portfolio);
        case 'claude':
            return await askClaude(marketData, portfolio);
        case 'grok':
            return await askGrok(marketData, portfolio);
        case 'openai':
            return await askOpenAI(marketData, portfolio);
        default:
            throw new Error(`Unknown agent: ${agentName}`);
    }
}

// ============================================
// 3.1 调用 Gemini API 获取决策
// ============================================
async function askGemini(marketData, portfolio) {
    const prompt = `你是一个专业的加密货币交易员。请基于以下信息做出交易决策。

【当前市场数据】
BTC价格: $${marketData.BTC.price.toFixed(2)} (24h变化: ${marketData.BTC.change_24h.toFixed(2)}%)
ETH价格: $${marketData.ETH.price.toFixed(2)} (24h变化: ${marketData.ETH.change_24h.toFixed(2)}%)
SOL价格: $${marketData.SOL.price.toFixed(2)} (24h变化: ${marketData.SOL.change_24h.toFixed(2)}%)
BNB价格: $${marketData.BNB.price.toFixed(2)} (24h变化: ${marketData.BNB.change_24h.toFixed(2)}%)
DOGE价格: $${marketData.DOGE.price.toFixed(4)} (24h变化: ${marketData.DOGE.change_24h.toFixed(2)}%)
XRP价格: $${marketData.XRP.price.toFixed(4)} (24h变化: ${marketData.XRP.change_24h.toFixed(2)}%)

【你的账户状态】
现金: $${portfolio.cash.toFixed(2)}
持仓: ${JSON.stringify(portfolio.holdings)}
总资产: $${portfolio.total_value.toFixed(2)}
盈亏: ${portfolio.pnl?.toFixed(2) || 0}$ (${portfolio.pnl_percentage?.toFixed(2) || 0}%)

【交易规则】
1. 你只能交易 BTC, ETH, SOL, BNB, DOGE, XRP（对标Alpha Arena比赛币种，现货交易无杠杆）
2. 单笔交易不超过总资产的 30%
3. 单笔交易至少 $10（低于此金额不交易）
4. 必须保留至少 20% 现金
5. 每笔交易收取 0.1% 手续费
6. 可以选择：买入、卖出、持有

请返回 JSON 格式的决策（不要包含任何其他文字）：
{
    "action": "buy/sell/hold",
    "asset": "BTC/ETH/SOL/BNB/DOGE/XRP/null",
    "amount": 数量,
    "reason": "决策理由（中文，1-2句话）"
}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
                        maxOutputTokens: 4000  // 增加token限制以容纳思考tokens（Gemini 2.5可能用1999 tokens思考）
                    }
                })
            }
        );

        const data = await response.json();

        // DEBUG: 打印完整响应
        console.log('Gemini API full response:', JSON.stringify(data, null, 2));

        // 检查API响应
        if (!response.ok) {
            console.error('Gemini API error - status:', response.status);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        // 检查返回数据结构
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Invalid response structure. Available keys:', Object.keys(data));
            throw new Error('Invalid response from Gemini API');
        }

        const text = data.candidates[0].content.parts[0].text;

        // 📊 记录 Token 使用量（用于建立经验值）
        if (data.usageMetadata) {
            console.log('📊 Gemini Token Usage:', {
                prompt: data.usageMetadata.promptTokenCount,
                output: data.usageMetadata.candidatesTokenCount,
                thoughts: data.usageMetadata.thoughtsTokenCount || 0,
                total: data.usageMetadata.totalTokenCount,
                maxAllowed: 4000
            });
        }

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
// 3.2 调用 Claude API 获取决策
// ============================================
async function askClaude(marketData, portfolio) {
    const prompt = `你是一个专业的加密货币交易员。请基于以下信息做出交易决策。

【当前市场数据】
BTC价格: $${marketData.BTC.price.toFixed(2)} (24h变化: ${marketData.BTC.change_24h.toFixed(2)}%)
ETH价格: $${marketData.ETH.price.toFixed(2)} (24h变化: ${marketData.ETH.change_24h.toFixed(2)}%)
SOL价格: $${marketData.SOL.price.toFixed(2)} (24h变化: ${marketData.SOL.change_24h.toFixed(2)}%)
BNB价格: $${marketData.BNB.price.toFixed(2)} (24h变化: ${marketData.BNB.change_24h.toFixed(2)}%)
DOGE价格: $${marketData.DOGE.price.toFixed(4)} (24h变化: ${marketData.DOGE.change_24h.toFixed(2)}%)
XRP价格: $${marketData.XRP.price.toFixed(4)} (24h变化: ${marketData.XRP.change_24h.toFixed(2)}%)

【你的账户状态】
现金: $${portfolio.cash.toFixed(2)}
持仓: ${JSON.stringify(portfolio.holdings)}
总资产: $${portfolio.total_value.toFixed(2)}
盈亏: ${portfolio.pnl?.toFixed(2) || 0}$ (${portfolio.pnl_percentage?.toFixed(2) || 0}%)

【交易规则】
1. 你只能交易 BTC, ETH, SOL, BNB, DOGE, XRP（对标Alpha Arena比赛币种，现货交易无杠杆）
2. 单笔交易不超过总资产的 30%
3. 单笔交易至少 $10（低于此金额不交易）
4. 必须保留至少 20% 现金
5. 每笔交易收取 0.1% 手续费
6. 可以选择：买入、卖出、持有

请返回 JSON 格式的决策（不要包含任何其他文字）：
{
    "action": "buy/sell/hold",
    "asset": "BTC/ETH/SOL/BNB/DOGE/XRP/null",
    "amount": 数量,
    "reason": "决策理由（中文，1-2句话）"
}`;

    try {
        const response = await fetch(
            'https://api.anthropic.com/v1/messages',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5',
                    max_tokens: 2000,
                    temperature: 0.7,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            }
        );

        const data = await response.json();

        // DEBUG: 打印完整响应
        console.log('Claude API full response:', JSON.stringify(data, null, 2));

        // 检查API响应
        if (!response.ok) {
            console.error('Claude API error - status:', response.status);
            console.error('Claude API error details:', data);
            throw new Error(`Claude API error: ${response.status}`);
        }

        // 检查返回数据结构
        if (!data.content || !data.content[0] || !data.content[0].text) {
            console.error('Invalid response structure. Available keys:', Object.keys(data));
            throw new Error('Invalid response from Claude API');
        }

        const text = data.content[0].text;

        // 📊 记录 Token 使用量（用于建立经验值）
        if (data.usage) {
            console.log('📊 Claude Token Usage:', {
                input: data.usage.input_tokens,
                output: data.usage.output_tokens,
                total: data.usage.input_tokens + data.usage.output_tokens,
                maxAllowed: 2000
            });
        }

        // 提取 JSON（可能被markdown包裹）
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Claude response is not valid JSON');
        }

        const decision = JSON.parse(jsonMatch[0]);

        // 验证决策格式
        if (!decision.action || !['buy', 'sell', 'hold'].includes(decision.action)) {
            throw new Error('Invalid decision action');
        }

        return decision;

    } catch (error) {
        console.error('Claude API failed:', error);
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
// 3.3 调用 Grok API 获取决策
// ============================================
async function askGrok(marketData, portfolio) {
    const prompt = `你是一个专业的加密货币交易员。请基于以下信息做出交易决策。

【当前市场数据】
BTC价格: $${marketData.BTC.price.toFixed(2)} (24h变化: ${marketData.BTC.change_24h.toFixed(2)}%)
ETH价格: $${marketData.ETH.price.toFixed(2)} (24h变化: ${marketData.ETH.change_24h.toFixed(2)}%)
SOL价格: $${marketData.SOL.price.toFixed(2)} (24h变化: ${marketData.SOL.change_24h.toFixed(2)}%)
BNB价格: $${marketData.BNB.price.toFixed(2)} (24h变化: ${marketData.BNB.change_24h.toFixed(2)}%)
DOGE价格: $${marketData.DOGE.price.toFixed(4)} (24h变化: ${marketData.DOGE.change_24h.toFixed(2)}%)
XRP价格: $${marketData.XRP.price.toFixed(4)} (24h变化: ${marketData.XRP.change_24h.toFixed(2)}%)

【你的账户状态】
现金: $${portfolio.cash.toFixed(2)}
持仓: ${JSON.stringify(portfolio.holdings)}
总资产: $${portfolio.total_value.toFixed(2)}
盈亏: ${portfolio.pnl?.toFixed(2) || 0}$ (${portfolio.pnl_percentage?.toFixed(2) || 0}%)

【交易规则】
1. 你只能交易 BTC, ETH, SOL, BNB, DOGE, XRP（对标Alpha Arena比赛币种，现货交易无杠杆）
2. 单笔交易不超过总资产的 30%
3. 单笔交易至少 $10（低于此金额不交易）
4. 必须保留至少 20% 现金
5. 每笔交易收取 0.1% 手续费
6. 可以选择：买入、卖出、持有

请返回 JSON 格式的决策（不要包含任何其他文字）：
{
    "action": "buy/sell/hold",
    "asset": "BTC/ETH/SOL/BNB/DOGE/XRP/null",
    "amount": 数量,
    "reason": "决策理由（中文，1-2句话）"
}`;

    try {
        const response = await fetch(
            'https://api.x.ai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'grok-3-mini',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            }
        );

        const data = await response.json();

        // DEBUG: 打印完整响应
        console.log('Grok API full response:', JSON.stringify(data, null, 2));

        // 检查API响应
        if (!response.ok) {
            console.error('Grok API error - status:', response.status);
            console.error('Grok API error details:', data);
            throw new Error(`Grok API error: ${response.status}`);
        }

        // 检查返回数据结构
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Invalid response structure. Available keys:', Object.keys(data));
            throw new Error('Invalid response from Grok API');
        }

        const text = data.choices[0].message.content;

        // 📊 记录 Token 使用量（用于建立经验值）
        if (data.usage) {
            console.log('📊 Grok Token Usage:', {
                prompt: data.usage.prompt_tokens,
                completion: data.usage.completion_tokens,
                total: data.usage.total_tokens,
                maxAllowed: 2000
            });
        }

        // 提取 JSON（可能被markdown包裹）
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Grok response is not valid JSON');
        }

        const decision = JSON.parse(jsonMatch[0]);

        // 验证决策格式
        if (!decision.action || !['buy', 'sell', 'hold'].includes(decision.action)) {
            throw new Error('Invalid decision action');
        }

        return decision;

    } catch (error) {
        console.error('Grok API failed:', error);
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
// 3.4 调用 OpenAI API 获取决策
// ============================================
async function askOpenAI(marketData, portfolio) {
    const prompt = `你是一个专业的加密货币交易员。请基于以下信息做出交易决策。

【当前市场数据】
BTC价格: $${marketData.BTC.price.toFixed(2)} (24h变化: ${marketData.BTC.change_24h.toFixed(2)}%)
ETH价格: $${marketData.ETH.price.toFixed(2)} (24h变化: ${marketData.ETH.change_24h.toFixed(2)}%)
SOL价格: $${marketData.SOL.price.toFixed(2)} (24h变化: ${marketData.SOL.change_24h.toFixed(2)}%)
BNB价格: $${marketData.BNB.price.toFixed(2)} (24h变化: ${marketData.BNB.change_24h.toFixed(2)}%)
DOGE价格: $${marketData.DOGE.price.toFixed(4)} (24h变化: ${marketData.DOGE.change_24h.toFixed(2)}%)
XRP价格: $${marketData.XRP.price.toFixed(4)} (24h变化: ${marketData.XRP.change_24h.toFixed(2)}%)

【你的账户状态】
现金: $${portfolio.cash.toFixed(2)}
持仓: ${JSON.stringify(portfolio.holdings)}
总资产: $${portfolio.total_value.toFixed(2)}
盈亏: ${portfolio.pnl?.toFixed(2) || 0}$ (${portfolio.pnl_percentage?.toFixed(2) || 0}%)

【交易规则】
1. 你只能交易 BTC, ETH, SOL, BNB, DOGE, XRP（对标Alpha Arena比赛币种，现货交易无杠杆）
2. 单笔交易不超过总资产的 30%
3. 单笔交易至少 $10（低于此金额不交易）
4. 必须保留至少 20% 现金
5. 每笔交易收取 0.1% 手续费
6. 可以选择：买入、卖出、持有

请返回 JSON 格式的决策（不要包含任何其他文字）：
{
    "action": "buy/sell/hold",
    "asset": "BTC/ETH/SOL/BNB/DOGE/XRP/null",
    "amount": 数量,
    "reason": "决策理由（中文，1-2句话）"
}`;

    try {
        const response = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            }
        );

        const data = await response.json();

        // DEBUG: 打印完整响应
        console.log('OpenAI API full response:', JSON.stringify(data, null, 2));

        // 检查API响应
        if (!response.ok) {
            console.error('OpenAI API error - status:', response.status);
            console.error('OpenAI API error details:', data);
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        // 检查返回数据结构
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Invalid response structure. Available keys:', Object.keys(data));
            throw new Error('Invalid response from OpenAI API');
        }

        const text = data.choices[0].message.content;

        // 📊 记录 Token 使用量（用于建立经验值）
        if (data.usage) {
            console.log('📊 OpenAI Token Usage:', {
                prompt: data.usage.prompt_tokens,
                completion: data.usage.completion_tokens,
                total: data.usage.total_tokens,
                maxAllowed: 2000
            });
        }

        // 提取 JSON（可能被markdown包裹）
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('OpenAI response is not valid JSON');
        }

        const decision = JSON.parse(jsonMatch[0]);

        // 验证决策格式
        if (!decision.action || !['buy', 'sell', 'hold'].includes(decision.action)) {
            throw new Error('Invalid decision action');
        }

        return decision;

    } catch (error) {
        console.error('OpenAI API failed:', error);
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
    const TRADING_FEE_RATE = 0.001; // 0.1% 手续费（对标 Binance）
    const MIN_TRADE_VALUE = 10; // 最小交易金额 $10（对标交易所门槛）

    const newPortfolio = JSON.parse(JSON.stringify(portfolio)); // 深拷贝

    if (decision.action === 'hold') {
        // 只更新total_value（根据当前市场价格）
        newPortfolio.total_value = calculateTotalValue(newPortfolio, marketData);
        newPortfolio.pnl = newPortfolio.total_value - 50000;
        newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;
        return newPortfolio;
    }

    const asset = decision.asset;
    const amount = decision.amount;
    const price = marketData[asset].price;
    const tradeValue = amount * price;

    // 检查最小交易金额门槛
    if (tradeValue < MIN_TRADE_VALUE) {
        console.warn(`⚠️ Trade value $${tradeValue.toFixed(2)} below minimum $${MIN_TRADE_VALUE}, converting to HOLD`);
        // 转为持有，只更新总价值
        newPortfolio.total_value = calculateTotalValue(newPortfolio, marketData);
        newPortfolio.pnl = newPortfolio.total_value - 50000;
        newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;
        return newPortfolio;
    }

    if (decision.action === 'buy') {
        const cost = amount * price;
        const fee = cost * TRADING_FEE_RATE;
        const totalCost = cost + fee;

        if (totalCost > newPortfolio.cash) {
            console.warn('⚠️ Insufficient cash, adjusting amount');
            // 调整为可买数量（扣除手续费后）
            const adjustedAmount = (newPortfolio.cash / (price * (1 + TRADING_FEE_RATE))) * 0.95; // 留5%余量
            const adjustedCost = adjustedAmount * price;
            const adjustedFee = adjustedCost * TRADING_FEE_RATE;
            newPortfolio.cash -= (adjustedCost + adjustedFee);
            newPortfolio.holdings[asset] = (newPortfolio.holdings[asset] || 0) + adjustedAmount;
            console.log(`💰 Buy adjusted: ${adjustedAmount.toFixed(6)} ${asset}, cost $${adjustedCost.toFixed(2)}, fee $${adjustedFee.toFixed(2)}`);
        } else {
            newPortfolio.cash -= totalCost;
            newPortfolio.holdings[asset] = (newPortfolio.holdings[asset] || 0) + amount;
            console.log(`💰 Buy: ${amount.toFixed(6)} ${asset}, cost $${cost.toFixed(2)}, fee $${fee.toFixed(2)}`);
        }
    } else if (decision.action === 'sell') {
        const currentHolding = newPortfolio.holdings[asset] || 0;
        const revenue = amount * price;
        const fee = revenue * TRADING_FEE_RATE;
        const netRevenue = revenue - fee;

        if (amount > currentHolding) {
            console.warn('⚠️ Insufficient holdings, selling all');
            const actualRevenue = currentHolding * price;
            const actualFee = actualRevenue * TRADING_FEE_RATE;
            newPortfolio.cash += (actualRevenue - actualFee);
            newPortfolio.holdings[asset] = 0;
            console.log(`💰 Sell all: ${currentHolding.toFixed(6)} ${asset}, revenue $${actualRevenue.toFixed(2)}, fee $${actualFee.toFixed(2)}`);
        } else {
            newPortfolio.cash += netRevenue;
            newPortfolio.holdings[asset] -= amount;
            console.log(`💰 Sell: ${amount.toFixed(6)} ${asset}, revenue $${revenue.toFixed(2)}, fee $${fee.toFixed(2)}`);
        }
    }

    // 计算新的总价值
    newPortfolio.total_value = calculateTotalValue(newPortfolio, marketData);
    newPortfolio.pnl = newPortfolio.total_value - 50000;
    newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;

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
