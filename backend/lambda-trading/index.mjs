// AWS Lambda Function: Multi-LLM Trading Decision Maker
// 用途：定时调用多个 LLM API（Gemini, Claude, Grok, OpenAI）进行交易决策，并保存到 Supabase
// 触发：CloudWatch Events (每小时一次)
// 环境变量：GEMINI_API_KEY, CLAUDE_API_KEY, GROK_API_KEY, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import YahooFinanceClass from 'yahoo-finance2';
import { RSI, MACD, SMA, BollingerBands } from 'technicalindicators';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// v3版本需要实例化
const yahooFinance = new YahooFinanceClass();

// Bedrock Runtime 客户端（用于 DeepSeek V3）
const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-1' });

// ============================================
// 环境变量配置
// ============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_PRO_API_KEY = process.env.GEMINI_PRO_API_KEY;  // 代理商API Key for Gemini Pro
const GEMINI_FLASH_API_KEY = process.env.GEMINI_FLASH_API_KEY;  // 代理商API Key for Gemini Flash
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const GROK_API_KEY = process.env.GROK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY;  // CryptoCompare News API
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;  // CoinGecko Demo API Key
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
    { name: 'claude_standard', type: 'llm', enabled: !!CLAUDE_API_KEY },  // Sonnet 4.5
    { name: 'claude_mini', type: 'llm', enabled: !!CLAUDE_API_KEY },      // Haiku 4.5

    // Grok (2个)
    { name: 'grok_standard', type: 'llm', enabled: !!GROK_API_KEY },      // Grok 2
    { name: 'grok_mini', type: 'llm', enabled: !!GROK_API_KEY },          // Grok 2 mini

    // DeepSeek (1个)
    { name: 'deepseek_v3', type: 'llm', enabled: true },                  // DeepSeek V3 (AWS Bedrock)

    // Qwen (1个)
    { name: 'qwen3_235b', type: 'llm', enabled: true },                   // Qwen3 235B A22B (AWS Bedrock)

    // ETF基准 (2个)
    { name: 'gdlc', type: 'benchmark', enabled: true },                   // GDLC市值加权ETF基准
    { name: 'equal_weight', type: 'benchmark', enabled: true }            // BITW等权重ETF基准
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
        const portfolio = await getCurrentPortfolio(agent.name);
        console.log(`💰 ${agent.name} Portfolio:`, portfolio);

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
        await savePortfolio(newPortfolio);

        return {
            agent: agent.name,
            success: true,
            decision: decision,
            portfolio: newPortfolio
        };

    } catch (agentError) {
        console.error(`❌ ${agent.name} failed:`, agentError);
        return {
            agent: agent.name,
            success: false,
            error: agentError.message
        };
    }
}

// ============================================
// 1. 获取市场数据（使用 /coins/markets 端点获取更全面的数据）
// ============================================
async function fetchMarketData() {
    try {
        console.log(`🔑 COINGECKO_API_KEY: ${COINGECKO_API_KEY ? 'SET (len=' + COINGECKO_API_KEY.length + ')' : 'NOT SET'}`);
        const response = await fetch(
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

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();

        // 将数组转为对象映射
        const coinMap = {
            'bitcoin': 'BTC',
            'ethereum': 'ETH',
            'solana': 'SOL',
            'binancecoin': 'BNB',
            'dogecoin': 'DOGE',
            'ripple': 'XRP'
        };

        const marketData = {};

        for (const coin of data) {
            const symbol = coinMap[coin.id];
            if (!symbol) continue;

            marketData[symbol] = {
                // 基础价格数据
                price: coin.current_price,
                change_24h: coin.price_change_percentage_24h,
                volume_24h: coin.total_volume,
                market_cap: coin.market_cap,

                // 新增：市场地位数据
                market_cap_rank: coin.market_cap_rank,
                fully_diluted_valuation: coin.fully_diluted_valuation,

                // 新增：24h高低价
                high_24h: coin.high_24h,
                low_24h: coin.low_24h,

                // 新增：历史极值数据
                ath: coin.ath,  // 历史最高价
                ath_change_percentage: coin.ath_change_percentage,  // 距ATH的回撤百分比
                ath_date: coin.ath_date,
                atl: coin.atl,  // 历史最低价
                atl_change_percentage: coin.atl_change_percentage,  // 距ATL的涨幅百分比
                atl_date: coin.atl_date,

                // 新增：供应数据
                circulating_supply: coin.circulating_supply,
                total_supply: coin.total_supply,
                max_supply: coin.max_supply,

                // 新增：7天价格变化（如果有）
                price_change_percentage_7d: coin.price_change_percentage_7d_in_currency || null
            };
        }

        marketData.timestamp = new Date().toISOString();

        console.log('📊 Market data fetched with extended fields (ATH/ATL, supply, rankings)');
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
// 1.1 获取历史OHLC数据（过去7天）
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
                // 获取过去7天的OHLC数据（vs_currency=usd, days=7）
                console.log(`🔑 [${symbol}] Fetching OHLC with API Key: ${COINGECKO_API_KEY ? 'YES' : 'NO'}`);
                const response = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=7`,
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
// 1.2 计算技术指标
// ============================================
function calculateTechnicalIndicators(ohlcData) {
    try {
        if (!ohlcData || ohlcData.length === 0) {
            return null;
        }

        // 提取收盘价序列（用于RSI、MACD、MA计算）
        const closePrices = ohlcData.map(candle => candle.close);
        const highPrices = ohlcData.map(candle => candle.high);
        const lowPrices = ohlcData.map(candle => candle.low);

        // 需要至少14个数据点才能计算RSI(14)
        if (closePrices.length < 14) {
            console.warn(`Insufficient data for indicators: ${closePrices.length} < 14`);
            return null;
        }

        // 1. RSI(14) - 相对强弱指数
        const rsiValues = RSI.calculate({
            values: closePrices,
            period: 14
        });
        const currentRSI = rsiValues[rsiValues.length - 1];

        // 2. MACD(12,26,9) - 趋势指标
        const macdValues = MACD.calculate({
            values: closePrices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });
        const currentMACD = macdValues[macdValues.length - 1];

        // 3. 移动平均线 MA(7) 和 MA(25)
        const ma7Values = SMA.calculate({
            values: closePrices,
            period: 7
        });
        const ma7 = ma7Values[ma7Values.length - 1];

        // MA(25)需要至少25个数据点
        let ma25 = null;
        if (closePrices.length >= 25) {
            const ma25Values = SMA.calculate({
                values: closePrices,
                period: 25
            });
            ma25 = ma25Values[ma25Values.length - 1];
        }

        // 4. 布林带 Bollinger Bands(20,2)
        let bollingerBands = null;
        if (closePrices.length >= 20) {
            const bbValues = BollingerBands.calculate({
                values: closePrices,
                period: 20,
                stdDev: 2
            });
            const currentBB = bbValues[bbValues.length - 1];
            bollingerBands = {
                upper: currentBB.upper,
                middle: currentBB.middle,
                lower: currentBB.lower
            };
        }

        return {
            rsi: currentRSI || null,
            macd: currentMACD ? {
                value: currentMACD.MACD,
                signal: currentMACD.signal,
                histogram: currentMACD.histogram
            } : null,
            ma7: ma7 || null,
            ma25: ma25,
            bollinger: bollingerBands
        };
    } catch (error) {
        console.error('Failed to calculate technical indicators:', error);
        return null;
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
// 2.5 检查并处理ETF分红再投资
// ============================================
async function checkAndReinvestDividends(portfolio, ticker) {
    try {
        const sharesKey = `${ticker}_SHARES`;
        const lastDivCheckKey = `${ticker}_LAST_DIV_CHECK`;

        // 检查是否持有该ETF
        if (!portfolio.holdings[sharesKey] || portfolio.holdings[sharesKey] <= 0) {
            return null;
        }

        const currentShares = portfolio.holdings[sharesKey];
        const lastCheckTimestamp = portfolio.holdings[lastDivCheckKey] || 0;

        // 获取分红历史（yahoo-finance2 v3 API）
        // 注意：yahoo-finance2 的 quoteSummary 或 chart 可能提供分红数据
        // 这里使用 quoteSummary 获取 dividendHistory 或 defaultKeyStatistics
        const quote = await yahooFinance.quoteSummary(ticker, {
            modules: ['summaryDetail', 'defaultKeyStatistics']
        });

        // 检查是否有分红率数据
        const dividendYield = quote.summaryDetail?.dividendYield;
        const dividendRate = quote.summaryDetail?.dividendRate; // 年度分红金额

        if (!dividendRate || dividendRate === 0) {
            console.log(`📊 ${ticker}: 无分红数据或分红为0`);
            return null;
        }

        // 计算自上次检查以来的时间（小时）
        const nowTimestamp = Date.now();
        const hoursSinceLastCheck = (nowTimestamp - lastCheckTimestamp) / (1000 * 3600);

        // 模拟分红发放：假设按季度发放（每90天）
        // 如果自上次检查已过90天，则认为有一次分红
        const DIVIDEND_FREQUENCY_DAYS = 90;
        const daysSinceLastCheck = hoursSinceLastCheck / 24;

        if (daysSinceLastCheck < DIVIDEND_FREQUENCY_DAYS && lastCheckTimestamp > 0) {
            // 距离上次检查不足90天，无新分红
            return null;
        }

        // 有新分红！计算分红金额
        // dividendRate 是年度分红，季度分红 = dividendRate / 4
        const quarterlyDividendPerShare = dividendRate / 4;
        const totalDividend = quarterlyDividendPerShare * currentShares;

        if (totalDividend < 0.01) {
            console.log(`📊 ${ticker}: 分红金额过小 ($${totalDividend.toFixed(4)})，忽略`);
            return null;
        }

        console.log(`💰 ${ticker} 分红事件: ${currentShares.toFixed(2)}股 × $${quarterlyDividendPerShare.toFixed(4)}/股 = $${totalDividend.toFixed(2)}`);

        // 获取当前股价用于再投资
        const currentQuote = await yahooFinance.quote(ticker);
        const currentPrice = currentQuote.regularMarketPrice;

        if (!currentPrice || currentPrice <= 0) {
            throw new Error(`Invalid current price for ${ticker}`);
        }

        // 返回分红再投资决策
        return {
            action: 'dividend_reinvest',
            ticker: ticker,
            dividend_amount: totalDividend,
            current_price: currentPrice,
            shares_to_buy: totalDividend / currentPrice,
            current_shares: currentShares,
            dividend_per_share: quarterlyDividendPerShare,
            reason: `${ticker}季度分红 $${quarterlyDividendPerShare.toFixed(4)}/股，自动再投资购买 ${(totalDividend / currentPrice).toFixed(4)} 股`,
            timestamp: nowTimestamp
        };

    } catch (error) {
        console.error(`Failed to check dividends for ${ticker}:`, error);
        // 分红检查失败不影响主流程，返回null
        return null;
    }
}

// ============================================
// 3. 基准策略决策函数
// ============================================
async function getBenchmarkDecision(benchmarkName, marketData, portfolio) {
    // 基准策略：追踪真实ETF价格（Buy and Hold）
    // 只在初始状态时买入ETF份额，之后持有不动

    const isInitialState = portfolio.cash === 50000 && Object.keys(portfolio.holdings).length === 0;

    if (!isInitialState) {
        // 非初始状态：检查是否有分红需要再投资
        const ticker = benchmarkName === 'gdlc' ? 'GDLC' : 'BITW';
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
/**
 * 带超时和重试的fetch封装
 * @param {string} url - API URL
 * @param {object} options - fetch options
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @param {string} modelName - 模型名称（用于日志）
 * @param {number} maxAttempts - 最大尝试次数（默认2次=重试1次）
 * @returns {Promise<Response>}
 */
async function fetchWithTimeoutAndRetry(url, options, timeoutMs, modelName, maxAttempts = 2) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            console.log(`[${modelName}] Attempt ${attempt}/${maxAttempts} - Timeout: ${timeoutMs}ms`);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;

        } catch (error) {
            lastError = error;

            if (error.name === 'AbortError') {
                console.error(`[${modelName}] Attempt ${attempt}/${maxAttempts} - Timeout after ${timeoutMs}ms`);

                // 如果还有重试机会，立即重试
                if (attempt < maxAttempts) {
                    console.log(`[${modelName}] Retrying immediately...`);
                    continue;
                }
            } else {
                // 非超时错误，直接抛出不重试
                console.error(`[${modelName}] Attempt ${attempt}/${maxAttempts} - Error:`, error.message);
                throw error;
            }
        }
    }

    // 所有尝试都失败，抛出最后一个错误
    throw lastError;
}

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
1. 你只能交易 BTC, ETH, SOL, BNB, DOGE, XRP（对标Alpha Arena比赛币种，现货交易无杠杆）
2. 单笔交易不超过总资产的 30%
3. 单笔交易至少 $10（低于此金额不交易）
4. 必须保留至少 20% 现金
5. 每笔交易收取 0.1% 手续费
6. **你可以在一次决策中同时操作多个币种**（例如：卖出BTC的同时买入SOL）

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
// 4.2 通用决策格式解析和验证
// ============================================
function parseAndValidateDecision(text, modelName) {
    // 提取 JSON（可能被markdown包裹）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error(`[${modelName}] No JSON found in response. First 500 chars:`, text.substring(0, 500));
        throw new Error(`${modelName} response is not valid JSON`);
    }

    let decision;
    try {
        decision = JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error(`[${modelName}] JSON parse error:`, error.message);
        console.error(`[${modelName}] Raw JSON string (first 500 chars):`, jsonMatch[0].substring(0, 500));
        throw error;
    }

    // 验证决策格式（支持单笔和多笔两种格式）
    if (decision.actions) {
        // 多笔交易格式
        if (!Array.isArray(decision.actions) || decision.actions.length === 0) {
            throw new Error('Invalid multi-asset decision: actions must be non-empty array');
        }
        // 验证每笔交易
        for (const trade of decision.actions) {
            if (!trade.action || !['buy', 'sell', 'hold'].includes(trade.action)) {
                throw new Error(`Invalid action in multi-asset decision: ${trade.action}`);
            }
        }
        console.log(`🔄 [${modelName}] Multi-asset decision: ${decision.actions.length} trades`);
        return decision;
    } else {
        // 单笔交易格式
        if (!decision.action || !['buy', 'sell', 'hold'].includes(decision.action)) {
            throw new Error('Invalid decision action');
        }
        return decision;
    }
}

// ============================================
// 5. LLM API 路由函数
// ============================================
async function askLLM(agentName, marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    switch (agentName) {
        // OpenAI
        case 'openai_standard':
            return await askOpenAI(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, 'gpt-4.1');
        case 'openai_mini':
            return await askOpenAI(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, 'gpt-4o-mini');

        // Gemini
        case 'gemini_flash':
            return await askGeminiFlashProxy(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);
        case 'gemini_pro':
            return await askGeminiPro(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

        // Claude
        case 'claude_standard':
            return await askClaude(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, 'claude-sonnet-4-5-20250929');
        case 'claude_mini':
            return await askClaude(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, 'claude-haiku-4-5');

        // Grok
        case 'grok_standard':
            return await askGrok(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, 'grok-4-0709');
        case 'grok_mini':
            return await askGrok(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, 'grok-3-mini');

        // DeepSeek
        case 'deepseek_v3':
            return await askDeepSeekV3Bedrock(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

        // Qwen
        case 'qwen3_235b':
            return await askQwen3Bedrock(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

        default:
            throw new Error(`Unknown agent: ${agentName}`);
    }
}

// ============================================
// 3.1 调用 Gemini API 获取决策
// ============================================

// Gemini API (支持多个模型)
async function askGemini(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, model = 'gemini-2.5-flash') {
    // 轻量级Flash：60秒超时，不重试，使用多资产prompt
    const timeoutMs = 60000;
    const maxAttempts = 1;
    const modelDisplayName = 'Gemini 2.5 Flash';

    const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

    try {
        const response = await fetchWithTimeoutAndRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
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
                        maxOutputTokens: 8000  // 增加token限制以容纳思考tokens（Gemini 2.0 Thinking可能需要更多）
                    }
                })
            },
            timeoutMs,
            modelDisplayName,
            maxAttempts
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

        return parseAndValidateDecision(text, modelDisplayName);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[${modelDisplayName}] API timeout after ${maxAttempts} attempt(s)`);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API超时，保持持有'
            };
        } else {
            console.error(`[${modelDisplayName}] API failed:`, error);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API调用失败，保持持有'
            };
        }
    }
}

// ============================================
// 3.1.1 调用 Gemini Pro API (通过代理商)
// ============================================
async function askGeminiPro(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    // 旗舰型Pro：120秒超时，重试1次，使用多资产prompt
    const timeoutMs = 120000;
    const maxAttempts = 2;
    const modelDisplayName = 'Gemini 2.5 Pro';

    const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

    try {
        // 使用代理商的OpenAI兼容API调用Gemini Pro（旗舰型120秒超时，重试1次）
        const response = await fetchWithTimeoutAndRetry(
            'https://api.gptsapi.net/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GEMINI_PRO_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gemini-2.5-pro',  // 代理商提供的模型名称
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            },
            timeoutMs,
            modelDisplayName,
            maxAttempts
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini Pro API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        return parseAndValidateDecision(content, modelDisplayName);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[${modelDisplayName}] API timeout after ${maxAttempts} attempt(s) (120s each)`);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API超时（2次重试均失败），保持持有'
            };
        } else {
            console.error(`[${modelDisplayName}] API failed:`, error);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API调用失败，保持持有'
            };
        }
    }
}

// Gemini Flash (通过代理商API)
async function askGeminiFlashProxy(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    // 轻量级Flash：60秒超时，不重试，使用多资产prompt
    const timeoutMs = 60000;
    const maxAttempts = 1;
    const modelDisplayName = 'Gemini 2.5 Flash';

    const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

    try {
        // 使用代理商的OpenAI兼容API调用Gemini Flash（轻量级60秒超时，不重试）
        const response = await fetchWithTimeoutAndRetry(
            'https://api.gptsapi.net/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GEMINI_FLASH_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',  // 代理商提供的模型名称
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            },
            timeoutMs,
            modelDisplayName,
            maxAttempts
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini Flash API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        return parseAndValidateDecision(content, modelDisplayName);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[${modelDisplayName}] API timeout after ${maxAttempts} attempt(s) (60s each)`);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API超时，保持持有'
            };
        } else {
            console.error(`[${modelDisplayName}] API failed:`, error);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API调用失败，保持持有'
            };
        }
    }
}

// ============================================
// 3.1.2 调用 DeepSeek V3 API (通过 AWS Bedrock)
// ============================================
async function askDeepSeekV3Bedrock(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);
    const modelDisplayName = 'DeepSeek V3 (Bedrock)';

    try {
        console.log(`[${modelDisplayName}] Invoking Bedrock model: deepseek.v3-v1:0`);

        // 构建 Bedrock API 请求体
        const requestBody = {
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4000
        };

        const command = new InvokeModelCommand({
            modelId: 'deepseek.v3-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody)
        });

        // Bedrock 默认超时为300秒，比代理商的60秒长得多
        const response = await bedrockClient.send(command);

        // 解析响应
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const content = responseBody.choices[0].message.content;

        console.log(`[${modelDisplayName}] Response received successfully`);

        return parseAndValidateDecision(content, modelDisplayName);

    } catch (error) {
        console.error(`[${modelDisplayName}] API failed:`, error);
        return {
            action: 'hold',
            asset: null,
            amount: 0,
            reason: 'API调用失败，保持持有'
        };
    }
}

// ============================================
// 3.1.3 调用 Qwen3 235B API (通过 AWS Bedrock)
// ============================================
async function askQwen3Bedrock(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData) {
    const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);
    const modelDisplayName = 'Qwen3 235B (Bedrock)';

    try {
        console.log(`[${modelDisplayName}] Invoking Bedrock model: qwen.qwen3-235b-a22b-2507-v1:0`);

        // 构建 Bedrock API 请求体
        const requestBody = {
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4000
        };

        const command = new InvokeModelCommand({
            modelId: 'qwen.qwen3-235b-a22b-2507-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody)
        });

        // Bedrock 默认超时为300秒
        const response = await bedrockClient.send(command);

        // 解析响应（OpenAI兼容格式）
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const content = responseBody.choices[0].message.content;

        console.log(`[${modelDisplayName}] Response received successfully`);

        return parseAndValidateDecision(content, modelDisplayName);

    } catch (error) {
        console.error(`[${modelDisplayName}] API failed:`, error);
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
async function askClaude(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, model = 'claude-haiku-4-5') {
    // 判断是旗舰型还是轻量级
    const isFlagship = model === 'claude-sonnet-4-5-20250929';
    const timeoutMs = isFlagship ? 120000 : 60000;  // 旗舰120s, 轻量60s
    const maxAttempts = isFlagship ? 2 : 1;  // 旗舰重试1次, 轻量不重试
    const modelDisplayName = isFlagship ? 'Sonnet 4.5' : 'Haiku 4.5';

    // 所有Claude模型都使用多资产交易prompt
    const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

    try {
        const response = await fetchWithTimeoutAndRetry(
            'https://api.anthropic.com/v1/messages',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 2000,
                    temperature: 0.7,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            },
            timeoutMs,
            modelDisplayName,
            maxAttempts
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

        return parseAndValidateDecision(text, modelDisplayName);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[${modelDisplayName}] API timeout after ${maxAttempts} attempt(s)`);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: `API超时（${maxAttempts}次尝试均失败），保持持有`
            };
        } else {
            console.error(`[${modelDisplayName}] API failed:`, error);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API调用失败，保持持有'
            };
        }
    }
}

// ============================================
// 3.3 调用 Grok API 获取决策
// ============================================
async function askGrok(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, model = 'grok-2-mini-1212') {
    // 判断是旗舰型还是轻量级
    const isFlagship = model === 'grok-4-0709';
    const timeoutMs = isFlagship ? 120000 : 60000;  // 旗舰120s, 轻量60s
    const maxAttempts = isFlagship ? 2 : 1;  // 旗舰重试1次, 轻量不重试
    const modelDisplayName = isFlagship ? 'Grok 4' : 'Grok 3 mini';

    // 所有Grok模型都使用多资产交易prompt
    const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

    try {
        const response = await fetchWithTimeoutAndRetry(
            'https://api.x.ai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROK_API_KEY}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            },
            timeoutMs,
            modelDisplayName,
            maxAttempts
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

        return parseAndValidateDecision(text, modelDisplayName);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[${modelDisplayName}] API timeout after ${maxAttempts} attempt(s)`);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: `API超时（${maxAttempts}次尝试均失败），保持持有`
            };
        } else {
            console.error(`[${modelDisplayName}] API failed:`, error);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API调用失败，保持持有'
            };
        }
    }
}

// ============================================
// 3.4 调用 OpenAI API 获取决策
// ============================================
async function askOpenAI(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData, model = 'gpt-4o-mini') {
    // 判断是旗舰型还是轻量级
    const isFlagship = model === 'gpt-4.1';
    const timeoutMs = isFlagship ? 120000 : 60000;  // 旗舰120s, 轻量60s
    const maxAttempts = isFlagship ? 2 : 1;  // 旗舰重试1次, 轻量不重试
    const modelDisplayName = isFlagship ? 'GPT-4.1' : 'GPT-4o mini';

    // 所有OpenAI模型都使用多资产交易prompt
    const prompt = buildMultiAssetTradingPrompt(marketData, globalMarketData, portfolio, historicalData, technicalIndicators, newsData);

    try {
        // 构建请求体，GPT-4.1和GPT-4o mini都使用标准配置
        const requestBody = {
            model: model,
            messages: [{
                role: 'user',
                content: prompt
            }],
            temperature: 0.7,
            max_tokens: 2000
        };

        const response = await fetchWithTimeoutAndRetry(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify(requestBody)
            },
            timeoutMs,
            modelDisplayName,
            maxAttempts
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

        return parseAndValidateDecision(text, modelDisplayName);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[${modelDisplayName}] API timeout after ${maxAttempts} attempt(s)`);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: `API超时（${maxAttempts}次尝试均失败），保持持有`
            };
        } else {
            console.error(`[${modelDisplayName}] API failed:`, error);
            return {
                action: 'hold',
                asset: null,
                amount: 0,
                reason: 'API调用失败，保持持有'
            };
        }
    }
}

// ============================================
// 4. 模拟交易执行
// ============================================
async function simulateTrade(portfolio, decision, marketData) {
    const TRADING_FEE_RATE = 0.001; // 0.1% 手续费（对标 Binance）
    const MIN_TRADE_VALUE = 10; // 最小交易金额 $10（对标交易所门槛）

    const newPortfolio = JSON.parse(JSON.stringify(portfolio)); // 深拷贝

    // 基准策略Buy & Hold：decision为null时，只更新portfolio不做交易
    if (decision === null || decision.action === 'hold') {
        // 只更新total_value（根据当前市场价格或ETF价格）
        newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
        newPortfolio.pnl = newPortfolio.total_value - 50000;
        newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;
        return newPortfolio;
    }

    // 处理基准策略的ETF买入
    if (decision.action === 'buy_etf') {
        const ticker = decision.ticker;
        const pricePerShare = decision.price;

        // 计算可买入份额（扣除手续费）
        const availableCash = newPortfolio.cash / (1 + TRADING_FEE_RATE);
        const shares = availableCash / pricePerShare;
        const cost = shares * pricePerShare;
        const fee = cost * TRADING_FEE_RATE;
        const totalCost = cost + fee;

        // 存储ETF份额（使用特殊键名）
        const etfKey = `${ticker}_SHARES`;
        newPortfolio.holdings[etfKey] = shares;
        newPortfolio.holdings[`${ticker}_INIT_PRICE`] = pricePerShare;  // 记录初始价格用于追踪
        newPortfolio.holdings[`${ticker}_LAST_DIV_CHECK`] = Date.now();  // 初始化分红检查时间戳
        newPortfolio.cash -= totalCost;

        console.log(`📊 Buy ETF ${ticker}: ${shares.toFixed(2)} shares at $${pricePerShare.toFixed(2)}/share, cost $${cost.toFixed(2)}, fee $${fee.toFixed(2)}, total $${totalCost.toFixed(2)}`);

        // 计算新的总价值（初始买入时，价值就是成本）
        newPortfolio.total_value = cost;  // 不包含手续费（已损失）
        newPortfolio.pnl = newPortfolio.total_value - 50000;
        newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;

        return newPortfolio;
    }

    // 处理ETF分红再投资
    if (decision.action === 'dividend_reinvest') {
        const ticker = decision.ticker;
        const dividendAmount = decision.dividend_amount;
        const currentPrice = decision.current_price;
        const newShares = decision.shares_to_buy;

        // 分红直接转为新股份，无需现金交易（分红已直接再投资）
        const sharesKey = `${ticker}_SHARES`;
        const lastDivCheckKey = `${ticker}_LAST_DIV_CHECK`;

        newPortfolio.holdings[sharesKey] += newShares;
        newPortfolio.holdings[lastDivCheckKey] = decision.timestamp;  // 更新分红检查时间戳

        console.log(`💰 Dividend Reinvest ${ticker}: $${dividendAmount.toFixed(2)} dividend → ${newShares.toFixed(4)} shares at $${currentPrice.toFixed(2)}/share`);
        console.log(`📊 ${ticker} 总持仓: ${decision.current_shares.toFixed(4)} + ${newShares.toFixed(4)} = ${newPortfolio.holdings[sharesKey].toFixed(4)} 股`);

        // 计算新的总价值
        newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
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
        newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
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

        // 检查是否有持仓可以卖出
        if (currentHolding === 0) {
            console.warn(`⚠️ Cannot sell ${asset}: No holdings. Converting to HOLD.`);
            // 转为持有，只更新总价值
            newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
            newPortfolio.pnl = newPortfolio.total_value - 50000;
            newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;
            return newPortfolio;
        }

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
    newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
    newPortfolio.pnl = newPortfolio.total_value - 50000;
    newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;

    return newPortfolio;
}

// 计算总资产价值（支持ETF和加密货币）
async function calculateTotalValue(portfolio, marketData) {
    let total = portfolio.cash;

    for (const asset of Object.keys(portfolio.holdings)) {
        const amount = portfolio.holdings[asset];

        // 检查是否是ETF份额
        if (asset.endsWith('_SHARES')) {
            const ticker = asset.replace('_SHARES', '');
            try {
                const quote = await yahooFinance.quote(ticker);
                const currentPrice = quote.regularMarketPrice;
                if (currentPrice) {
                    total += amount * currentPrice;
                    console.log(`📊 ETF ${ticker}: ${amount.toFixed(2)} shares × $${currentPrice.toFixed(2)} = $${(amount * currentPrice).toFixed(2)}`);
                }
            } catch (error) {
                console.error(`Failed to get ${ticker} price for valuation:`, error);
                // 降级：使用初始价格
                const initPriceKey = `${ticker}_INIT_PRICE`;
                const initPrice = portfolio.holdings[initPriceKey] || 0;
                total += amount * initPrice;
                console.warn(`⚠️ Using init price for ${ticker}: $${initPrice.toFixed(2)}`);
            }
        }
        // 跳过ETF元数据字段
        else if (asset.endsWith('_INIT_PRICE') || asset.endsWith('_LAST_DIV_CHECK')) {
            continue;
        }
        // 加密货币持仓
        else {
            const price = marketData[asset]?.price || 0;
            total += amount * price;
        }
    }

    return total;
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
