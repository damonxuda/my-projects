// Lambda Trading Shared Module: Agent Executor
// 用途：统一的 LLM Agent 执行框架，配置驱动，消除重复代码
// 特点：集中管理所有 Agent 配置，统一调用流程

import {
    callOpenAI,
    callGemini,
    callClaude,
    callGrok,
    callDeepSeekBedrock,
    callQwen3Bedrock
} from './llm-clients.mjs';
import { parseAndValidateDecision } from './decision-parser.mjs';

// ============================================
// Agent 配置集中管理
// ============================================

/**
 * 所有 LLM Agent 的配置
 * 每个 agent 包含：
 * - llmClient: LLM 客户端函数（来自 llm-clients.mjs）
 * - llmOptions: LLM 调用选项（model, temperature, maxTokens 等）
 * - displayName: 用于日志显示的名称
 */
export const AGENT_CONFIGS = {
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
            timeout: 300000
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
            timeout: 300000
        },
        displayName: 'Qwen3 235B'
    }
};

// ============================================
// 统一的 Agent 执行函数
// ============================================

/**
 * 执行 LLM Agent 决策
 *
 * @param {string} agentName - Agent 名称（如 'openai_standard', 'claude_mini'）
 * @param {Function} promptBuilder - Prompt 构建函数（返回 string）
 * @param {Object} apiKeys - API Key 映射对象 { agentName: apiKey }
 * @returns {Promise<{decision: Object, usage: Object|null}>}
 *
 * @example
 * const { decision, usage } = await executeAgent(
 *     'openai_standard',
 *     () => buildTradingPrompt(marketData, portfolio),
 *     { openai_standard: process.env.OPENAI_API_KEY }
 * );
 */
export async function executeAgent(agentName, promptBuilder, apiKeys) {
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

        // 5. 解析决策
        const decision = parseAndValidateDecision(result.text, displayName);

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
// 工具函数：获取 Agent 的显示名称
// ============================================

/**
 * 获取 Agent 的显示名称
 * @param {string} agentName - Agent 名称
 * @returns {string} 显示名称
 */
export function getAgentDisplayName(agentName) {
    const config = AGENT_CONFIGS[agentName];
    return config ? config.displayName : agentName;
}

// ============================================
// 工具函数：获取所有可用 Agent 名称
// ============================================

/**
 * 获取所有配置的 Agent 名称列表
 * @returns {string[]} Agent 名称数组
 */
export function getAllAgentNames() {
    return Object.keys(AGENT_CONFIGS);
}

// ============================================
// 工具函数：验证 Agent 是否存在
// ============================================

/**
 * 检查 Agent 是否存在于配置中
 * @param {string} agentName - Agent 名称
 * @returns {boolean}
 */
export function isValidAgent(agentName) {
    return agentName in AGENT_CONFIGS;
}
