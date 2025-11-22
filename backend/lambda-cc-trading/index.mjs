// AWS Lambda Function: Multi-LLM Trading Decision Maker
// 用途：定时调用多个 LLM API（Gemini, Claude, Grok, OpenAI）进行交易决策，并保存到 Supabase
// 触发：CloudWatch Events (每小时一次)
// 环境变量：GEMINI_PRO_API_KEY, GEMINI_FLASH_API_KEY, CLAUDE_SONNET_API_KEY, CLAUDE_HAIKU_API_KEY, GROK_API_KEY, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

// ============================================
// 从 Lambda Layer 导入共享模块
// ============================================
import {
    callOpenAI,
    callGemini,
    callClaude,
    callGrok,
    callDeepSeekBedrock,
    callQwen3Bedrock
} from '/opt/nodejs/llm-clients.mjs';
import { parseAndValidateDecision as parseAndValidateDecisionFromLayer } from '/opt/nodejs/decision-parser.mjs';
import { calculateAllIndicators } from '/opt/nodejs/technical-indicators.mjs';
import {
    getCurrentPortfolio,
    deductDailyManagementFees,
    checkAndReinvestDividends,
    simulateTrade,
    calculateTotalValue,
    savePortfolio
} from '/opt/nodejs/portfolio-management.mjs';

// ============================================
// 从 Lambda Layer 导入依赖包
// ============================================
import { createClient } from '@supabase/supabase-js';
import YahooFinanceClass from 'yahoo-finance2';

// v3版本需要实例化
const yahooFinance = new YahooFinanceClass();

// ============================================
// 环境变量配置
// ============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_PRO_API_KEY = process.env.GEMINI_PRO_API_KEY;  // 代理商API Key for Gemini Pro
const GEMINI_FLASH_API_KEY = process.env.GEMINI_FLASH_API_KEY;  // 代理商API Key for Gemini Flash
const CLAUDE_SONNET_API_KEY = process.env.CLAUDE_SONNET_API_KEY;  // 代理商API Key for Sonnet 4.5 thinking
const CLAUDE_HAIKU_API_KEY = process.env.CLAUDE_HAIKU_API_KEY;    // 代理商API Key for Haiku 4.5
const GROK_API_KEY = process.env.GROK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY;  // CryptoCompare News API
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;  // CoinGecko Demo API Key
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// LLM Agent 配置
// ============================================

/**
 * 所有 LLM Agent 的配置
 * 每个 agent 包含：
 * - llmClient: LLM 客户端函数（来自 llm-clients.mjs）
 * - llmOptions: LLM 调用选项（model, temperature, maxTokens, baseURL 等）
 * - displayName: 用于日志显示的名称
 */
const AGENT_CONFIGS = {
    // OpenAI (2个)
    openai_standard: {
        llmClient: callOpenAI,
        llmOptions: {
            model: 'gpt-4.1',
            temperature: 0.7,
            maxTokens: 2000,
            timeout: 120000,
            maxRetries: 2
        },
        displayName: 'GPT-4.1'
    },
    openai_mini: {
        llmClient: callOpenAI,
        llmOptions: {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 2000,
            timeout: 60000,
            maxRetries: 1
        },
        displayName: 'GPT-4o mini'
    },

    // Gemini (2个) - 通过 gptsapi.net 代理，使用 OpenAI 兼容接口
    gemini_pro: {
        llmClient: callOpenAI,  // gptsapi.net 使用 OpenAI 格式
        llmOptions: {
            baseURL: 'https://api.gptsapi.net/v1',
            model: 'gemini-2.5-pro',
            temperature: 0.7,
            maxTokens: 8000,
            timeout: 120000,
            maxRetries: 1
        },
        displayName: 'Gemini 2.5 Pro'
    },
    gemini_flash: {
        llmClient: callOpenAI,  // gptsapi.net 使用 OpenAI 格式
        llmOptions: {
            baseURL: 'https://api.gptsapi.net/v1',
            model: 'gemini-2.5-flash',
            temperature: 0.7,
            maxTokens: 8000,
            timeout: 60000,
            maxRetries: 1
        },
        displayName: 'Gemini 2.5 Flash'
    },

    // Claude (2个) - 通过 gptsapi.net 代理
    claude_standard: {
        llmClient: callClaude,
        llmOptions: {
            baseURL: 'https://api.gptsapi.net/v1',
            model: 'claude-sonnet-4-5-20250929',
            temperature: 0.7,
            maxTokens: 2000,
            timeout: 120000,
            maxRetries: 2
        },
        displayName: 'Sonnet 4.5'
    },
    claude_mini: {
        llmClient: callClaude,
        llmOptions: {
            baseURL: 'https://api.gptsapi.net/v1',
            model: 'claude-haiku-4-5-20251001',
            temperature: 0.7,
            maxTokens: 2000,
            timeout: 60000,
            maxRetries: 1
        },
        displayName: 'Haiku 4.5'
    },

    // Grok (2个)
    grok_standard: {
        llmClient: callGrok,
        llmOptions: {
            model: 'grok-4-fast-reasoning',
            temperature: 0.7,
            maxTokens: 2000,
            timeout: 120000,
            maxRetries: 2
        },
        displayName: 'Grok 4 Fast Reasoning'
    },
    grok_mini: {
        llmClient: callGrok,
        llmOptions: {
            model: 'grok-4-fast-non-reasoning',
            temperature: 0.7,
            maxTokens: 2000,
            timeout: 60000,
            maxRetries: 1
        },
        displayName: 'Grok 4 Fast'
    },

    // DeepSeek (1个) - AWS Bedrock
    deepseek: {
        llmClient: callDeepSeekBedrock,
        llmOptions: {
            model: 'deepseek.v3-v1:0',
            temperature: 0.7,
            maxTokens: 4000,
            timeout: 60000
        },
        displayName: 'DeepSeek'
    },

    // Qwen (1个) - AWS Bedrock
    qwen3_235b: {
        llmClient: callQwen3Bedrock,
        llmOptions: {
            model: 'qwen.qwen3-235b-a22b-2507-v1:0',
            temperature: 0.7,
            maxTokens: 4000,
            timeout: 60000
        },
        displayName: 'Qwen3 235B'
    }
};

// API Keys 映射
const API_KEYS = {
    openai_standard: OPENAI_API_KEY,
    openai_mini: OPENAI_API_KEY,
    gemini_pro: GEMINI_PRO_API_KEY,
    gemini_flash: GEMINI_FLASH_API_KEY,
    claude_standard: CLAUDE_SONNET_API_KEY,
    claude_mini: CLAUDE_HAIKU_API_KEY,
    grok_standard: GROK_API_KEY,
    grok_mini: GROK_API_KEY,
    deepseek: null,      // AWS Bedrock 不需要 API Key
    qwen3_235b: null     // AWS Bedrock 不需要 API Key
};

// 可交易资产列表（严格限制）
const AVAILABLE_ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];

// 配置要运行的 LLM agents + 基准策略
// 新架构：每家厂商2个模型（标准型 + 轻量级）+ 2个ETF基准
const AGENTS = [
    // OpenAI (2个)
    { name: 'openai_standard', type: 'llm', enabled: !!OPENAI_API_KEY },  // GPT-4o
    { name: 'openai_mini', type: 'llm', enabled: !!OPENAI_API_KEY },      // GPT-4o mini

    // Gemini (2个)
    { name: 'gemini_flash', type: 'llm', enabled: !!GEMINI_FLASH_API_KEY },  // Gemini 2.5 Flash (代理商API)
    { name: 'gemini_pro', type: 'llm', enabled: !!GEMINI_PRO_API_KEY },      // Gemini 2.5 Pro (代理商API)

    // Claude (2个)
    { name: 'claude_standard', type: 'llm', enabled: !!CLAUDE_SONNET_API_KEY },  // Sonnet 4.5 thinking
    { name: 'claude_mini', type: 'llm', enabled: !!CLAUDE_HAIKU_API_KEY },       // Haiku 4.5

    // Grok (2个)
    { name: 'grok_standard', type: 'llm', enabled: !!GROK_API_KEY },      // Grok 2
    { name: 'grok_mini', type: 'llm', enabled: !!GROK_API_KEY },          // Grok 2 mini

    // DeepSeek - DISABLED (性能差，经常超时)
    // { name: 'deepseek', type: 'llm', enabled: true },                     // DeepSeek (AWS Bedrock)

    // Qwen (1个)
    { name: 'qwen3_235b', type: 'llm', enabled: true },                   // Qwen3 235B A22B (AWS Bedrock)

    // ETF基准 (2个)
    { name: 'gdlc', type: 'benchmark', enabled: true },                   // GDLC市值加权ETF基准
    { name: 'equal_weight', type: 'benchmark', enabled: true }            // BITW等权重ETF基准
].filter(agent => agent.enabled);

// ============================================
// LLM Agent 执行函数
// ============================================

/**
 * 执行 LLM Agent 决策
 *
 * @param {string} agentName - Agent 名称（如 'openai_standard', 'claude_mini'）
 * @param {Function} promptBuilder - Prompt 构建函数（返回 string）
 * @param {Object} apiKeys - API Key 映射对象 { agentName: apiKey }
 * @returns {Promise<{decision: Object, usage: Object|null}>}
 */
async function executeAgent(agentName, promptBuilder, apiKeys) {
    // 1. 获取 Agent 配置
    const config = AGENT_CONFIGS[agentName];
    if (!config) {
        throw new Error(`Unknown agent: ${agentName}`);
    }

    const { llmClient, llmOptions, displayName } = config;

    try {
        // 2. 构建 Prompt（由 Lambda 提供，业务逻辑）
        const prompt = promptBuilder();

        // 3. 调用 LLM（添加 API Key）
        const apiKey = apiKeys[agentName];
        const options = { ...llmOptions, apiKey };

        const result = await llmClient(prompt, options);

        // 4. 记录 Token 使用量
        if (result.usage) {
            console.log(`📊 ${displayName} Token Usage:`, result.usage);
        }

        // 5. 解析并验证决策（强制限制可交易资产）
        const decision = parseAndValidateDecisionFromLayer(result.text, {
            modelName: displayName,
            availableAssets: AVAILABLE_ASSETS,  // 严格限制：BTC, ETH, SOL, BNB, DOGE, XRP
            allowHold: true,
            requireAmount: true  // 必须提供正数amount
        });

        return {
            decision,
            usage: result.usage
        };

    } catch (error) {
        console.error(`[${displayName}] API call failed:`, error);

        // 错误 fallback：返回 HOLD 决策
        const errorMsg = error?.message || String(error) || '未知错误';
        return {
            decision: {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: `API调用失败（${errorMsg}），保持持有`
            },
            usage: null
        };
    }
}

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

        // 1.5 获取全局市场数据（所有 agents 共享）
        console.log('🌍 Fetching global market data...');
        const globalMarketData = await fetchGlobalMarketData();

        // 1.1 获取历史OHLC数据和技术指标（所有 agents 共享）
        console.log('📈 Fetching historical OHLC data...');
        const historicalData = await fetchHistoricalOHLC();

        // 1.2 计算每个币种的技术指标
        const technicalIndicators = {};
        for (const [symbol, ohlc] of Object.entries(historicalData)) {
            const indicators = calculateTechnicalIndicators(ohlc);
            if (indicators) {
                technicalIndicators[symbol] = indicators;
                console.log(`📊 ${symbol} indicators calculated:`, indicators);
            } else {
                console.warn(`⚠️ ${symbol} insufficient data for indicators`);
            }
        }

        // 1.3 获取加密货币新闻（所有 agents 共享）
        console.log('📰 Fetching crypto news...');
        const newsData = await fetchCryptoNews();

        // 2. 并发执行所有 agent 的交易决策（性能提升3-5倍）
        console.log(`\n🚀 开始并发处理 ${AGENTS.length} 个agents...`);
        const agentResults = await Promise.all(
            AGENTS.map(agent => processSingleAgent(agent, marketData, globalMarketData, historicalData, technicalIndicators, newsData))
        );

        // 整理结果
        results.push(...agentResults);

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
// 处理单个Agent（用于并发执行）
// ============================================
async function processSingleAgent(agent, marketData, globalMarketData, historicalData, technicalIndicators, newsData) {
    console.log(`\n========== Processing ${agent.name.toUpperCase()} ==========`);

    try {
        // 1. 获取当前虚拟账户状态
        const portfolio = await getCurrentPortfolio(agent.name, supabase);
        console.log(`💰 ${agent.name} Portfolio:`, portfolio);

        // 1.5 扣除ETF每日管理费（如果持有GDLC或BITW）
        const feeResult = await deductDailyManagementFees(portfolio);
        if (feeResult.totalFeesDeducted > 0) {
            console.log(`💳 ${agent.name} 管理费扣除: 共 -$${feeResult.totalFeesDeducted.toFixed(2)}`);
        }

        // 2. 获取决策（LLM或基准策略）
        let decision;
        if (agent.type === 'benchmark') {
            decision = await getBenchmarkDecision(agent.name, marketData, portfolio);
            console.log(`📊 ${agent.name} Benchmark Decision:`, decision);
        } else {
            decision = await askLLM(agent.name, marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);
            console.log(`🤖 ${agent.name} Decision:`, decision);
        }

        // 3. 模拟执行交易，更新账户
        let newPortfolio;
        if (decision && decision.actions) {
            // 多笔交易：按顺序执行
            console.log(`🔄 Executing ${decision.actions.length} trades...`);
            newPortfolio = JSON.parse(JSON.stringify(portfolio)); // 深拷贝

            // 先执行所有卖出操作（释放现金）
            const sellTrades = decision.actions.filter(t => t.action === 'sell');
            for (const trade of sellTrades) {
                console.log(`  🔸 Sell: ${trade.amount} ${trade.asset} - ${trade.reason}`);
                newPortfolio = await simulateTrade(newPortfolio, trade, marketData);
            }

            // 再执行所有买入操作（使用现金）
            const buyTrades = decision.actions.filter(t => t.action === 'buy');
            for (const trade of buyTrades) {
                console.log(`  🔹 Buy: ${trade.amount} ${trade.asset} - ${trade.reason}`);
                newPortfolio = await simulateTrade(newPortfolio, trade, marketData);
            }

            if (decision.overall_reason) {
                console.log(`📝 Overall Strategy: ${decision.overall_reason}`);
            }
        } else {
            // 单笔交易或持有
            newPortfolio = await simulateTrade(portfolio, decision, marketData);
        }
        console.log(`💼 ${agent.name} New Portfolio:`, newPortfolio);

        // 4. 保存决策和账户状态到 Supabase
        if (decision !== null) {
            await saveDecision(agent.name, decision, marketData, globalMarketData, newPortfolio.total_value);
        } else {
            console.log(`📊 ${agent.name} Buy & Hold策略：无需记录决策，仅更新portfolio`);
        }
        await savePortfolio(newPortfolio, supabase);

        return {
            agent: agent.name,
            success: true,
            decision: decision,
            portfolio: newPortfolio
        };

    } catch (agentError) {
        console.error(`❌ ${agent.name} failed:`, agentError);

        // 兜底方案：无论什么原因失败（超时、崩溃、API错误），都要保存一个降级的portfolio
        try {
            console.log(`🛡️ ${agent.name} 启动降级保护：保存HOLD状态的portfolio`);

            // 获取最后成功的portfolio
            const lastPortfolio = await getCurrentPortfolio(agent.name, supabase);
            console.log(`📊 ${agent.name} 使用上次portfolio作为基准`);

            // 创建降级portfolio：保持holdings不变，只更新total_value
            const fallbackPortfolio = JSON.parse(JSON.stringify(lastPortfolio));
            fallbackPortfolio.total_value = await calculateTotalValue(fallbackPortfolio, marketData);
            fallbackPortfolio.pnl = fallbackPortfolio.total_value - 50000;
            fallbackPortfolio.pnl_percentage = (fallbackPortfolio.pnl / 50000) * 100;
            fallbackPortfolio.timestamp = new Date().toISOString();
            fallbackPortfolio.created_at = new Date().toISOString();

            console.log(`💼 ${agent.name} Fallback Portfolio (HOLD):`, {
                cash: fallbackPortfolio.cash,
                total_value: fallbackPortfolio.total_value,
                pnl: fallbackPortfolio.pnl,
                pnl_percentage: fallbackPortfolio.pnl_percentage
            });

            // 保存降级portfolio
            await savePortfolio(fallbackPortfolio, supabase);
            console.log(`✅ ${agent.name} 降级portfolio已保存`);

            return {
                agent: agent.name,
                success: false,
                error: agentError.message,
                fallback: true,
                portfolio: fallbackPortfolio
            };
        } catch (fallbackError) {
            console.error(`❌ ${agent.name} 降级保护也失败了:`, fallbackError);
            return {
                agent: agent.name,
                success: false,
                error: agentError.message,
                fallback_error: fallbackError.message
            };
        }
    }
}

// ============================================
// 1. 获取市场数据（同时使用 /simple/price 和 /coins/markets）
// ============================================
async function fetchMarketData() {
    try {
        console.log(`🔑 COINGECKO_API_KEY: ${COINGECKO_API_KEY ? 'SET (len=' + COINGECKO_API_KEY.length + ')' : 'NOT SET'}`);

        const coinMap = {
            'bitcoin': 'BTC',
            'ethereum': 'ETH',
            'solana': 'SOL',
            'binancecoin': 'BNB',
            'dogecoin': 'DOGE',
            'ripple': 'XRP'
        };

        // 1️⃣ 调用 /simple/price 获取最新实时价格
        console.log('📍 Fetching latest prices from /simple/price...');
        const priceResponse = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?' +
            'ids=bitcoin,ethereum,solana,binancecoin,dogecoin,ripple&' +
            'vs_currencies=usd&' +
            'include_market_cap=true&' +
            'include_24hr_vol=true&' +
            'include_24hr_change=true&' +
            'include_last_updated_at=true',
            {
                headers: {
                    'x-cg-demo-api-key': COINGECKO_API_KEY
                }
            }
        );

        if (!priceResponse.ok) {
            throw new Error(`CoinGecko /simple/price error: ${priceResponse.status}`);
        }

        const priceData = await priceResponse.json();
        console.log('✅ Latest prices fetched from /simple/price');

        // 2️⃣ 调用 /coins/markets 获取完整市场数据（ATH/ATL、供应量等）
        console.log('📊 Fetching market data from /coins/markets...');
        const marketsResponse = await fetch(
            'https://api.coingecko.com/api/v3/coins/markets?' +
            'vs_currency=usd&' +
            'ids=bitcoin,ethereum,solana,binancecoin,dogecoin,ripple&' +
            'order=market_cap_desc&' +
            'sparkline=false&' +
            'price_change_percentage=24h,7d',
            {
                headers: {
                    'x-cg-demo-api-key': COINGECKO_API_KEY
                }
            }
        );

        if (!marketsResponse.ok) {
            throw new Error(`CoinGecko /coins/markets error: ${marketsResponse.status}`);
        }

        const marketsData = await marketsResponse.json();
        console.log('✅ Market data fetched from /coins/markets');

        // 3️⃣ 合并两个API的数据
        const marketData = {};

        for (const coin of marketsData) {
            const symbol = coinMap[coin.id];
            if (!symbol) continue;

            const simplePriceData = priceData[coin.id];

            marketData[symbol] = {
                // 使用 /simple/price 的最新价格（更实时）
                price: simplePriceData?.usd || coin.current_price,
                change_24h: simplePriceData?.usd_24h_change || coin.price_change_percentage_24h,
                volume_24h: simplePriceData?.usd_24h_vol || coin.total_volume,
                market_cap: simplePriceData?.usd_market_cap || coin.market_cap,
                last_updated: simplePriceData?.last_updated_at ? new Date(simplePriceData.last_updated_at * 1000).toISOString() : null,

                // 使用 /coins/markets 的扩展数据
                market_cap_rank: coin.market_cap_rank,
                fully_diluted_valuation: coin.fully_diluted_valuation,
                high_24h: coin.high_24h,
                low_24h: coin.low_24h,
                ath: coin.ath,
                ath_change_percentage: coin.ath_change_percentage,
                ath_date: coin.ath_date,
                atl: coin.atl,
                atl_change_percentage: coin.atl_change_percentage,
                atl_date: coin.atl_date,
                circulating_supply: coin.circulating_supply,
                total_supply: coin.total_supply,
                max_supply: coin.max_supply,
                price_change_percentage_7d: coin.price_change_percentage_7d_in_currency || null
            };
        }

        marketData.timestamp = new Date().toISOString();

        console.log('📊 Market data merged: /simple/price (latest) + /coins/markets (extended)');
        return marketData;

    } catch (error) {
        console.error('Failed to fetch market data:', error);
        throw error;
    }
}

// ============================================
// 1.5 获取全局市场数据（BTC主导地位、总市值等宏观指标）
// ============================================
async function fetchGlobalMarketData() {
    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/global',
            {
                headers: {
                    'x-cg-demo-api-key': COINGECKO_API_KEY
                }
            }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko Global API error: ${response.status}`);
        }

        const result = await response.json();
        const data = result.data;

        const globalData = {
            // 总市值和交易量
            total_market_cap_usd: data.total_market_cap?.usd || 0,
            total_volume_24h_usd: data.total_volume?.usd || 0,
            market_cap_change_percentage_24h: data.market_cap_change_percentage_24h_usd || 0,

            // 市场主导地位
            btc_dominance: data.market_cap_percentage?.btc || 0,
            eth_dominance: data.market_cap_percentage?.eth || 0,

            // 活跃市场统计
            active_cryptocurrencies: data.active_cryptocurrencies || 0,
            markets: data.markets || 0,

            // 市场情绪（涨跌币种比例）
            market_cap_percentage: data.market_cap_percentage || {},

            timestamp: new Date().toISOString()
        };

        console.log(`🌍 Global market data: Total MC $${(globalData.total_market_cap_usd / 1e12).toFixed(2)}T, BTC dominance ${globalData.btc_dominance.toFixed(2)}%`);
        return globalData;

    } catch (error) {
        console.error('Failed to fetch global market data:', error);
        // 全局数据获取失败不影响主流程，返回空对象
        return {
            total_market_cap_usd: 0,
            total_volume_24h_usd: 0,
            market_cap_change_percentage_24h: 0,
            btc_dominance: 0,
            eth_dominance: 0,
            active_cryptocurrencies: 0,
            markets: 0,
            market_cap_percentage: {},
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================
// 1.1 获取历史OHLC数据（过去1天，30分钟K线）
// ============================================
async function fetchHistoricalOHLC() {
    const coinIds = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'BNB': 'binancecoin',
        'DOGE': 'dogecoin',
        'XRP': 'ripple'
    };

    const historicalData = {};

    try {
        // CoinGecko免费API限制：每分钟50次调用
        // 串行调用以避免触及速率限制
        for (const [symbol, coinId] of Object.entries(coinIds)) {
            try {
                // 获取过去1天的OHLC数据（30分钟K线，vs_currency=usd, days=1）
                console.log(`🔑 [${symbol}] Fetching OHLC with API Key: ${COINGECKO_API_KEY ? 'YES' : 'NO'}`);
                const response = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`,
                    {
                        headers: {
                            'x-cg-demo-api-key': COINGECKO_API_KEY
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error(`CoinGecko OHLC API error for ${symbol}: ${response.status}`);
                }

                const data = await response.json();

                // CoinGecko返回格式：[[timestamp, open, high, low, close], ...]
                // 转换为更易读的格式
                const ohlc = data.map(candle => ({
                    timestamp: candle[0],
                    date: new Date(candle[0]).toISOString().split('T')[0],
                    open: candle[1],
                    high: candle[2],
                    low: candle[3],
                    close: candle[4]
                }));

                historicalData[symbol] = ohlc;

                // 显示最后一根K线的时间信息
                const lastCandle = ohlc[ohlc.length - 1];
                const now = Date.now();
                const candleAge = Math.floor((now - lastCandle.timestamp) / 1000 / 60); // 分钟
                const isComplete = candleAge >= 60; // 如果距离现在超过60分钟，说明是完整的

                console.log(`📊 Fetched ${ohlc.length} OHLC candles for ${symbol}`);
                console.log(`📍 Last candle: ${new Date(lastCandle.timestamp).toISOString()} (${candleAge}min ago, ${isComplete ? '完整' : '进行中'})`);

                // 添加小延迟避免API限流（50次/分钟 = 1.2秒/次，保守使用1.5秒）
                await new Promise(resolve => setTimeout(resolve, 1500));

            } catch (error) {
                console.error(`Failed to fetch OHLC for ${symbol}:`, error);
                // 失败时返回空数组，不影响其他币种
                historicalData[symbol] = [];
            }
        }

        return historicalData;
    } catch (error) {
        console.error('Failed to fetch historical OHLC:', error);
        throw error;
    }
}

// ============================================
// 1.1.1 获取加密货币新闻（CryptoCompare）
// ============================================
async function fetchCryptoNews() {
    try {
        // 获取最新10条关于BTC、ETH、SOL、BNB、DOGE、XRP的新闻
        const response = await fetch(
            `https://min-api.cryptocompare.com/data/v2/news/?` +
            `lang=EN&` +
            `categories=BTC,ETH,SOL,BNB,DOGE,XRP&` +
            `api_key=${CRYPTOCOMPARE_API_KEY}`
        );

        if (!response.ok) {
            throw new Error(`CryptoCompare News API error: ${response.status}`);
        }

        const data = await response.json();

        // 只取最新3条新闻（避免prompt过长）
        const topNews = data.Data.slice(0, 3).map(item => ({
            title: item.title,
            summary: item.body.substring(0, 200) || item.title,  // 摘要最多200字符
            published: new Date(item.published_on * 1000).toISOString(),
            categories: item.categories,
            source: item.source_info?.name || item.source,
            url: item.url
        }));

        console.log(`📰 Fetched ${topNews.length} crypto news`);
        return topNews;

    } catch (error) {
        console.error('Failed to fetch crypto news:', error);
        // 新闻获取失败不影响交易，返回空数组
        return [];
    }
}

// ============================================
// 1.2 计算技术指标（使用 Layer）
// ============================================
function calculateTechnicalIndicators(ohlcData) {
    // 直接使用 Layer 的 calculateAllIndicators 函数
    return calculateAllIndicators(ohlcData);
}

// getCurrentPortfolio 已移至 Layer (portfolio-management.mjs)

// ============================================
// 2.4 扣除ETF每日管理费
// deductDailyManagementFees 已移至 Layer (portfolio-management.mjs)


// ============================================
// 3. 基准策略决策函数
// ============================================
async function getBenchmarkDecision(benchmarkName, marketData, portfolio) {
    // 基准策略：追踪真实ETF价格（Buy and Hold）
    // 只在初始状态时买入ETF份额，之后持有不动

    // 更准确的初始状态判断：检查是否已持有 ETF 份额
    const ticker = benchmarkName === 'gdlc' ? 'GDLC' : 'BITW';
    const sharesKey = `${ticker}_SHARES`;
    const hasETFShares = portfolio.holdings && portfolio.holdings[sharesKey] && portfolio.holdings[sharesKey] > 0;

    const isInitialState = !hasETFShares;

    if (!isInitialState) {
        // 非初始状态：检查是否有分红需要再投资
        const dividendDecision = await checkAndReinvestDividends(portfolio, ticker);

        if (dividendDecision) {
            // 有分红需要再投资，返回决策
            return dividendDecision;
        }

        // 无分红事件：Buy & Hold，不再产生任何交易决策
        // 返回null表示无需记录决策（但仍需更新portfolio以反映ETF价格变化）
        return null;
    }

    // 初始状态：买入真实ETF份额
    if (benchmarkName === 'gdlc') {
        // GDLC策略：追踪Grayscale CoinDesk Crypto 5 ETF真实价格
        try {
            const quote = await yahooFinance.quote('GDLC');
            const price = quote.regularMarketPrice;

            if (!price) {
                throw new Error('Failed to get GDLC price');
            }

            return {
                action: 'buy_etf',  // 特殊标记：买入ETF份额
                ticker: 'GDLC',
                price: price,
                reason: `GDLC基准：买入真实ETF份额 ($${price.toFixed(2)}/份)`
            };
        } catch (error) {
            console.error('Failed to fetch GDLC price:', error);
            // 降级：返回持有
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'GDLC价格获取失败，保持持有'
            };
        }

    } else if (benchmarkName === 'equal_weight') {
        // Equal Weight策略：追踪Bitwise 10 Crypto Index Fund (BITW)
        try {
            const quote = await yahooFinance.quote('BITW');
            const price = quote.regularMarketPrice;

            if (!price) {
                throw new Error('Failed to get BITW price');
            }

            return {
                action: 'buy_etf',
                ticker: 'BITW',
                price: price,
                reason: `BITW基准：买入真实ETF份额 ($${price.toFixed(2)}/份)`
            };
        } catch (error) {
            console.error('Failed to fetch BITW price:', error);
            // 降级：返回持有
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'BITW价格获取失败，保持持有'
            };
        }
    }

    // 未知基准策略，返回持有
    return {
        action: 'hold',
        asset: null,
        amount: 0,
        reason: '未知基准策略'
    };
}

// ============================================
// 3.0 通用超时+重试辅助函数
// ============================================
// fetchWithTimeoutAndRetry 已移到 Layer (llm-clients.mjs 内部使用)
// ============================================

// ============================================
// 4. 构建交易提示词（包含历史数据、技术指标、新闻和全局市场数据）
// ============================================
function buildTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    // 格式化历史K线数据（只显示最近3天，避免prompt过长）
    const formatOHLC = (symbol) => {
        const ohlc = historicalData[symbol] || [];
        if (ohlc.length === 0) return '无历史数据';

        // 只取最近3天
        const recent = ohlc.slice(-3);
        return recent.map(candle =>
            `  ${candle.date}: 开$${candle.open.toFixed(2)} 高$${candle.high.toFixed(2)} 低$${candle.low.toFixed(2)} 收$${candle.close.toFixed(2)}`
        ).join('\n');
    };

    // 格式化技术指标
    const formatIndicators = (symbol) => {
        const indicators = technicalIndicators[symbol];
        if (!indicators) return '  数据不足，无法计算指标';

        let lines = [];

        if (indicators.rsi !== null) {
            const rsiStatus = indicators.rsi > 70 ? '超买⚠️' : indicators.rsi < 30 ? '超卖⚠️' : '中性';
            lines.push(`  RSI(14): ${indicators.rsi.toFixed(2)} (${rsiStatus})`);
        }

        if (indicators.macd) {
            const trend = indicators.macd.histogram > 0 ? '多头📈' : '空头📉';
            lines.push(`  MACD: ${indicators.macd.value.toFixed(2)} (信号线: ${indicators.macd.signal.toFixed(2)}, ${trend})`);
        }

        if (indicators.ma7 !== null) {
            lines.push(`  MA(7): $${indicators.ma7.toFixed(2)}`);
        }

        if (indicators.ma25 !== null) {
            const crossStatus = indicators.ma7 > indicators.ma25 ? '金叉📈(上涨趋势)' : '死叉📉(下跌趋势)';
            lines.push(`  MA(25): $${indicators.ma25.toFixed(2)} (${crossStatus})`);
        }

        if (indicators.bollinger) {
            const bb = indicators.bollinger;
            const currentPrice = marketData[symbol].price;
            let position = '';
            if (currentPrice > bb.upper) position = '(突破上轨，可能回调)';
            else if (currentPrice < bb.lower) position = '(跌破下轨，可能反弹)';
            else position = '(在通道内)';

            lines.push(`  布林带: 上$${bb.upper.toFixed(2)} 中$${bb.middle.toFixed(2)} 下$${bb.lower.toFixed(2)} ${position}`);
        }

        return lines.join('\n');
    };

    // 格式化新闻
    const formatNews = () => {
        if (!newsData || newsData.length === 0) {
            return '  暂无最新新闻';
        }

        return newsData.map((news, index) =>
            `${index + 1}. [${news.source}] ${news.title}\n   分类: ${news.categories} | 发布: ${news.published.split('T')[0]}\n   ${news.summary.substring(0, 150)}...`
        ).join('\n\n');
    };

    return `你是一个专业的加密货币量化交易员。请基于以下市场数据、历史K线、技术指标和最新新闻做出交易决策。

=== 全局市场环境 ===
总市值: $${(globalMarketData.total_market_cap_usd / 1e12).toFixed(2)}T (24h变化: ${globalMarketData.market_cap_change_percentage_24h.toFixed(2)}%)
24h总交易量: $${(globalMarketData.total_volume_24h_usd / 1e9).toFixed(2)}B
BTC主导地位: ${globalMarketData.btc_dominance.toFixed(2)}% ${globalMarketData.btc_dominance > 55 ? '(避险情绪，资金流向BTC)' : globalMarketData.btc_dominance < 45 ? '(山寨季，资金追逐高收益)' : '(市场平衡)'}
ETH主导地位: ${globalMarketData.eth_dominance.toFixed(2)}%

=== 最新加密货币新闻 ===
${formatNews()}

=== 当前市场数据 ===
BTC: $${marketData.BTC.price.toFixed(2)} (24h: ${marketData.BTC.change_24h.toFixed(2)}%)
  排名#${marketData.BTC.market_cap_rank} | 市值: $${(marketData.BTC.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.BTC.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.BTC.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.BTC.ath.toFixed(2)}

ETH: $${marketData.ETH.price.toFixed(2)} (24h: ${marketData.ETH.change_24h.toFixed(2)}%)
  排名#${marketData.ETH.market_cap_rank} | 市值: $${(marketData.ETH.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.ETH.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.ETH.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.ETH.ath.toFixed(2)}

SOL: $${marketData.SOL.price.toFixed(2)} (24h: ${marketData.SOL.change_24h.toFixed(2)}%)
  排名#${marketData.SOL.market_cap_rank} | 市值: $${(marketData.SOL.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.SOL.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.SOL.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.SOL.ath.toFixed(2)}

BNB: $${marketData.BNB.price.toFixed(2)} (24h: ${marketData.BNB.change_24h.toFixed(2)}%)
  排名#${marketData.BNB.market_cap_rank} | 市值: $${(marketData.BNB.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.BNB.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.BNB.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.BNB.ath.toFixed(2)}

DOGE: $${marketData.DOGE.price.toFixed(4)} (24h: ${marketData.DOGE.change_24h.toFixed(2)}%)
  排名#${marketData.DOGE.market_cap_rank} | 市值: $${(marketData.DOGE.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.DOGE.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.DOGE.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.DOGE.ath.toFixed(4)}

XRP: $${marketData.XRP.price.toFixed(4)} (24h: ${marketData.XRP.change_24h.toFixed(2)}%)
  排名#${marketData.XRP.market_cap_rank} | 市值: $${(marketData.XRP.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.XRP.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.XRP.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.XRP.ath.toFixed(4)}

=== 历史K线数据（最近3天） ===
BTC:
${formatOHLC('BTC')}

ETH:
${formatOHLC('ETH')}

SOL:
${formatOHLC('SOL')}

BNB:
${formatOHLC('BNB')}

DOGE:
${formatOHLC('DOGE')}

XRP:
${formatOHLC('XRP')}

=== 技术指标 ===
BTC:
${formatIndicators('BTC')}

ETH:
${formatIndicators('ETH')}

SOL:
${formatIndicators('SOL')}

BNB:
${formatIndicators('BNB')}

DOGE:
${formatIndicators('DOGE')}

XRP:
${formatIndicators('XRP')}

=== 你的账户状态 ===
现金: $${portfolio.cash.toFixed(2)}
持仓: ${JSON.stringify(portfolio.holdings)}
总资产: $${portfolio.total_value.toFixed(2)}
盈亏: ${portfolio.pnl?.toFixed(2) || 0}$ (${portfolio.pnl_percentage?.toFixed(2) || 0}%)

=== 交易规则 ===
1. 你只能交易 BTC, ETH, SOL, BNB, DOGE, XRP（对标Alpha Arena比赛币种，现货交易无杠杆）
2. 单笔交易不超过总资产的 30%
3. 单笔交易至少 $10（低于此金额不交易）
4. 必须保留至少 20% 现金
5. 每笔交易收取 0.1% 手续费
6. 可以选择：买入、卖出、持有

请返回 JSON 格式的决策（不要包含任何其他文字）：
{
    "action": "buy/sell/hold",
    "asset": "资产代码（buy/sell时填币种如BTC；hold时填null不带引号）",
    "amount": 数量,
    "reason": "决策理由（中文，1-2句话）"
}

注意：hold时asset必须填 null（不是字符串"null"）`;
}

// ============================================
// 4.1 构建多资产交易提示词（支持同时操作多个币种）
// ============================================
function buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    // 复用原有的格式化函数
    const formatOHLC = (symbol) => {
        const ohlc = historicalData[symbol] || [];
        if (ohlc.length === 0) return '无历史数据';

        const recent = ohlc.slice(-3);
        return recent.map(candle =>
            `  ${candle.date}: 开$${candle.open.toFixed(2)} 高$${candle.high.toFixed(2)} 低$${candle.low.toFixed(2)} 收$${candle.close.toFixed(2)}`
        ).join('\n');
    };

    const formatIndicators = (symbol) => {
        const indicators = technicalIndicators[symbol];
        if (!indicators) return '  数据不足，无法计算指标';

        let lines = [];

        if (indicators.rsi !== null) {
            const rsiStatus = indicators.rsi > 70 ? '超买⚠️' : indicators.rsi < 30 ? '超卖⚠️' : '中性';
            lines.push(`  RSI(14): ${indicators.rsi.toFixed(2)} (${rsiStatus})`);
        }

        if (indicators.macd) {
            const trend = indicators.macd.histogram > 0 ? '多头📈' : '空头📉';
            lines.push(`  MACD: ${indicators.macd.value.toFixed(2)} (信号线: ${indicators.macd.signal.toFixed(2)}, ${trend})`);
        }

        if (indicators.ma7 !== null) {
            lines.push(`  MA(7): $${indicators.ma7.toFixed(2)}`);
        }

        if (indicators.ma25 !== null) {
            const crossStatus = indicators.ma7 > indicators.ma25 ? '金叉📈(上涨趋势)' : '死叉📉(下跌趋势)';
            lines.push(`  MA(25): $${indicators.ma25.toFixed(2)} (${crossStatus})`);
        }

        if (indicators.bollinger) {
            const bb = indicators.bollinger;
            const currentPrice = marketData[symbol].price;
            let position = '';
            if (currentPrice > bb.upper) position = '(突破上轨，可能回调)';
            else if (currentPrice < bb.lower) position = '(跌破下轨，可能反弹)';
            else position = '(在通道内)';

            lines.push(`  布林带: 上$${bb.upper.toFixed(2)} 中$${bb.middle.toFixed(2)} 下$${bb.lower.toFixed(2)} ${position}`);
        }

        return lines.join('\n');
    };

    const formatNews = () => {
        if (!newsData || newsData.length === 0) {
            return '  暂无最新新闻';
        }

        return newsData.map((news, index) =>
            `${index + 1}. [${news.source}] ${news.title}\n   分类: ${news.categories} | 发布: ${news.published.split('T')[0]}\n   ${news.summary.substring(0, 150)}...`
        ).join('\n\n');
    };

    return `你是一个专业的加密货币量化交易员。请基于以下市场数据、历史K线、技术指标和最新新闻做出交易决策。

=== 全局市场环境 ===
总市值: $${(globalMarketData.total_market_cap_usd / 1e12).toFixed(2)}T (24h变化: ${globalMarketData.market_cap_change_percentage_24h.toFixed(2)}%)
24h总交易量: $${(globalMarketData.total_volume_24h_usd / 1e9).toFixed(2)}B
BTC主导地位: ${globalMarketData.btc_dominance.toFixed(2)}% ${globalMarketData.btc_dominance > 55 ? '(避险情绪，资金流向BTC)' : globalMarketData.btc_dominance < 45 ? '(山寨季，资金追逐高收益)' : '(市场平衡)'}
ETH主导地位: ${globalMarketData.eth_dominance.toFixed(2)}%

=== 最新加密货币新闻 ===
${formatNews()}

=== 当前市场数据 ===
BTC: $${marketData.BTC.price.toFixed(2)} (24h: ${marketData.BTC.change_24h.toFixed(2)}%)
  排名#${marketData.BTC.market_cap_rank} | 市值: $${(marketData.BTC.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.BTC.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.BTC.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.BTC.ath.toFixed(2)}

ETH: $${marketData.ETH.price.toFixed(2)} (24h: ${marketData.ETH.change_24h.toFixed(2)}%)
  排名#${marketData.ETH.market_cap_rank} | 市值: $${(marketData.ETH.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.ETH.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.ETH.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.ETH.ath.toFixed(2)}

SOL: $${marketData.SOL.price.toFixed(2)} (24h: ${marketData.SOL.change_24h.toFixed(2)}%)
  排名#${marketData.SOL.market_cap_rank} | 市值: $${(marketData.SOL.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.SOL.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.SOL.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.SOL.ath.toFixed(2)}

BNB: $${marketData.BNB.price.toFixed(2)} (24h: ${marketData.BNB.change_24h.toFixed(2)}%)
  排名#${marketData.BNB.market_cap_rank} | 市值: $${(marketData.BNB.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.BNB.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.BNB.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.BNB.ath.toFixed(2)}

DOGE: $${marketData.DOGE.price.toFixed(4)} (24h: ${marketData.DOGE.change_24h.toFixed(2)}%)
  排名#${marketData.DOGE.market_cap_rank} | 市值: $${(marketData.DOGE.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.DOGE.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.DOGE.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.DOGE.ath.toFixed(4)}

XRP: $${marketData.XRP.price.toFixed(4)} (24h: ${marketData.XRP.change_24h.toFixed(2)}%)
  排名#${marketData.XRP.market_cap_rank} | 市值: $${(marketData.XRP.market_cap / 1e9).toFixed(2)}B | 24h量: $${(marketData.XRP.volume_24h / 1e9).toFixed(2)}B
  距ATH: ${marketData.XRP.ath_change_percentage.toFixed(2)}% | ATH: $${marketData.XRP.ath.toFixed(4)}

=== 历史K线数据（最近3天） ===
BTC:
${formatOHLC('BTC')}

ETH:
${formatOHLC('ETH')}

SOL:
${formatOHLC('SOL')}

BNB:
${formatOHLC('BNB')}

DOGE:
${formatOHLC('DOGE')}

XRP:
${formatOHLC('XRP')}

=== 技术指标 ===
BTC:
${formatIndicators('BTC')}

ETH:
${formatIndicators('ETH')}

SOL:
${formatIndicators('SOL')}

BNB:
${formatIndicators('BNB')}

DOGE:
${formatIndicators('DOGE')}

XRP:
${formatIndicators('XRP')}

=== 你的账户状态 ===
现金: $${portfolio.cash.toFixed(2)}
持仓: ${JSON.stringify(portfolio.holdings)}
总资产: $${portfolio.total_value.toFixed(2)}
盈亏: ${portfolio.pnl?.toFixed(2) || 0}$ (${portfolio.pnl_percentage?.toFixed(2) || 0}%)

=== 交易规则 ===
1. ⚠️ **严格限制**：你只能交易 BTC, ETH, SOL, BNB, DOGE, XRP 这6种货币，除此之外的任何币种（包括POPCAT、PEPE等）都不允许交易！
2. 现货交易无杠杆（对标Alpha Arena比赛币种）
3. 单笔交易不超过总资产的 30%
4. 单笔交易至少 $10（低于此金额不交易）
5. 必须保留至少 20% 现金
6. 每笔交易收取 0.1% 手续费
7. **你可以在一次决策中同时操作多个币种**（例如：卖出BTC的同时买入SOL）

请返回 JSON 格式的决策（不要包含任何其他文字）：

**单笔交易格式（只操作一个币种）：**
{
    "action": "buy/sell/hold",
    "asset": "BTC",
    "amount": 0.1,
    "reason": "决策理由（中文，1-2句话）"
}

**多笔交易格式（同时操作多个币种，推荐使用）：**
{
    "actions": [
        {"action": "sell", "asset": "BTC", "amount": 0.1, "reason": "BTC技术指标转弱，止盈"},
        {"action": "buy", "asset": "SOL", "amount": 20, "reason": "SOL超卖反弹信号明显"},
        {"action": "buy", "asset": "BNB", "amount": 5, "reason": "BNB RSI超卖，逢低布局"}
    ],
    "overall_reason": "整体策略：降低BTC仓位，增配超卖的SOL和BNB"
}

**持有格式（不交易）：**
{
    "action": "hold",
    "asset": null,
    "amount": 0,
    "reason": "市场不明朗，暂时观望"
}

注意事项：
- 你可以自由选择单笔或多笔交易格式
- 多笔交易时，先执行卖出操作（释放现金），再执行买入操作
- 确保所有交易完成后，现金余额 >= 总资产的20%`;
}

// ============================================
// 4.2 决策解析（使用 Layer）
// ============================================
function parseAndValidateDecision(text, modelName) {
    // 使用 Layer 的 parseAndValidateDecision 函数，强制验证可交易资产
    return parseAndValidateDecisionFromLayer(text, {
        modelName,
        availableAssets: AVAILABLE_ASSETS,  // 严格限制：BTC, ETH, SOL, BNB, DOGE, XRP
        allowHold: true,
        requireAmount: true  // 必须提供正数amount
    });
}
// ============================================
// 4. LLM Agent 执行（使用 Layer agent-executor）
// ============================================

/**
 * 调用 LLM Agent 进行交易决策
 * 使用 Layer 的 agent-executor 模块统一管理所有 LLM 配置
 * @param {string} agentName - Agent 名称（如 'openai_standard', 'claude_mini'）
 * @param {object} marketData - 市场数据
 * @param {object} globalMarketData - 全局市场数据
 * @param {object} portfolio - 当前持仓
 * @param {object} historicalData - 历史数据
 * @param {object} technicalIndicators - 技术指标
 * @param {object} newsData - 新闻数据
 * @returns {Promise<object>} - 决策对象
 */
async function askLLM(agentName, marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    // 构建 Prompt（业务逻辑）
    const promptBuilder = () => buildMultiAssetTradingPrompt(
        marketData,
        globalMarketData,
        portfolio,
        historicalData,
        technicalIndicators,
        newsData
    );

    // 调用 Layer 的 agent-executor
    const { decision } = await executeAgent(agentName, promptBuilder, API_KEYS);

    return decision;
}




// ============================================
// 5. 保存决策到数据库
// ============================================
async function saveDecision(agentName, decision, marketData, globalMarketData, portfolioValue) {
    try {
        // 为多资产决策添加兼容字段（让前端能正确显示）
        let decisionToSave = decision;

        if (decision && decision.actions && Array.isArray(decision.actions)) {
            // 多资产决策：添加摘要字段供前端显示
            const buyActions = decision.actions.filter(a => a.action === 'buy');
            const sellActions = decision.actions.filter(a => a.action === 'sell');

            // 根据净现金流判断状态（买入/卖出/调仓/持有）
            let displayAction = 'hold';

            if (buyActions.length > 0 || sellActions.length > 0) {
                // 计算买入和卖出的总金额
                const buyTotal = buyActions.reduce((sum, trade) => {
                    const price = marketData[trade.asset]?.price || 0;
                    return sum + (trade.amount * price);
                }, 0);

                const sellTotal = sellActions.reduce((sum, trade) => {
                    const price = marketData[trade.asset]?.price || 0;
                    return sum + (trade.amount * price);
                }, 0);

                const totalVolume = buyTotal + sellTotal;
                const netFlow = sellTotal - buyTotal;  // 正数=净卖出，负数=净买入

                // 根据净现金流比例判断状态
                if (totalVolume === 0) {
                    displayAction = 'hold';
                } else {
                    const netFlowRatio = Math.abs(netFlow) / totalVolume;

                    if (netFlowRatio < 0.15) {
                        // 买卖金额接近平衡（差异 < 15%）→ 调仓
                        displayAction = 'rebalance';
                    } else if (netFlow < 0) {
                        // 净买入数字货币 → 买入
                        displayAction = 'buy';
                    } else {
                        // 净卖出数字货币 → 卖出
                        displayAction = 'sell';
                    }
                }

                console.log(`💰 Buy: $${buyTotal.toFixed(2)}, Sell: $${sellTotal.toFixed(2)}, Net: $${netFlow.toFixed(2)} → ${displayAction}`);
            }

            // 买入和卖出分开，只写理由（不重复写资产和数量，前端asset字段已显示）
            const sellReasons = sellActions.map(t => t.reason).filter(r => r);
            const buyReasons = buyActions.map(t => t.reason).filter(r => r);

            let reasonParts = [];
            if (sellReasons.length > 0) {
                reasonParts.push(`卖出: ${sellReasons.join('; ')}`);
            }
            if (buyReasons.length > 0) {
                reasonParts.push(`买入: ${buyReasons.join('; ')}`);
            }

            let finalReason = reasonParts.join('\n\n');
            if (decision.overall_reason) {
                finalReason += `\n\n整体策略: ${decision.overall_reason}`;
            }

            // 收集买入和卖出的资产（分开显示）
            const buyAssets = [...new Set(buyActions.map(t => t.asset))];
            const sellAssets = [...new Set(sellActions.map(t => t.asset))];

            // 构建资产标签字符串（买入、卖出分开）
            let assetTags = [];
            if (buyAssets.length > 0) {
                assetTags.push(`买入: ${buyAssets.join(', ')}`);
            }
            if (sellAssets.length > 0) {
                assetTags.push(`卖出: ${sellAssets.join(', ')}`);
            }
            const assetsDisplay = assetTags.join(' | ');

            decisionToSave = {
                ...decision,
                // 添加兼容字段：前端会读取这些字段
                action: displayAction,  // 使用前端认识的action值
                asset: assetsDisplay,  // 买入和卖出资产分开显示
                reason: finalReason,  // 买入和卖出分开写理由
                // 不添加amount字段（x 4.0000没意义）
                // 保留原始的actions数组
            };

            console.log(`💾 Saving multi-asset decision: ${decision.actions.length} trades (display as: ${displayAction})`);
        }

        const { error } = await supabase
            .from('llm_trading_decisions')
            .insert({
                agent_name: agentName,
                decision: decisionToSave,
                market_data: {
                    ...marketData,
                    global_market: globalMarketData  // 临时嵌入到market_data中，等数据库添加字段后再分离
                },
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

