// Lambda Trading Shared Module: Utilities
// 用途：提供通用工具函数（retry, timeout, formatting 等）

// ============================================
// 带超时和重试的 fetch（已移到 llm-clients.mjs）
// 此处保留一个通用版本供其他用途使用
// ============================================
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ============================================
// 带重试的 fetch
// ============================================
export async function fetchWithRetry(url, options = {}, maxRetries = 3, retryDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            lastError = error;
            console.error(`Fetch attempt ${attempt}/${maxRetries} failed:`, error.message);

            if (attempt < maxRetries) {
                const backoff = retryDelay * attempt; // 递增退避
                console.log(`Retrying in ${backoff}ms...`);
                await sleep(backoff);
            }
        }
    }

    throw lastError;
}

// ============================================
// Sleep（Promise 版本）
// ============================================
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 清理 JSON 字符串（移除 markdown 标记等）
// ============================================
export function cleanJsonString(text) {
    if (!text) return text;

    // 移除 markdown 代码块标记
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // 移除前后空白
    cleaned = cleaned.trim();

    return cleaned;
}

// ============================================
// 格式化数字（带千分位分隔符）
// ============================================
export function formatNumber(num, decimals = 2) {
    if (typeof num !== 'number') return 'N/A';

    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// ============================================
// 格式化百分比
// ============================================
export function formatPercentage(value, decimals = 2) {
    if (typeof value !== 'number') return 'N/A';

    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
}

// ============================================
// 格式化货币
// ============================================
export function formatCurrency(amount, currency = 'USD', decimals = 2) {
    if (typeof amount !== 'number') return 'N/A';

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount);
}

// ============================================
// 计算百分比变化
// ============================================
export function calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
}

// ============================================
// 深拷贝对象
// ============================================
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// ============================================
// 安全地获取嵌套对象属性
// ============================================
export function safeGet(obj, path, defaultValue = null) {
    try {
        const keys = path.split('.');
        let result = obj;

        for (const key of keys) {
            if (result === null || result === undefined) {
                return defaultValue;
            }
            result = result[key];
        }

        return result !== undefined ? result : defaultValue;
    } catch (error) {
        return defaultValue;
    }
}

// ============================================
// 检查是否为有效数字
// ============================================
export function isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

// ============================================
// 限制数字范围
// ============================================
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// ============================================
// 生成随机字符串（用于 ID 等）
// ============================================
export function randomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ============================================
// 日期格式化（ISO 格式）
// ============================================
export function formatDate(date = new Date()) {
    return date.toISOString();
}

// ============================================
// 获取时间戳
// ============================================
export function getTimestamp() {
    return Date.now();
}

// ============================================
// 批量处理（分批执行异步任务）
// ============================================
export async function batchProcess(items, batchSize, processFn) {
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processFn));
        results.push(...batchResults);
    }

    return results;
}

// ============================================
// 并发限制器（限制同时运行的 Promise 数量）
// ============================================
export async function concurrentLimit(tasks, limit) {
    const results = [];
    const executing = [];

    for (const task of tasks) {
        const promise = Promise.resolve().then(() => task());
        results.push(promise);

        if (limit <= tasks.length) {
            const execute = promise.then(() => {
                executing.splice(executing.indexOf(execute), 1);
            });
            executing.push(execute);

            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }

    return Promise.all(results);
}

// ============================================
// 错误处理包装器
// ============================================
export function tryCatch(fn, fallback = null) {
    try {
        return fn();
    } catch (error) {
        console.error('tryCatch error:', error);
        return fallback;
    }
}

// ============================================
// 异步错误处理包装器
// ============================================
export async function tryCatchAsync(fn, fallback = null) {
    try {
        return await fn();
    } catch (error) {
        console.error('tryCatchAsync error:', error);
        return fallback;
    }
}

// ============================================
// 计时器（测量函数执行时间）
// ============================================
export async function measureTime(fn, label = 'Function') {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`⏱️ ${label} took ${duration}ms`);
    return result;
}

// ============================================
// 节流（Throttle）
// ============================================
export function throttle(fn, delay) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return fn(...args);
        }
    };
}

// ============================================
// 防抖（Debounce）
// ============================================
export function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
