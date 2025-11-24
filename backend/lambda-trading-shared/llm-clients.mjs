// Lambda Trading Shared Module: LLM API Clients
// 用途：提供所有 LLM API 的统一调用接口
// 特点：纯 API 调用，不包含业务逻辑（prompt 构建、决策解析等）

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// ============================================
// 全局 Bedrock Client（复用连接，提升性能）
// ============================================
const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-1' });

// ============================================
// 工具函数：带超时和重试的 fetch
// ============================================
async function fetchWithTimeoutAndRetry(url, options, timeoutMs = 60000, modelName = 'LLM', maxAttempts = 2) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;

        } catch (error) {
            lastError = error;
            console.error(`[${modelName}] Attempt ${attempt}/${maxAttempts} failed:`, error.message);

            if (attempt < maxAttempts) {
                const backoffMs = attempt * 2000; // 递增退避
                console.log(`[${modelName}] Retrying in ${backoffMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
    }

    throw lastError;
}

// ============================================
// OpenAI API
// ============================================
export async function callOpenAI(prompt, options = {}) {
    const {
        apiKey,
        baseURL = 'https://api.openai.com/v1',  // 支持自定义 URL（代理商）
        model = 'gpt-4o-mini',
        temperature = 0.7,
        maxTokens = 2000,
        timeout = 60000,
        maxRetries = 1
    } = options;

    if (!apiKey) {
        throw new Error('OpenAI API key is required');
    }

    try {
        const response = await fetchWithTimeoutAndRetry(
            `${baseURL}/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: temperature,
                    max_tokens: maxTokens
                })
            },
            timeout,
            `OpenAI ${model}`,
            maxRetries
        );

        // 检查响应类型，防止解析 HTML 错误页面
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`OpenAI API returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(data)}`);
        }

        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response structure from OpenAI API');
        }

        return {
            text: data.choices[0].message.content,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            } : null
        };

    } catch (error) {
        console.error(`[OpenAI ${model}] API call failed:`, error);
        throw error;
    }
}

// ============================================
// Gemini API (Google)
// ============================================
export async function callGemini(prompt, options = {}) {
    const {
        apiKey,
        baseURL = 'https://generativelanguage.googleapis.com',  // 支持自定义 URL（代理商）
        model = 'gemini-2.0-flash-exp',
        temperature = 0.7,
        maxTokens = 8000,
        timeout = 60000,
        maxRetries = 1
    } = options;

    if (!apiKey) {
        throw new Error('Gemini API key is required');
    }

    try {
        const response = await fetchWithTimeoutAndRetry(
            `${baseURL}/v1beta/models/${model}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: temperature,
                        maxOutputTokens: maxTokens
                    }
                })
            },
            timeout,
            `Gemini ${model}`,
            maxRetries
        );

        // 检查响应类型，防止解析 HTML 错误页面
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Gemini API returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(data)}`);
        }

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response structure from Gemini API');
        }

        return {
            text: data.candidates[0].content.parts[0].text,
            usage: data.usageMetadata ? {
                promptTokens: data.usageMetadata.promptTokenCount,
                completionTokens: data.usageMetadata.candidatesTokenCount,
                thoughtsTokens: data.usageMetadata.thoughtsTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount
            } : null
        };

    } catch (error) {
        console.error(`[Gemini ${model}] API call failed:`, error);
        throw error;
    }
}

// ============================================
// Claude API (Anthropic)
// ============================================
export async function callClaude(prompt, options = {}) {
    const {
        apiKey,
        baseURL = 'https://api.anthropic.com/v1',  // 支持自定义 URL（代理商）
        model = 'claude-4.5-haiku-20250514',
        temperature = 0.7,
        maxTokens = 2000,
        timeout = 60000,
        maxRetries = 1
    } = options;

    if (!apiKey) {
        throw new Error('Claude API key is required');
    }

    try {
        const response = await fetchWithTimeoutAndRetry(
            `${baseURL}/messages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: maxTokens,
                    temperature: temperature,
                    messages: [{ role: 'user', content: prompt }]
                })
            },
            timeout,
            `Claude ${model}`,
            maxRetries
        );

        // 检查响应类型，防止解析 HTML 错误页面
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Claude API returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status} - ${JSON.stringify(data)}`);
        }

        if (!data.content?.[0]?.text) {
            throw new Error('Invalid response structure from Claude API');
        }

        return {
            text: data.content[0].text,
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens
            } : null
        };

    } catch (error) {
        console.error(`[Claude ${model}] API call failed:`, error);
        throw error;
    }
}

// ============================================
// Grok API (X.AI)
// ============================================
export async function callGrok(prompt, options = {}) {
    const {
        apiKey,
        baseURL = 'https://api.x.ai/v1',  // 支持自定义 URL（代理商）
        model = 'grok-2-1212',
        temperature = 0.7,
        maxTokens = 2000,
        timeout = 60000,
        maxRetries = 1
    } = options;

    if (!apiKey) {
        throw new Error('Grok API key is required');
    }

    try {
        const response = await fetchWithTimeoutAndRetry(
            `${baseURL}/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: temperature,
                    max_tokens: maxTokens
                })
            },
            timeout,
            `Grok ${model}`,
            maxRetries
        );

        // 检查响应类型，防止解析 HTML 错误页面
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Grok API returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Grok API error: ${response.status} - ${JSON.stringify(data)}`);
        }

        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response structure from Grok API');
        }

        return {
            text: data.choices[0].message.content,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            } : null
        };

    } catch (error) {
        console.error(`[Grok ${model}] API call failed:`, error);
        throw error;
    }
}

// ============================================
// DeepSeek API (AWS Bedrock)
// ============================================
export async function callDeepSeekBedrock(prompt, options = {}) {
    const {
        model = 'deepseek.v3-v1:0',
        temperature = 0.7,
        maxTokens = 2000
    } = options;

    try {
        const payload = {
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: temperature
        };

        const command = new InvokeModelCommand({
            modelId: model,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(payload)
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        if (!responseBody.choices?.[0]?.message?.content) {
            throw new Error('Invalid response structure from DeepSeek Bedrock');
        }

        return {
            text: responseBody.choices[0].message.content,
            usage: responseBody.usage ? {
                promptTokens: responseBody.usage.prompt_tokens,
                completionTokens: responseBody.usage.completion_tokens,
                totalTokens: responseBody.usage.total_tokens
            } : null
        };

    } catch (error) {
        console.error(`[DeepSeek Bedrock] API call failed:`, error);
        throw error;
    }
}

// ============================================
// Qwen3 API (AWS Bedrock)
// ============================================
export async function callQwen3Bedrock(prompt, options = {}) {
    const {
        model = 'qwen.qwen3-235b-a22b-2507-v1:0',
        temperature = 0.7,
        maxTokens = 2000
    } = options;

    try {
        const payload = {
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: temperature
        };

        const command = new InvokeModelCommand({
            modelId: model,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(payload)
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        if (!responseBody.choices?.[0]?.message?.content) {
            throw new Error('Invalid response structure from Qwen3 Bedrock');
        }

        return {
            text: responseBody.choices[0].message.content,
            usage: responseBody.usage ? {
                promptTokens: responseBody.usage.prompt_tokens,
                completionTokens: responseBody.usage.completion_tokens,
                totalTokens: responseBody.usage.total_tokens
            } : null
        };

    } catch (error) {
        console.error(`[Qwen3 Bedrock] API call failed:`, error);
        throw error;
    }
}

// ============================================
// 统一调用接口（可选）
// ============================================
export async function callLLM(provider, prompt, options = {}) {
    switch (provider.toLowerCase()) {
        case 'openai':
            return await callOpenAI(prompt, options);
        case 'gemini':
            return await callGemini(prompt, options);
        case 'claude':
            return await callClaude(prompt, options);
        case 'grok':
            return await callGrok(prompt, options);
        case 'deepseek':
        case 'deepseek-bedrock':
            return await callDeepSeekBedrock(prompt, options);
        case 'qwen':
        case 'qwen3':
        case 'qwen-bedrock':
            return await callQwen3Bedrock(prompt, options);
        default:
            throw new Error(`Unknown LLM provider: ${provider}`);
    }
}
