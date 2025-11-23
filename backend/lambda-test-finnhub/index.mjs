// 测试 Finnhub API 的 Lambda 函数
// 用途：验证 Finnhub API 是否正常工作，对比价格数据

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// 测试股票列表（与现有系统一致）
const TEST_SYMBOLS = [
    'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA',
    'META', 'AMZN', 'NFLX', 'AMD', 'AVGO',
    'QQQ', 'VGT', 'SPY'
];

/**
 * 从 Finnhub 获取单个股票报价
 */
async function getFinnhubQuote(symbol) {
    try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Finnhub 返回格式：
        // {
        //   c: 当前价格 (current price)
        //   h: 最高价 (high)
        //   l: 最低价 (low)
        //   o: 开盘价 (open)
        //   pc: 昨日收盘价 (previous close)
        //   t: 时间戳 (timestamp)
        // }

        return {
            symbol,
            success: true,
            price: data.c,
            open: data.o,
            high: data.h,
            low: data.l,
            previousClose: data.pc,
            change: data.c - data.pc,
            changePercent: ((data.c - data.pc) / data.pc * 100).toFixed(2),
            timestamp: data.t,
            datetime: new Date(data.t * 1000).toISOString(),
            raw: data
        };

    } catch (error) {
        console.error(`❌ ${symbol} 获取失败:`, error.message);
        return {
            symbol,
            success: false,
            error: error.message
        };
    }
}

/**
 * Lambda 入口函数
 */
export const handler = async (event) => {
    console.log('🚀 开始测试 Finnhub API...');
    console.log(`📅 测试时间: ${new Date().toISOString()}`);

    if (!FINNHUB_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'FINNHUB_API_KEY 环境变量未设置'
            })
        };
    }

    const results = [];
    const startTime = Date.now();

    // 串行获取所有股票数据（避免超过 60 次/分钟限制）
    for (const symbol of TEST_SYMBOLS) {
        const quote = await getFinnhubQuote(symbol);
        results.push(quote);

        // 打印日志
        if (quote.success) {
            console.log(`✅ ${quote.symbol}: $${quote.price?.toFixed(2)} (${quote.changePercent}%)`);
        } else {
            console.log(`❌ ${quote.symbol}: ${quote.error}`);
        }

        // 稍微延迟，避免触发速率限制（60次/分钟 = 1秒1次）
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 统计
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n📊 测试完成！`);
    console.log(`✅ 成功: ${successCount}/${TEST_SYMBOLS.length}`);
    console.log(`❌ 失败: ${failCount}/${TEST_SYMBOLS.length}`);
    console.log(`⏱️  耗时: ${duration}ms`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            message: 'Finnhub API 测试完成',
            summary: {
                total: TEST_SYMBOLS.length,
                success: successCount,
                failed: failCount,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            },
            results: results
        }, null, 2)
    };
};
