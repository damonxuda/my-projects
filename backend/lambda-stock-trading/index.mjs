// AWS Lambda Function: Multi-LLM Stock Trading Decision Maker
// 用途：定时调用多个 LLM API（Gemini, Claude, Grok, OpenAI）进行美股交易决策，并保存到 Supabase
// 触发：CloudWatch Events (每小时一次)
// 环境变量：GEMINI_PRO_API_KEY, GEMINI_FLASH_API_KEY, CLAUDE_SONNET_API_KEY, CLAUDE_HAIKU_API_KEY, GROK_API_KEY, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALPHA_VANTAGE_API_KEY

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
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;  // Alpha Vantage News API
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

// 可交易股票列表（严格限制）- 16支美股
const AVAILABLE_STOCKS = [
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO',
    'COST', 'NFLX', 'CRM', 'ORCL', 'CSCO', 'ACN', 'AMD', 'ADBE'
];

// 配置要运行的 LLM agents + ETF基准
// 新架构：每家厂商2个模型（标准型 + 轻量级）+ 3个ETF基准
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

    // DeepSeek (1个) - 统一使用 deepseek 标识（支持V3和R1）
    { name: 'deepseek', type: 'llm', enabled: true },                     // DeepSeek (AWS Bedrock)

    // Qwen (1个)
    { name: 'qwen3_235b', type: 'llm', enabled: true },                   // Qwen3 235B A22B (AWS Bedrock)

    // ETF基准 (3个)
    { name: 'qqq', type: 'benchmark', enabled: true },                    // Invesco QQQ ETF
    { name: 'vgt', type: 'benchmark', enabled: true },                    // Vanguard Information Technology ETF
    { name: 'spy', type: 'benchmark', enabled: true }                     // SPDR S&P 500 ETF
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

        // 5. 解析并验证决策（强制限制可交易股票）
        const decision = parseAndValidateDecisionFromLayer(result.text, {
            modelName: displayName,
            availableAssets: AVAILABLE_STOCKS,  // 严格限制：16支美股
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
    console.log('🚀 Multi-LLM Stock Trading Decision Maker started');
    console.log(`Active agents: ${AGENTS.map(a => a.name).join(', ')}`);
    console.log('Event:', JSON.stringify(event, null, 2));

    const results = [];

    try {
        // 1. 获取市场数据（所有 agents 共享）
        const marketData = await fetchMarketData();
        console.log('📊 Market Data:', marketData);

        // 1.1 获取历史OHLC数据和技术指标（所有 agents 共享）
        console.log('📈 Fetching historical OHLC data...');
        const historicalData = await fetchHistoricalOHLC();

        // 1.2 计算每个股票的技术指标
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

        // 1.3 获取美股新闻（所有 agents 共享）
        console.log('📰 Fetching stock news...');
        const newsData = await fetchNewsData();

        // 2. 并发执行所有 agent 的交易决策（性能提升3-5倍）
        console.log(`\n🚀 开始并发处理 ${AGENTS.length} 个agents...`);
        const agentResults = await Promise.all(
            AGENTS.map(agent => processSingleAgent(agent, marketData, historicalData, technicalIndicators, newsData))
        );

        // 整理结果
        results.push(...agentResults);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Multi-agent stock trading decisions completed',
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
async function processSingleAgent(agent, marketData, historicalData, technicalIndicators, newsData) {
    console.log(`\n========== Processing ${agent.name.toUpperCase()} ==========`);

    try {
        // 1. 获取当前虚拟账户状态
        const portfolio = await getCurrentPortfolio(agent.name, supabase, 'stock_trading_portfolios');
        console.log(`💰 ${agent.name} Portfolio:`, portfolio);

        // 1.5 扣除ETF每日管理费（如果持有QQQ、VGT或SPY）
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
            decision = await askLLM(agent.name, marketData, portfolio, historicalData, technicalIndicators, newsData);
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
            await saveDecision(agent.name, decision, marketData, newPortfolio.total_value);
        } else {
            console.log(`📊 ${agent.name} Buy & Hold策略：无需记录决策，仅更新portfolio`);
        }
        await savePortfolio(newPortfolio, supabase, 'stock_trading_portfolios');

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
            const lastPortfolio = await getCurrentPortfolio(agent.name, supabase, 'stock_trading_portfolios');
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
            await savePortfolio(fallbackPortfolio, supabase, 'stock_trading_portfolios');
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
// 1. 获取市场数据（Yahoo Finance）
// ============================================
async function fetchMarketData() {
    try {
        const marketData = {};

        // 获取16支股票的实时报价
        for (const symbol of AVAILABLE_STOCKS) {
            try {
                const quote = await yahooFinance.quote(symbol);

                marketData[symbol] = {
                    price: quote.regularMarketPrice,
                    change_24h: quote.regularMarketChangePercent,
                    volume_24h: quote.regularMarketVolume,
                    market_cap: quote.marketCap,
                    high_24h: quote.regularMarketDayHigh,
                    low_24h: quote.regularMarketDayLow,
                    pe_ratio: quote.trailingPE,
                    eps: quote.epsTrailingTwelveMonths,
                    fifty_two_week_high: quote.fiftyTwoWeekHigh,
                    fifty_two_week_low: quote.fiftyTwoWeekLow,
                    last_updated: new Date().toISOString()
                };

                console.log(`✅ Fetched ${symbol}: $${quote.regularMarketPrice.toFixed(2)}`);

            } catch (error) {
                console.error(`Failed to fetch ${symbol}:`, error);
                // 失败时使用默认值，不影响其他股票
                marketData[symbol] = {
                    price: 0,
                    change_24h: 0,
                    volume_24h: 0,
                    market_cap: 0,
                    high_24h: 0,
                    low_24h: 0,
                    pe_ratio: 0,
                    eps: 0,
                    fifty_two_week_high: 0,
                    fifty_two_week_low: 0,
                    last_updated: new Date().toISOString()
                };
            }
        }

        // 获取3个ETF基准的实时报价
        const ETF_TICKERS = ['QQQ', 'VGT', 'SPY'];
        for (const symbol of ETF_TICKERS) {
            try {
                const quote = await yahooFinance.quote(symbol);

                marketData[symbol] = {
                    price: quote.regularMarketPrice,
                    change_24h: quote.regularMarketChangePercent,
                    volume_24h: quote.regularMarketVolume,
                    market_cap: quote.marketCap,
                    high_24h: quote.regularMarketDayHigh,
                    low_24h: quote.regularMarketDayLow,
                    fifty_two_week_high: quote.fiftyTwoWeekHigh,
                    fifty_two_week_low: quote.fiftyTwoWeekLow,
                    last_updated: new Date().toISOString()
                };

                console.log(`✅ Fetched ETF ${symbol}: $${quote.regularMarketPrice.toFixed(2)}`);

            } catch (error) {
                console.error(`Failed to fetch ETF ${symbol}:`, error);
                marketData[symbol] = {
                    price: 0,
                    change_24h: 0,
                    volume_24h: 0,
                    market_cap: 0,
                    high_24h: 0,
                    low_24h: 0,
                    fifty_two_week_high: 0,
                    fifty_two_week_low: 0,
                    last_updated: new Date().toISOString()
                };
            }
        }

        marketData.timestamp = new Date().toISOString();
        return marketData;

    } catch (error) {
        console.error('Failed to fetch market data:', error);
        throw error;
    }
}

// ============================================
// 1.1 获取历史OHLC数据（Yahoo Finance）
// ============================================
async function fetchHistoricalOHLC() {
    const historicalData = {};

    try {
        // 获取过去7天的30分钟K线数据（与加密货币一致，约336根K线）
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        for (const symbol of AVAILABLE_STOCKS) {
            try {
                const result = await yahooFinance.chart(symbol, {
                    period1: startDate,
                    period2: endDate,
                    interval: '30m'  // 30分钟K线，与加密货币一致
                });

                // 转换为统一格式（chart API返回的数据结构不同）
                const quotes = result.quotes || [];
                const ohlc = quotes.map(candle => ({
                    timestamp: candle.date.getTime(),
                    date: candle.date.toISOString().split('T')[0],
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume
                }));

                historicalData[symbol] = ohlc;
                console.log(`📊 Fetched ${ohlc.length} OHLC candles for ${symbol}`);

            } catch (error) {
                console.error(`Failed to fetch OHLC for ${symbol}:`, error);
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
// 1.2 获取美股新闻（Alpha Vantage）
// ============================================
async function fetchNewsData() {
    try {
        // 获取美股科技板块的最新新闻（限制3条）
        const response = await fetch(
            `https://www.alphavantage.co/query?` +
            `function=NEWS_SENTIMENT&` +
            `topics=technology&` +
            `apikey=${ALPHA_VANTAGE_API_KEY}`
        );

        if (!response.ok) {
            throw new Error(`Alpha Vantage News API error: ${response.status}`);
        }

        const data = await response.json();

        // 只取最新3条新闻（避免prompt过长）
        const topNews = (data.feed || []).slice(0, 3).map(item => ({
            title: item.title,
            summary: item.summary?.substring(0, 200) || item.title,
            published: item.time_published,
            source: item.source,
            sentiment_score: item.overall_sentiment_score,
            sentiment_label: item.overall_sentiment_label,
            tickers: item.ticker_sentiment?.map(t => t.ticker).join(', ') || ''
        }));

        console.log(`📰 Fetched ${topNews.length} stock news`);
        return topNews;

    } catch (error) {
        console.error('Failed to fetch stock news:', error);
        // 新闻获取失败不影响交易，返回空数组
        return [];
    }
}

// ============================================
// 1.3 计算技术指标（使用 Layer）
// ============================================
function calculateTechnicalIndicators(ohlcData) {
    // 直接使用 Layer 的 calculateAllIndicators 函数
    return calculateAllIndicators(ohlcData);
}

// ============================================
// 3. ETF基准策略决策函数
// ============================================
async function getBenchmarkDecision(benchmarkName, marketData, portfolio) {
    // 基准策略：追踪真实ETF价格（Buy and Hold）
    // 只在初始状态时买入ETF份额，之后持有不动

    // 映射ETF ticker
    const tickerMap = {
        'qqq': 'QQQ',
        'vgt': 'VGT',
        'spy': 'SPY'
    };
    const ticker = tickerMap[benchmarkName];
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
        return null;
    }

    // 初始状态：买入真实ETF份额
    try {
        const quote = await yahooFinance.quote(ticker);
        const price = quote.regularMarketPrice;

        if (!price) {
            throw new Error(`Failed to get ${ticker} price`);
        }

        return {
            action: 'buy_etf',  // 特殊标记：买入ETF份额
            ticker: ticker,
            price: price,
            reason: `${ticker}基准：买入真实ETF份额 ($${price.toFixed(2)}/份)`
        };
    } catch (error) {
        console.error(`Failed to fetch ${ticker} price:`, error);
        // 降级：返回持有
        return {
            action: 'hold',
            stock: null,
            amount: 0,
            reason: `${ticker}价格获取失败，保持持有`
        };
    }
}

// ============================================
// 4. 构建美股交易提示词
// ============================================
function buildStockTradingPrompt(marketData, portfolio, historicalData, technicalIndicators, newsData) {
    // 格式化历史K线数据
    const formatOHLC = (symbol) => {
        const ohlc = historicalData[symbol] || [];
        if (ohlc.length === 0) return '无历史数据';

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
            `${index + 1}. [${news.source}] ${news.title}\n   情绪: ${news.sentiment_label} (${news.sentiment_score}) | 相关: ${news.tickers}\n   ${news.summary.substring(0, 150)}...`
        ).join('\n\n');
    };

    // 构建市场数据显示
    const buildMarketDataSection = () => {
        return AVAILABLE_STOCKS.map(symbol => {
            const data = marketData[symbol];
            return `${symbol}: $${data.price.toFixed(2)} (24h: ${data.change_24h.toFixed(2)}%)
  市值: $${(data.market_cap / 1e9).toFixed(2)}B | 24h量: ${(data.volume_24h / 1e6).toFixed(2)}M
  P/E: ${data.pe_ratio?.toFixed(2) || 'N/A'} | 52周: $${data.fifty_two_week_low.toFixed(2)} - $${data.fifty_two_week_high.toFixed(2)}`;
        }).join('\n\n');
    };

    return `你是一个专业的美股量化交易员。请基于以下市场数据、历史K线、技术指标和最新新闻做出交易决策。

=== 最新美股新闻 ===
${formatNews()}

=== 当前市场数据 ===
${buildMarketDataSection()}

=== 历史K线数据（最近3天） ===
${AVAILABLE_STOCKS.map(s => `${s}:\n${formatOHLC(s)}`).join('\n\n')}

=== 技术指标 ===
${AVAILABLE_STOCKS.map(s => `${s}:\n${formatIndicators(s)}`).join('\n\n')}

=== 你的账户状态 ===
现金: $${portfolio.cash.toFixed(2)}
持仓: ${JSON.stringify(portfolio.holdings)}
总资产: $${portfolio.total_value.toFixed(2)}
盈亏: ${portfolio.pnl?.toFixed(2) || 0}$ (${portfolio.pnl_percentage?.toFixed(2) || 0}%)

=== 交易规则 ===
1. ⚠️ **严格限制**：你只能交易这16支股票：${AVAILABLE_STOCKS.join(', ')}
2. 现货交易无杠杆
3. 单笔交易不超过总资产的 30%
4. 单笔交易至少 $10（低于此金额不交易）
5. 必须保留至少 20% 现金
6. 每笔交易收取 0.1% 手续费
7. **你可以在一次决策中同时操作多个股票**

请返回 JSON 格式的决策（不要包含任何其他文字）：

**单笔交易格式：**
{
    "action": "buy/sell/hold",
    "asset": "AAPL",
    "amount": 10,
    "reason": "决策理由（中文，1-2句话）"
}

**多笔交易格式（推荐）：**
{
    "actions": [
        {"action": "sell", "asset": "NVDA", "amount": 5, "reason": "NVDA技术指标转弱，止盈"},
        {"action": "buy", "asset": "AAPL", "amount": 10, "reason": "AAPL超卖反弹信号明显"}
    ],
    "overall_reason": "整体策略：降低NVDA仓位，增配AAPL"
}

**持有格式：**
{
    "action": "hold",
    "asset": null,
    "amount": 0,
    "reason": "市场不明朗，暂时观望"
}

注意：多笔交易时，先执行卖出操作（释放现金），再执行买入操作`;
}

// ============================================
// 4.1 LLM Agent 执行
// ============================================
async function askLLM(agentName, marketData, portfolio, historicalData, technicalIndicators, newsData) {
    // 构建 Prompt（业务逻辑）
    const promptBuilder = () => buildStockTradingPrompt(
        marketData,
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
async function saveDecision(agentName, decision, marketData, portfolioValue) {
    try {
        // 为多资产决策添加兼容字段
        let decisionToSave = decision;

        if (decision && decision.actions && Array.isArray(decision.actions)) {
            // 多资产决策：添加摘要字段供前端显示
            const buyActions = decision.actions.filter(a => a.action === 'buy');
            const sellActions = decision.actions.filter(a => a.action === 'sell');

            // 根据净现金流判断状态
            let displayAction = 'hold';

            if (buyActions.length > 0 || sellActions.length > 0) {
                const buyTotal = buyActions.reduce((sum, trade) => {
                    const price = marketData[trade.asset]?.price || 0;
                    return sum + (trade.amount * price);
                }, 0);

                const sellTotal = sellActions.reduce((sum, trade) => {
                    const price = marketData[trade.asset]?.price || 0;
                    return sum + (trade.amount * price);
                }, 0);

                const totalVolume = buyTotal + sellTotal;
                const netFlow = sellTotal - buyTotal;

                if (totalVolume === 0) {
                    displayAction = 'hold';
                } else {
                    const netFlowRatio = Math.abs(netFlow) / totalVolume;

                    if (netFlowRatio < 0.15) {
                        displayAction = 'rebalance';
                    } else if (netFlow < 0) {
                        displayAction = 'buy';
                    } else {
                        displayAction = 'sell';
                    }
                }

                console.log(`💰 Buy: $${buyTotal.toFixed(2)}, Sell: $${sellTotal.toFixed(2)}, Net: $${netFlow.toFixed(2)} → ${displayAction}`);
            }

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

            const buyStocks = [...new Set(buyActions.map(t => t.asset))];
            const sellStocks = [...new Set(sellActions.map(t => t.asset))];

            let stockTags = [];
            if (buyStocks.length > 0) {
                stockTags.push(`买入: ${buyStocks.join(', ')}`);
            }
            if (sellStocks.length > 0) {
                stockTags.push(`卖出: ${sellStocks.join(', ')}`);
            }
            const stocksDisplay = stockTags.join(' | ');

            decisionToSave = {
                ...decision,
                action: displayAction,
                stock: stocksDisplay,
                reason: finalReason
            };

            console.log(`💾 Saving multi-stock decision: ${decision.actions.length} trades (display as: ${displayAction})`);
        }

        const { error } = await supabase
            .from('stock_trading_decisions')
            .insert({
                agent_name: agentName,
                decision: decisionToSave,
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
