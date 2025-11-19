// Quick test script for shared modules
import { calculateAllIndicators, formatIndicators } from './technical-indicators.mjs';
import { parseAndValidateDecision, formatDecision } from './decision-parser.mjs';
import { formatCurrency, formatPercentage } from './utils.mjs';

console.log('🧪 Testing Lambda Trading Shared Modules\n');

// Test 1: Technical Indicators
console.log('=== Test 1: Technical Indicators ===');
const mockOHLC = [
    { open: 100, high: 105, low: 98, close: 102 },
    { open: 102, high: 108, low: 101, close: 106 },
    { open: 106, high: 110, low: 104, close: 108 },
    { open: 108, high: 112, low: 107, close: 110 },
    { open: 110, high: 115, low: 109, close: 113 },
    { open: 113, high: 118, low: 112, close: 116 },
    { open: 116, high: 120, low: 115, close: 118 },
    { open: 118, high: 122, low: 117, close: 120 },
    { open: 120, high: 125, low: 119, close: 123 },
    { open: 123, high: 128, low: 122, close: 126 },
    { open: 126, high: 130, low: 125, close: 128 },
    { open: 128, high: 132, low: 127, close: 130 },
    { open: 130, high: 135, low: 129, close: 133 },
    { open: 133, high: 138, low: 132, close: 136 },
    { open: 136, high: 140, low: 135, close: 138 },
];

const indicators = calculateAllIndicators(mockOHLC);
if (indicators) {
    console.log('✅ Technical indicators calculated successfully');
    console.log(`   RSI: ${indicators.rsi?.toFixed(2) || 'N/A'}`);
    console.log(`   MA7: ${indicators.ma7?.toFixed(2) || 'N/A'}`);
    console.log(`   MACD: ${indicators.macd?.value?.toFixed(2) || 'N/A'}`);
} else {
    console.log('❌ Failed to calculate technical indicators');
}

// Test 2: Decision Parser - Single Trade
console.log('\n=== Test 2: Decision Parser (Single Trade) ===');
const singleTradeJSON = `{
  "action": "buy",
  "asset": "AAPL",
  "amount": 10,
  "reason": "Strong earnings report"
}`;

try {
    const decision1 = parseAndValidateDecision(singleTradeJSON, {
        modelName: 'Test Model',
        availableAssets: ['AAPL', 'MSFT', 'GOOGL']
    });
    console.log('✅ Single trade decision parsed successfully');
    console.log(`   ${formatDecision(decision1)}`);
} catch (error) {
    console.log('❌ Failed to parse single trade decision:', error.message);
}

// Test 3: Decision Parser - Multi Trade
console.log('\n=== Test 3: Decision Parser (Multi Trade) ===');
const multiTradeJSON = `{
  "actions": [
    {"action": "sell", "asset": "TSLA", "amount": 5, "reason": "Taking profits"},
    {"action": "buy", "asset": "NVDA", "amount": 10, "reason": "AI growth potential"}
  ],
  "overall_reason": "Rebalancing portfolio towards AI sector"
}`;

try {
    const decision2 = parseAndValidateDecision(multiTradeJSON, {
        modelName: 'Test Model'
    });
    console.log('✅ Multi-trade decision parsed successfully');
    console.log(`   ${formatDecision(decision2)}`);
} catch (error) {
    console.log('❌ Failed to parse multi-trade decision:', error.message);
}

// Test 4: Decision Parser - HOLD
console.log('\n=== Test 4: Decision Parser (HOLD) ===');
const holdJSON = `{"action": "hold", "reason": "Waiting for market stabilization"}`;

try {
    const decision3 = parseAndValidateDecision(holdJSON, {
        modelName: 'Test Model'
    });
    console.log('✅ HOLD decision parsed successfully');
    console.log(`   ${formatDecision(decision3)}`);
} catch (error) {
    console.log('❌ Failed to parse HOLD decision:', error.message);
}

// Test 5: Utilities
console.log('\n=== Test 5: Utilities ===');
console.log(`✅ formatCurrency(1234.56): ${formatCurrency(1234.56)}`);
console.log(`✅ formatPercentage(5.67): ${formatPercentage(5.67)}`);
console.log(`✅ formatPercentage(-3.21): ${formatPercentage(-3.21)}`);

console.log('\n✅ All tests completed!\n');
