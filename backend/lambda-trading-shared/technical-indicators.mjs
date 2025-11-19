// Lambda Trading Shared Module: Technical Indicators
// 用途：计算各种技术指标（RSI, MACD, MA, Bollinger Bands 等）
// 特点：纯计算函数，适用于任何资产类型（crypto, stock, forex 等）

import { RSI, MACD, SMA, BollingerBands } from 'technicalindicators';

// ============================================
// 计算所有技术指标（基于 OHLC 数据）
// ============================================
export function calculateAllIndicators(ohlcData) {
    try {
        if (!ohlcData || ohlcData.length === 0) {
            console.warn('No OHLC data provided for technical indicators');
            return null;
        }

        // 提取价格序列
        const closePrices = ohlcData.map(candle => candle.close);
        const highPrices = ohlcData.map(candle => candle.high);
        const lowPrices = ohlcData.map(candle => candle.low);

        // 需要至少14个数据点才能计算RSI(14)
        if (closePrices.length < 14) {
            console.warn(`Insufficient data for indicators: ${closePrices.length} < 14 required`);
            return null;
        }

        // 计算各项指标
        const rsi = calculateRSI(closePrices);
        const macd = calculateMACD(closePrices);
        const ma7 = calculateSMA(closePrices, 7);
        const ma25 = closePrices.length >= 25 ? calculateSMA(closePrices, 25) : null;
        const bollinger = closePrices.length >= 20 ? calculateBollingerBands(closePrices, 20, 2) : null;

        return {
            rsi,
            macd,
            ma7,
            ma25,
            bollinger
        };
    } catch (error) {
        console.error('Failed to calculate technical indicators:', error);
        return null;
    }
}

// ============================================
// RSI - 相对强弱指数
// ============================================
export function calculateRSI(prices, period = 14) {
    try {
        if (prices.length < period) {
            console.warn(`Insufficient data for RSI(${period}): ${prices.length} < ${period}`);
            return null;
        }

        const rsiValues = RSI.calculate({
            values: prices,
            period: period
        });

        return rsiValues[rsiValues.length - 1] || null;
    } catch (error) {
        console.error('Failed to calculate RSI:', error);
        return null;
    }
}

// ============================================
// MACD - 平滑异同移动平均线
// ============================================
export function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    try {
        if (prices.length < slowPeriod) {
            console.warn(`Insufficient data for MACD: ${prices.length} < ${slowPeriod}`);
            return null;
        }

        const macdValues = MACD.calculate({
            values: prices,
            fastPeriod,
            slowPeriod,
            signalPeriod,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });

        const current = macdValues[macdValues.length - 1];

        if (!current) {
            return null;
        }

        return {
            value: current.MACD,
            signal: current.signal,
            histogram: current.histogram
        };
    } catch (error) {
        console.error('Failed to calculate MACD:', error);
        return null;
    }
}

// ============================================
// SMA - 简单移动平均线
// ============================================
export function calculateSMA(prices, period) {
    try {
        if (prices.length < period) {
            console.warn(`Insufficient data for SMA(${period}): ${prices.length} < ${period}`);
            return null;
        }

        const smaValues = SMA.calculate({
            values: prices,
            period: period
        });

        return smaValues[smaValues.length - 1] || null;
    } catch (error) {
        console.error(`Failed to calculate SMA(${period}):`, error);
        return null;
    }
}

// ============================================
// Bollinger Bands - 布林带
// ============================================
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
    try {
        if (prices.length < period) {
            console.warn(`Insufficient data for Bollinger Bands: ${prices.length} < ${period}`);
            return null;
        }

        const bbValues = BollingerBands.calculate({
            values: prices,
            period: period,
            stdDev: stdDev
        });

        const current = bbValues[bbValues.length - 1];

        if (!current) {
            return null;
        }

        return {
            upper: current.upper,
            middle: current.middle,
            lower: current.lower
        };
    } catch (error) {
        console.error('Failed to calculate Bollinger Bands:', error);
        return null;
    }
}

// ============================================
// EMA - 指数移动平均线（可选，未来扩展）
// ============================================
export function calculateEMA(prices, period) {
    // TODO: 使用 technicalindicators.EMA
    console.warn('EMA calculation not yet implemented');
    return null;
}

// ============================================
// ATR - 平均真实波幅（可选，未来扩展）
// ============================================
export function calculateATR(ohlcData, period = 14) {
    // TODO: 使用 technicalindicators.ATR
    console.warn('ATR calculation not yet implemented');
    return null;
}

// ============================================
// 工具函数：格式化技术指标为可读字符串
// ============================================
export function formatIndicators(indicators) {
    if (!indicators) {
        return 'No indicators available';
    }

    const parts = [];

    if (indicators.rsi !== null) {
        parts.push(`RSI: ${indicators.rsi.toFixed(2)}`);
    }

    if (indicators.macd) {
        parts.push(`MACD: ${indicators.macd.value.toFixed(2)}`);
        parts.push(`Signal: ${indicators.macd.signal.toFixed(2)}`);
        parts.push(`Histogram: ${indicators.macd.histogram.toFixed(2)}`);
    }

    if (indicators.ma7 !== null) {
        parts.push(`MA7: ${indicators.ma7.toFixed(2)}`);
    }

    if (indicators.ma25 !== null) {
        parts.push(`MA25: ${indicators.ma25.toFixed(2)}`);
    }

    if (indicators.bollinger) {
        parts.push(`BB Upper: ${indicators.bollinger.upper.toFixed(2)}`);
        parts.push(`BB Middle: ${indicators.bollinger.middle.toFixed(2)}`);
        parts.push(`BB Lower: ${indicators.bollinger.lower.toFixed(2)}`);
    }

    return parts.join(' | ');
}
