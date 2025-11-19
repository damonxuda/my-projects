// Lambda Trading Shared Module: Decision Parser
// 用途：解析和验证 LLM 返回的交易决策
// 特点：支持单笔和多笔交易两种格式，适用于任何资产类型

// ============================================
// 解析并验证决策
// ============================================
export function parseAndValidateDecision(text, options = {}) {
    const {
        modelName = 'LLM',
        availableAssets = null,  // 可选：限制可交易的资产列表
        allowHold = true,        // 是否允许 hold 决策
        requireAmount = true     // buy/sell 是否必须提供 amount
    } = options;

    try {
        // 提取 JSON（可能被 markdown 包裹）
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error(`[${modelName}] No JSON found in response. First 500 chars:`, text.substring(0, 500));
            throw new Error(`${modelName} response does not contain valid JSON`);
        }

        let decision;
        try {
            decision = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.error(`[${modelName}] JSON parse error:`, parseError.message);
            console.error(`[${modelName}] Raw JSON string (first 500 chars):`, jsonMatch[0].substring(0, 500));
            throw parseError;
        }

        // 验证决策格式（支持单笔和多笔）
        if (decision.actions) {
            // 多笔交易格式
            return validateMultiTradeDecision(decision, { modelName, availableAssets, allowHold, requireAmount });
        } else {
            // 单笔交易格式
            return validateSingleTradeDecision(decision, { modelName, availableAssets, allowHold, requireAmount });
        }

    } catch (error) {
        console.error(`[${modelName}] Decision parsing failed:`, error.message);
        throw error;
    }
}

// ============================================
// 验证单笔交易决策
// ============================================
function validateSingleTradeDecision(decision, options) {
    const { modelName, availableAssets, allowHold, requireAmount } = options;

    // 验证 action
    if (!decision.action) {
        throw new Error('Decision missing required field: action');
    }

    const validActions = allowHold ? ['buy', 'sell', 'hold'] : ['buy', 'sell'];
    if (!validActions.includes(decision.action)) {
        throw new Error(`Invalid action: ${decision.action}. Must be one of: ${validActions.join(', ')}`);
    }

    // hold 不需要验证 asset 和 amount
    if (decision.action === 'hold') {
        console.log(`✅ [${modelName}] Valid HOLD decision`);
        return decision;
    }

    // 验证 asset
    if (!decision.asset) {
        throw new Error('Buy/Sell decision missing required field: asset');
    }

    if (availableAssets && !availableAssets.includes(decision.asset)) {
        throw new Error(`Invalid asset: ${decision.asset}. Available: ${availableAssets.join(', ')}`);
    }

    // 验证 amount
    if (requireAmount) {
        if (typeof decision.amount !== 'number' || decision.amount <= 0) {
            throw new Error(`Invalid amount: ${decision.amount}. Must be positive number`);
        }
    }

    // 验证 reason（可选但推荐）
    if (!decision.reason) {
        console.warn(`[${modelName}] Decision missing optional field: reason`);
    }

    console.log(`✅ [${modelName}] Valid ${decision.action.toUpperCase()} decision: ${decision.amount} ${decision.asset}`);
    return decision;
}

// ============================================
// 验证多笔交易决策
// ============================================
function validateMultiTradeDecision(decision, options) {
    const { modelName, availableAssets, allowHold, requireAmount } = options;

    // 验证 actions 是数组
    if (!Array.isArray(decision.actions)) {
        throw new Error('Multi-trade decision: actions must be an array');
    }

    if (decision.actions.length === 0) {
        throw new Error('Multi-trade decision: actions array is empty');
    }

    // 验证每笔交易
    for (let i = 0; i < decision.actions.length; i++) {
        const trade = decision.actions[i];
        try {
            validateSingleTradeDecision(trade, {
                modelName: `${modelName}[${i}]`,
                availableAssets,
                allowHold,
                requireAmount
            });
        } catch (error) {
            throw new Error(`Invalid trade at index ${i}: ${error.message}`);
        }
    }

    console.log(`✅ [${modelName}] Valid multi-trade decision: ${decision.actions.length} trades`);
    return decision;
}

// ============================================
// 快速检查：决策是否为 HOLD
// ============================================
export function isHoldDecision(decision) {
    if (!decision) return false;

    // 单笔交易
    if (decision.action === 'hold') {
        return true;
    }

    // 多笔交易：所有都是 hold
    if (decision.actions) {
        return decision.actions.every(trade => trade.action === 'hold');
    }

    return false;
}

// ============================================
// 快速检查：决策是否包含买入
// ============================================
export function hasBuyAction(decision) {
    if (!decision) return false;

    // 单笔交易
    if (decision.action === 'buy') {
        return true;
    }

    // 多笔交易
    if (decision.actions) {
        return decision.actions.some(trade => trade.action === 'buy');
    }

    return false;
}

// ============================================
// 快速检查：决策是否包含卖出
// ============================================
export function hasSellAction(decision) {
    if (!decision) return false;

    // 单笔交易
    if (decision.action === 'sell') {
        return true;
    }

    // 多笔交易
    if (decision.actions) {
        return decision.actions.some(trade => trade.action === 'sell');
    }

    return false;
}

// ============================================
// 格式化决策为可读字符串
// ============================================
export function formatDecision(decision) {
    if (!decision) {
        return 'No decision';
    }

    // 单笔交易
    if (decision.action) {
        if (decision.action === 'hold') {
            return `HOLD${decision.reason ? `: ${decision.reason}` : ''}`;
        }
        return `${decision.action.toUpperCase()} ${decision.amount || '?'} ${decision.asset || '?'}${decision.reason ? ` - ${decision.reason}` : ''}`;
    }

    // 多笔交易
    if (decision.actions) {
        const trades = decision.actions.map((trade, i) => {
            if (trade.action === 'hold') {
                return `[${i + 1}] HOLD`;
            }
            return `[${i + 1}] ${trade.action.toUpperCase()} ${trade.amount || '?'} ${trade.asset || '?'}`;
        }).join('; ');

        return `${trades}${decision.overall_reason ? ` | Strategy: ${decision.overall_reason}` : ''}`;
    }

    return 'Invalid decision format';
}

// ============================================
// 提取所有交易动作（统一处理单笔和多笔）
// ============================================
export function extractActions(decision) {
    if (!decision) {
        return [];
    }

    // 多笔交易
    if (decision.actions) {
        return decision.actions;
    }

    // 单笔交易（转换为数组格式）
    if (decision.action) {
        return [decision];
    }

    return [];
}

// ============================================
// 合并多个决策（例如组合多个 agent 的决策）
// ============================================
export function mergeDecisions(decisions, strategy = 'majority') {
    if (!decisions || decisions.length === 0) {
        return null;
    }

    // TODO: 实现投票策略
    // - 'majority': 多数决
    // - 'consensus': 一致决
    // - 'weighted': 加权平均

    console.warn('mergeDecisions not yet fully implemented');
    return decisions[0];
}
