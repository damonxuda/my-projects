// Lambda Trading Shared Module: Portfolio Management
// 用途：投资组合管理逻辑（加密货币 + ETF）
// 特点：支持数据库操作、ETF管理费、分红再投资、交易模拟

import YahooFinance from 'yahoo-finance2';

// 实例化 YahooFinance（v3要求）
const yahooFinance = new YahooFinance();

// ============================================
// 1. 获取当前投资组合
// ============================================

/**
 * 从数据库获取 Agent 的最新投资组合
 * @param {string} agentName - Agent 名称
 * @param {object} dbClient - 数据库客户端（如 supabase）
 * @param {string} tableName - 表名（默认：llm_trading_portfolios）
 * @returns {Promise<object>} 投资组合对象
 */
export async function getCurrentPortfolio(agentName, dbClient, tableName = 'llm_trading_portfolios') {
    try {
        const { data, error } = await dbClient
            .from(tableName)
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
// 2. 扣除ETF每日管理费
// ============================================

/**
 * 扣除ETF的每日管理费（按持仓市值和持有时间计算）
 * @param {object} portfolio - 投资组合对象
 * @returns {Promise<{totalFeesDeducted: number, feeDetails: array}>}
 */
export async function deductDailyManagementFees(portfolio) {
    // ETF年度管理费率
    const ANNUAL_FEE_RATES = {
        'GDLC': 0.0059,  // 0.59% 年费
        'BITW': 0.0250   // 2.50% 年费
    };

    const HOURS_PER_DAY = 24;
    const DAYS_PER_YEAR = 365;

    let totalFeesDeducted = 0;
    const feeDetails = [];

    for (const ticker of Object.keys(ANNUAL_FEE_RATES)) {
        const sharesKey = `${ticker}_SHARES`;
        const lastFeeCheckKey = `${ticker}_LAST_FEE_CHECK`;

        // 检查是否持有该ETF
        if (!portfolio.holdings[sharesKey] || portfolio.holdings[sharesKey] <= 0) {
            continue;
        }

        const currentShares = portfolio.holdings[sharesKey];
        const lastFeeCheckTimestamp = portfolio.holdings[lastFeeCheckKey] || 0;
        const nowTimestamp = Date.now();

        // 计算自上次扣费以来的小时数
        let hoursSinceLastFee = 0;
        if (lastFeeCheckTimestamp === 0) {
            // 首次检查，按1小时计算（避免回溯扣费）
            hoursSinceLastFee = 1;
        } else {
            hoursSinceLastFee = (nowTimestamp - lastFeeCheckTimestamp) / (1000 * 3600);
        }

        // 计算应扣除的天数（小时转天数）
        const daysToCharge = hoursSinceLastFee / HOURS_PER_DAY;

        // 获取当前ETF价格
        try {
            const quote = await yahooFinance.quote(ticker);
            const currentPrice = quote.regularMarketPrice;

            if (!currentPrice || currentPrice <= 0) {
                console.warn(`⚠️ ${ticker}: 无法获取价格，跳过管理费扣除`);
                continue;
            }

            // 计算持仓市值
            const holdingValue = currentShares * currentPrice;

            // 计算管理费金额：持仓市值 × 年费率 × (天数 / 365)
            const annualFeeRate = ANNUAL_FEE_RATES[ticker];
            const feeAmount = holdingValue * annualFeeRate * (daysToCharge / DAYS_PER_YEAR);

            if (feeAmount > 0.01) {
                // 从现金中扣除管理费
                portfolio.cash -= feeAmount;
                totalFeesDeducted += feeAmount;

                feeDetails.push({
                    ticker,
                    shares: currentShares,
                    price: currentPrice,
                    value: holdingValue,
                    annualRate: annualFeeRate,
                    daysCharged: daysToCharge,
                    feeAmount
                });

                console.log(`💳 ${ticker} 管理费: ${currentShares.toFixed(2)}股 × $${currentPrice.toFixed(2)} = $${holdingValue.toFixed(2)}, 费率 ${(annualFeeRate * 100).toFixed(2)}%/年 × ${daysToCharge.toFixed(2)}天 = -$${feeAmount.toFixed(2)}`);
            }

            // 更新最后扣费时间
            portfolio.holdings[lastFeeCheckKey] = nowTimestamp;

        } catch (error) {
            console.error(`Failed to deduct management fee for ${ticker}:`, error);
            continue;
        }
    }

    return {
        totalFeesDeducted,
        feeDetails
    };
}

// ============================================
// 3. 检查并处理ETF分红再投资
// ============================================

/**
 * 检查ETF是否有分红，并返回分红再投资决策
 * @param {object} portfolio - 投资组合对象
 * @param {string} ticker - ETF代码（如 'GDLC', 'BITW'）
 * @returns {Promise<object|null>} 分红再投资决策，或 null（无分红）
 */
export async function checkAndReinvestDividends(portfolio, ticker) {
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
        return null;
    }
}

// ============================================
// 4. 模拟交易执行
// ============================================

/**
 * 执行交易模拟（买入/卖出/持有），更新投资组合
 * @param {object} portfolio - 投资组合对象
 * @param {object} decision - 交易决策对象
 * @param {object} marketData - 市场数据（价格信息）
 * @returns {Promise<object>} 更新后的投资组合
 */
export async function simulateTrade(portfolio, decision, marketData) {
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
        const sharesRaw = availableCash / pricePerShare;

        // ⚠️ 美股ETF最小单位是1股（整数）
        const shares = Math.floor(sharesRaw);

        if (shares < 1) {
            console.warn(`⚠️ Cannot buy ${ticker}: insufficient cash for 1 share (need $${pricePerShare.toFixed(2)}, have $${availableCash.toFixed(2)})`);
            // 转为持有，只更新总价值
            newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
            newPortfolio.pnl = newPortfolio.total_value - 50000;
            newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;
            return newPortfolio;
        }

        const cost = shares * pricePerShare;
        const fee = cost * TRADING_FEE_RATE;
        const totalCost = cost + fee;

        // 存储ETF份额（使用特殊键名）
        const etfKey = `${ticker}_SHARES`;
        newPortfolio.holdings[etfKey] = shares;
        newPortfolio.holdings[`${ticker}_INIT_PRICE`] = pricePerShare;  // 记录初始价格用于追踪
        newPortfolio.holdings[`${ticker}_LAST_DIV_CHECK`] = Date.now();  // 初始化分红检查时间戳
        newPortfolio.holdings[`${ticker}_LAST_FEE_CHECK`] = Date.now();  // 初始化管理费检查时间戳
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
    let amount = decision.amount;

    // ⚠️ 美股最小单位是1股（整数）- 对美股进行向下取整
    // 加密货币保持小数（如 0.123 BTC）
    const isStock = asset && marketData[asset] && !asset.match(/^(BTC|ETH|SOL|XRP|DOGE|ADA|AVAX|DOT|MATIC|LINK|UNI|ATOM|LTC|BCH|XLM|ALGO|VET|FIL|HBAR|ICP|NEAR|APT|ARB|OP|RNDR|IMX|EGLD|RUNE|FTM|FLOW|KCS|MINA|AAVE|CRV|MKR|SNX|COMP|ZRX|BAL|SUSHI|YFI|UMA|LRC|ENJ|MANA|SAND|AXS|GALA|CHZ|1INCH)$/i);

    if (isStock) {
        amount = Math.floor(amount);
        if (amount < 1 && decision.action === 'buy') {
            console.warn(`⚠️ Cannot buy ${asset}: amount ${decision.amount} rounds down to 0 shares`);
            // 转为持有，只更新总价值
            newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
            newPortfolio.pnl = newPortfolio.total_value - 50000;
            newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;
            return newPortfolio;
        }
    }

    // 检查交易金额是否为0（模型已判断不可交易）
    if (amount === 0) {
        console.log(`⚠️ ${decision.action} ${asset} amount is 0, skipping trade: ${decision.reason}`);
        // 转为持有，只更新总价值
        newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
        newPortfolio.pnl = newPortfolio.total_value - 50000;
        newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;
        return newPortfolio;
    }

    // 检查资产是否在市场数据中
    if (!marketData[asset]) {
        console.warn(`⚠️ ${asset} not found in market data, converting to HOLD`);
        // 转为持有，只更新总价值
        newPortfolio.total_value = await calculateTotalValue(newPortfolio, marketData);
        newPortfolio.pnl = newPortfolio.total_value - 50000;
        newPortfolio.pnl_percentage = (newPortfolio.pnl / 50000) * 100;
        return newPortfolio;
    }

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

// ============================================
// 5. 计算总资产价值
// ============================================

/**
 * 计算投资组合的总价值（现金 + 持仓市值）
 * @param {object} portfolio - 投资组合对象
 * @param {object} marketData - 市场数据（加密货币价格）
 * @returns {Promise<number>} 总价值（美元）
 */
export async function calculateTotalValue(portfolio, marketData) {
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
        else if (asset.endsWith('_INIT_PRICE') || asset.endsWith('_LAST_DIV_CHECK') || asset.endsWith('_LAST_FEE_CHECK')) {
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
// 6. 保存投资组合到数据库
// ============================================

/**
 * 保存投资组合到数据库
 * @param {object} portfolio - 投资组合对象
 * @param {object} dbClient - 数据库客户端（如 supabase）
 * @param {string} tableName - 表名（默认：llm_trading_portfolios）
 * @returns {Promise<void>}
 */
export async function savePortfolio(portfolio, dbClient, tableName = 'llm_trading_portfolios') {
    try {
        const { error} = await dbClient
            .from(tableName)
            .insert({
                agent_name: portfolio.agent_name,
                cash: portfolio.cash,
                holdings: portfolio.holdings,
                total_value: portfolio.total_value,
                pnl: portfolio.pnl,
                pnl_percentage: portfolio.pnl_percentage,
                timestamp: portfolio.timestamp || new Date().toISOString()
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
