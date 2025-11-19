// Lambda Trading Shared - Main Entry Point
// 用途：统一导出所有共享模块

// LLM Clients
export {
    callOpenAI,
    callGemini,
    callClaude,
    callGrok,
    callDeepSeekBedrock,
    callQwen3Bedrock,
    callLLM
} from './llm-clients.mjs';

// Technical Indicators
export {
    calculateAllIndicators,
    calculateRSI,
    calculateMACD,
    calculateSMA,
    calculateBollingerBands,
    formatIndicators
} from './technical-indicators.mjs';

// Decision Parser
export {
    parseAndValidateDecision,
    isHoldDecision,
    hasBuyAction,
    hasSellAction,
    formatDecision,
    extractActions,
    mergeDecisions
} from './decision-parser.mjs';

// Utilities
export {
    fetchWithTimeout,
    fetchWithRetry,
    sleep,
    cleanJsonString,
    formatNumber,
    formatPercentage,
    formatCurrency,
    calculatePercentageChange,
    deepClone,
    safeGet,
    isValidNumber,
    clamp,
    randomString,
    formatDate,
    getTimestamp,
    batchProcess,
    concurrentLimit,
    tryCatch,
    tryCatchAsync,
    measureTime,
    throttle,
    debounce
} from './utils.mjs';
